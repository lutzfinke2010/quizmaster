import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { GetCommand, TransactGetCommand, TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";

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

const adjectives = ["Flotter", "Mutiger", "Neugieriger", "Fröhlicher", "Cleverer", "Wilder",
  "Flinker", "Witziger", "Tapferer", "Pfiffiger", "Muntrer", "Funkelnder"];
const animals = [
  { name: "Otter", avatarId: "otter" }, { name: "Fuchs", avatarId: "fox" },
  { name: "Panda", avatarId: "panda" }, { name: "Pinguin", avatarId: "penguin" },
  { name: "Dachs", avatarId: "badger" }, { name: "Koala", avatarId: "koala" },
  { name: "Igel", avatarId: "hedgehog" }, { name: "Tiger", avatarId: "tiger" },
  { name: "Kater", avatarId: "cat" }, { name: "Hase", avatarId: "rabbit" },
  { name: "Löwe", avatarId: "lion" }, { name: "Biber", avatarId: "beaver" },
];

function assertTime(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
}

async function readMembership(
  client: DynamoDBDocumentClient, tableName: string, sessionId: string, identityId: string, now: number,
): Promise<{ meta: z.infer<typeof metaSchema>; participant: Participation | null }> {
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
  return { meta, participant: { sessionId, ...participant } };
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
  for (let attempt = 0; attempt < 30; attempt++) {
    const membership = await readMembership(client, tableName, sessionId, identityId, now);
    if (membership.meta.joinCode !== code) throw new Error("Der Spielcode ist ungültig oder abgelaufen.");
    if (membership.participant) return membership.participant;
    if (membership.meta.status !== "LOBBY") throw new Error("Das Spiel hat bereits begonnen.");
    if (membership.meta.participantCount >= membership.meta.maxParticipants) throw new Error("Die Sitzung ist voll.");
    const animal = animals[randomInt(animals.length)];
    const baseName = `${adjectives[randomInt(adjectives.length)]} ${animal.name}`;
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
          TableName: tableName, Key: { pk, sk: "META" },
          UpdateExpression: "ADD participantCount :one, #version :one",
          ConditionExpression: "#status = :lobby AND joinCode = :code AND expiresAt > :now AND participantCount < maxParticipants",
          ExpressionAttributeNames: { "#status": "status", "#version": "version" },
          ExpressionAttributeValues: { ":one": 1, ":lobby": "LOBBY", ":code": code, ":now": now },
        } },
        { Put: {
          TableName: tableName, Item: { pk, sk: `IDENTITY#${identityId}`, participantId, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Put: {
          TableName: tableName,
          Item: { pk, sk: `PARTICIPANT#${participantId}`, participantId, displayName,
            avatarId: animal.avatarId, joinedAt: now, totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Put: {
          TableName: tableName, Item: { pk, sk: `NAME#${displayName}`, participantId, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
      ] })));
      return { sessionId, participantId, displayName, avatarId: animal.avatarId, joinedAt: now };
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const current = await readMembership(client, tableName, sessionId, identityId, now);
      if (current.participant) return current.participant;
      if (current.meta.status !== "LOBBY") throw new Error("Das Spiel hat bereits begonnen.");
      if (current.meta.participantCount >= current.meta.maxParticipants) throw new Error("Die Sitzung ist voll.");
      const freshCode = await client.send(new GetCommand({ TableName: tableName, Key: codeKey, ConsistentRead: true }));
      if (freshCode.Item?.sessionId !== sessionId || typeof freshCode.Item.expiresAt !== "number" ||
          freshCode.Item.expiresAt <= now) throw new Error("Der Spielcode ist ungültig oder abgelaufen.");
    }
  }
  throw new Error("Es konnte kein eindeutiger Teilnehmername vergeben werden.");
}
