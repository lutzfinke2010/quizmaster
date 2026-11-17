import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  BatchWriteCommand, GetCommand, QueryCommand, TransactGetCommand, TransactWriteCommand, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import avatars from "../domain/avatars.json";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";
import { logger } from "./logger";

const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const identitySchema = z.string().regex(/^[A-Za-z0-9_:.-]{1,128}$/);
const codeSchema = z.string().regex(/^\d{6}$/);
const metaSchema = z.object({
  status: z.string(), expiresAt: z.number().int(), ttl: z.number().int(),
  participantCount: z.number().int().min(0), maxParticipants: z.number().int().min(1), joinCode: codeSchema,
});
const identityRecordSchema = z.object({ participantId: sessionIdSchema });
const participantSchema = z.object({
  participantId: sessionIdSchema, displayName: z.string(), avatarId: z.string(), joinedAt: z.number().int(),
});
export type Participation = z.infer<typeof participantSchema> & { sessionId: string };

const adjectiveStems = ["Flott", "Mutig", "Neugierig", "Fröhlich", "Clever", "Wild",
  "Flink", "Witzig", "Tapfer", "Pfiffig", "Munter", "Funkelnd"];
const feminineLabels = new Set(["Eule", "Giraffe", "Katze", "Schildkröte", "Maus", "Fledermaus", "Robbe", "Krabbe", "Ente"]);
const neuterLabels = new Set(["Lama", "Faultier", "Nilpferd", "Krokodil", "Walross", "Eichhörnchen",
  "Reh", "Zebra", "Seepferdchen", "Huhn"]);
export const avatarIds = avatars.avatars.map(({ id }) => id);
const maxJoinAttempts = 20;

function assertTime(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
}

async function readMembership(
  client: DynamoDBDocumentClient, tableName: string, sessionId: string, identityId: string, now: number,
): Promise<{ meta: z.infer<typeof metaSchema>; participant: Participation | null; avatarKey?: string }> {
  const pk = `SESSION#${sessionId}`;
  const metaKey = { pk, sk: "META" };
  const identityKey = { pk, sk: `IDENTITY#${identityId}` };
  const initial = await withTransactionConflictRetry(() => client.send(new TransactGetCommand({
    TransactItems: [{ Get: { TableName: tableName, Key: metaKey } }, { Get: { TableName: tableName, Key: identityKey } }],
  })));
  if (!initial.Responses?.[0]?.Item) throw new Error("Sitzung nicht gefunden oder abgelaufen.");
  const initialMeta = metaSchema.parse(initial.Responses[0].Item);
  if (initialMeta.expiresAt <= now) throw new Error("Sitzung nicht gefunden oder abgelaufen.");
  if (!initial.Responses[1]?.Item) return { meta: initialMeta, participant: null };
  const participantId = identityRecordSchema.parse(initial.Responses[1].Item).participantId;
  const result = await withTransactionConflictRetry(() => client.send(new TransactGetCommand({
    TransactItems: [
      { Get: { TableName: tableName, Key: metaKey } },
      { Get: { TableName: tableName, Key: identityKey } },
      { Get: { TableName: tableName, Key: { pk, sk: `PARTICIPANT#${participantId}` } } },
    ],
  })));
  if (!result.Responses?.[0]?.Item || !result.Responses[1]?.Item || !result.Responses[2]?.Item) {
    throw new Error("Teilnahme konnte nicht wiederhergestellt werden.");
  }
  const meta = metaSchema.parse(result.Responses[0].Item);
  const currentId = identityRecordSchema.parse(result.Responses[1].Item).participantId;
  const participant = participantSchema.parse(result.Responses[2].Item);
  if (meta.expiresAt <= now || currentId !== participantId || participant.participantId !== participantId) {
    throw new Error("Teilnahme konnte nicht wiederhergestellt werden.");
  }
  const rawAvatarKey = result.Responses[2].Item.avatarKey;
  const avatarKey = typeof rawAvatarKey === "string" && rawAvatarKey.startsWith("AVATAR#")
    ? rawAvatarKey : `AVATAR#${participant.avatarId}`;
  return { meta, participant: { sessionId, ...participant }, avatarKey };
}

/**
 * Avatar-Reservierungen sind nummerierte Slots: `AVATAR#<id>` (erste Vergabe) und `AVATAR#<id>#<n>` (n-te Wiederholung).
 * Jeder Slot wird per `attribute_not_exists` exklusiv belegt. So bleibt die Verteilung ohne globale Versionsbedingung
 * ausgeglichen: Ein Avatar wird erst ein weiteres Mal vergeben, wenn alle anderen mindestens gleich oft belegt sind.
 */
export function avatarSlotKey(avatarId: string, slot: number): string {
  return slot === 0 ? `AVATAR#${avatarId}` : `AVATAR#${avatarId}#${slot}`;
}

export async function reservedAvatarSlots(
  client: DynamoDBDocumentClient, tableName: string, pk: string,
): Promise<Map<string, Set<number>>> {
  const slots = new Map(avatarIds.map((id) => [id, new Set<number>()]));
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ProjectionExpression: "sk",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": "AVATAR#" },
      ExclusiveStartKey: cursor,
    }));
    for (const item of page.Items ?? []) {
      const [id, rawSlot] = String(item.sk).slice("AVATAR#".length).split("#");
      const slot = rawSlot === undefined ? 0 : Number(rawSlot);
      if (Number.isSafeInteger(slot) && slot >= 0) slots.get(id)?.add(slot);
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return slots;
}

export function chooseAvatarSlot(slots: Map<string, Set<number>>): { id: string; slot: number; key: string } {
  const usage = (id: string) => slots.get(id)?.size ?? 0;
  const minimum = Math.min(...avatarIds.map(usage));
  const candidates = avatarIds.filter((id) => usage(id) === minimum);
  const id = candidates[randomInt(candidates.length)];
  const taken = slots.get(id) ?? new Set<number>();
  let slot = 0;
  while (taken.has(slot)) slot++;
  return { id, slot, key: avatarSlotKey(id, slot) };
}

/** Exponentielles Backoff mit vollem Jitter für konkurrierende Beitritte. */
export function backoffWithJitter(attempt: number): Promise<void> {
  const ceiling = Math.min(500, 10 * 2 ** Math.min(attempt, 6));
  return new Promise<void>((resolve) => setTimeout(resolve, randomInt(ceiling + 1)));
}

export function displayNameFor(label: string): string {
  const ending = feminineLabels.has(label) ? "e" : neuterLabels.has(label) ? "es" : "er";
  return `${adjectiveStems[randomInt(adjectiveStems.length)]}${ending} ${label}`;
}

/** `identityId` must be derived from an authenticated Cognito identity, never a client argument. */
export async function getMyParticipation(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, identityId: string, now: number,
): Promise<Participation> {
  const sessionId = sessionIdSchema.parse(rawSessionId);
  identitySchema.parse(identityId);
  assertTime(now);
  const result = await readMembership(client, tableName, sessionId, identityId, now);
  if (!result.participant) throw new Error("Keine gültige Teilnahme an dieser Sitzung.");
  return result.participant;
}

export async function joinSession(
  client: DynamoDBDocumentClient, tableName: string, rawCode: unknown, identityId: string, now: number,
): Promise<Participation> {
  const code = codeSchema.parse(rawCode);
  identitySchema.parse(identityId);
  assertTime(now);
  const codeKey = { pk: `CODE#${code}`, sk: "META" };
  const mapping = await client.send(new GetCommand({ TableName: tableName, Key: codeKey, ConsistentRead: true }));
  const parsed = z.object({ sessionId: sessionIdSchema, expiresAt: z.number().int() }).safeParse(mapping.Item);
  if (!parsed.success || parsed.data.expiresAt <= now) throw new Error("Der Spielcode ist ungültig oder abgelaufen.");
  const sessionId = parsed.data.sessionId;
  const pk = `SESSION#${sessionId}`;
  for (let attempt = 0; attempt < maxJoinAttempts; attempt++) {
    const membership = await readMembership(client, tableName, sessionId, identityId, now);
    if (membership.meta.joinCode !== code) throw new Error("Der Spielcode ist ungültig oder abgelaufen.");
    if (membership.participant) return membership.participant;
    if (membership.meta.status !== "LOBBY") throw new Error("Das Spiel hat bereits begonnen.");
    if (membership.meta.participantCount >= membership.meta.maxParticipants) throw new Error("Die Sitzung ist voll.");
    const avatar = chooseAvatarSlot(await reservedAvatarSlots(client, tableName, pk));
    const catalogEntry = avatars.avatars.find((entry) => entry.id === avatar.id);
    if (!catalogEntry) throw new Error("Avatar fehlt im lokalen Katalog.");
    const baseName = displayNameFor(catalogEntry.label);
    const displayName = attempt === 0 ? baseName : `${baseName} ${randomInt(10, 1000)}`;
    const participantId = randomUUID();
    const ttl = membership.meta.ttl;
    try {
      await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: {
          TableName: tableName, Key: codeKey,
          ConditionExpression: "sessionId = :session AND expiresAt > :now",
          ExpressionAttributeValues: { ":session": sessionId, ":now": now },
        } },
        { Update: {
          // Kein `#version`: Beitritte sind keine Phasenwechsel (siehe README, Abschnitt Echtzeit-Events).
          TableName: tableName, Key: { pk, sk: "META" },
          UpdateExpression: "ADD participantCount :one",
          ConditionExpression: "#status = :lobby AND joinCode = :code AND expiresAt > :now AND participantCount < maxParticipants",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":one": 1, ":lobby": "LOBBY", ":code": code, ":now": now },
        } },
        { Put: {
          TableName: tableName, Item: { pk, sk: `IDENTITY#${identityId}`, participantId, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Put: {
          TableName: tableName,
          Item: { pk, sk: `PARTICIPANT#${participantId}`, participantId, displayName, avatarId: avatar.id,
            avatarKey: avatar.key, joinedAt: now, totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Put: {
          TableName: tableName, Item: { pk, sk: `NAME#${displayName}`, participantId, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Put: {
          TableName: tableName, Item: { pk, sk: avatar.key, participantId, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
      ] })));
      return { sessionId, participantId, displayName, avatarId: avatar.id, joinedAt: now };
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const current = await readMembership(client, tableName, sessionId, identityId, now);
      if (current.participant) return current.participant;
      if (current.meta.status !== "LOBBY") throw new Error("Das Spiel hat bereits begonnen.");
      if (current.meta.participantCount >= current.meta.maxParticipants) throw new Error("Die Sitzung ist voll.");
      const freshCode = await client.send(new GetCommand({ TableName: tableName, Key: codeKey, ConsistentRead: true }));
      if (freshCode.Item?.sessionId !== sessionId || typeof freshCode.Item.expiresAt !== "number" ||
          freshCode.Item.expiresAt <= now) throw new Error("Der Spielcode ist ungültig oder abgelaufen.");
      logger.warn("join.conflict", { sessionId, attempt });
      await backoffWithJitter(attempt);
    }
  }
  throw new Error("Es konnte kein Avatar und eindeutiger Teilnehmername vergeben werden.");
}

const gonePatterns = ["Sitzung nicht gefunden oder abgelaufen.", "Teilnahme konnte nicht wiederhergestellt werden."];
const deletableStatuses = ["LOBBY", "REVEAL", "LEADERBOARD", "FINISHED", "CANCELLED"];

async function removeParticipantRecords(
  client: DynamoDBDocumentClient, tableName: string, sessionId: string, participantId: string,
): Promise<void> {
  const keys: Array<{ pk: string; sk: string }> = [];
  for (const prefix of ["ANSWER#", "RESULT#"]) {
    let cursor: Record<string, unknown> | undefined;
    do {
      const page = await client.send(new QueryCommand({
        TableName: tableName, ConsistentRead: true,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ProjectionExpression: "pk, sk",
        ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":prefix": prefix },
        ExclusiveStartKey: cursor,
      }));
      for (const item of page.Items ?? []) {
        if (String(item.sk).endsWith(`#${participantId}`)) keys.push({ pk: String(item.pk), sk: String(item.sk) });
      }
      cursor = page.LastEvaluatedKey;
    } while (cursor);
  }
  for (let index = 0; index < keys.length; index += 25) {
    let pending = keys.slice(index, index + 25).map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; pending.length > 0 && attempt < 5; attempt++) {
      const result = await client.send(new BatchWriteCommand({ RequestItems: { [tableName]: pending } }));
      pending = (result.UnprocessedItems?.[tableName] ?? []) as typeof pending;
    }
  }
}

/**
 * Löscht die eigene Teilnahme: Zugriff, Namens- und Avatar-Reservierung werden entfernt, der Teilnehmer-Datensatz wird zu einem
 * personenlosen Platzhalter (Auswertungen laufender Fragen greifen darauf zu), Antworten und Ergebnisse werden gelöscht.
 * Wiederholbar: ohne vorhandene Teilnahme ist das Ergebnis ebenfalls `true`.
 *
 * Bewusste Abweichung: Bereits veröffentlichte Antwortverteilungen (`REVEAL#…`) sind anonyme Aggregate und werden
 * nicht nachträglich korrigiert. Nach einer Löschung kann die Verteilung einer vergangenen Frage daher eine Antwort
 * mehr zählen, als noch Ergebnisse vorhanden sind.
 */
export async function deleteMyParticipation(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, identityId: string, now: number,
): Promise<boolean> {
  const sessionId = sessionIdSchema.parse(rawSessionId);
  identitySchema.parse(identityId);
  assertTime(now);
  const pk = `SESSION#${sessionId}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    let membership;
    try {
      membership = await readMembership(client, tableName, sessionId, identityId, now);
    } catch (error) {
      if (error instanceof Error && gonePatterns.includes(error.message)) return true;
      throw error;
    }
    const participant = membership.participant;
    if (!participant) return true;
    const avatarKey = membership.avatarKey ?? `AVATAR#${participant.avatarId}`;
    const reservation = await client.send(new GetCommand({
      TableName: tableName, Key: { pk, sk: avatarKey }, ConsistentRead: true,
    }));
    const ownsReservation = reservation?.Item?.participantId === participant.participantId;
    if (!deletableStatuses.includes(membership.meta.status)) {
      throw new Error("Während einer laufenden Frage kann die Teilnahme nicht gelöscht werden. Bitte nach der Auflösung erneut versuchen.");
    }
    try {
      await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
        { Update: {
          TableName: tableName, Key: { pk, sk: "META" },
          UpdateExpression: "ADD participantCount :minusOne",
          ConditionExpression: "#status IN (:s1, :s2, :s3, :s4, :s5) AND expiresAt > :now AND participantCount > :zero",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":minusOne": -1, ":zero": 0, ":now": now,
            ":s1": deletableStatuses[0], ":s2": deletableStatuses[1], ":s3": deletableStatuses[2],
            ":s4": deletableStatuses[3], ":s5": deletableStatuses[4] },
        } },
        { Delete: {
          TableName: tableName, Key: { pk, sk: `IDENTITY#${identityId}` },
          ConditionExpression: "participantId = :participant", ExpressionAttributeValues: { ":participant": participant.participantId },
        } },
        { Delete: { TableName: tableName, Key: { pk, sk: `NAME#${participant.displayName}` } } },
        { Update: {
          TableName: tableName, Key: { pk, sk: `PARTICIPANT#${participant.participantId}` },
          UpdateExpression: "SET removed = :true, displayName = :empty, avatarId = :empty, totalPoints = :zero, correctAnswers = :zero, correctElapsedMs = :zero",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: { ":true": true, ":empty": "", ":zero": 0 },
        } },
        // Gibt den Avatar-Slot wieder frei, damit er in der Lobby neu vergeben werden kann.
        ...(ownsReservation ? [{ Delete: {
          TableName: tableName, Key: { pk, sk: avatarKey },
          ConditionExpression: "participantId = :participant",
          ExpressionAttributeValues: { ":participant": participant.participantId },
        } }] : []),
      ] })));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      continue;
    }
    try {
      await removeParticipantRecords(client, tableName, sessionId, participant.participantId);
    } catch (error) {
      logger.error("participation.cleanupIncomplete", { sessionId, error });
    }
    return true;
  }
  throw new Error("Die Teilnahme konnte nicht gelöscht werden. Bitte erneut versuchen.");
}
