import { z } from "zod";
import { GetCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireQuizmaster } from "./adminPrincipal";
import { batchGetAll } from "./batchGet";
import { logger } from "./logger";

export interface SessionRecord {
  sessionId: string; title: string; status: string; joinCode: string; presentationToken: string; createdAt: number;
}

const tokenSchema = z.object({ sk: z.string().startsWith("SESSIONTOKEN#"),
  presentationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/), expiresAt: z.number().int() });
const metaSchema = z.object({ ownerId: z.string(), title: z.string(), status: z.string(),
  joinCode: z.string().regex(/^\d{6}$/), createdAt: z.number().int(), expiresAt: z.number().int() });

function validate(principal: unknown, now: number): string {
  const ownerId = requireQuizmaster(principal);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("Ungültige Anfrage.");
  }
  return ownerId;
}

/** Kombiniert Token- und META-Item; `undefined`, wenn die Sitzung abgelaufen, unfertig oder (per TTL) schon gelöscht ist. */
function toRecord(sessionId: string, presentationToken: string, rawMeta: unknown, ownerId: string, now: number): SessionRecord | undefined {
  if (!rawMeta) return undefined;
  const meta = metaSchema.parse(rawMeta);
  if (meta.ownerId !== ownerId) throw new Error("Sitzung gehört nicht zu diesem Konto.");
  if (meta.expiresAt <= now || meta.status === "PREPARING" || meta.status === "FAILED") return undefined;
  return { sessionId, title: meta.title, status: meta.status, joinCode: meta.joinCode, presentationToken, createdAt: meta.createdAt };
}

export async function listSessions(
  client: DynamoDBDocumentClient, tableName: string, principal: unknown, now: number,
): Promise<SessionRecord[]> {
  const ownerId = validate(principal, now);
  const tokens: Array<{ sessionId: string; presentationToken: string }> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :owner AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":owner": `OWNER#${ownerId}`, ":prefix": "SESSIONTOKEN#" },
      ExclusiveStartKey: cursor,
    }));
    for (const raw of page.Items ?? []) {
      const token = tokenSchema.parse(raw);
      if (token.expiresAt <= now) continue;
      tokens.push({ sessionId: z.string().uuid().parse(token.sk.slice("SESSIONTOKEN#".length)), presentationToken: token.presentationToken });
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  const metas = await batchGetAll(client, tableName, tokens.map(({ sessionId }) => ({ pk: `SESSION#${sessionId}`, sk: "META" })));
  const records: SessionRecord[] = [];
  for (const token of tokens) {
    const meta = metas.get(`SESSION#${token.sessionId}#META`);
    if (!meta) logger.info("listSessions.metaMissing", { sessionId: token.sessionId });
    const record = toRecord(token.sessionId, token.presentationToken, meta, ownerId, now);
    if (record) records.push(record);
  }
  return records.sort((a, b) => b.createdAt - a.createdAt || a.sessionId.localeCompare(b.sessionId));
}

/** Lädt genau eine eigene Sitzung (zwei Punktzugriffe) statt der gesamten Sitzungsliste. */
export async function getSession(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, principal: unknown, now: number,
): Promise<SessionRecord> {
  const ownerId = validate(principal, now);
  const sessionId = z.string().uuid().parse(rawSessionId);
  const [tokenResponse, metaResponse] = await Promise.all([
    client.send(new GetCommand({ TableName: tableName, Key: { pk: `OWNER#${ownerId}`, sk: `SESSIONTOKEN#${sessionId}` }, ConsistentRead: true })),
    client.send(new GetCommand({ TableName: tableName, Key: { pk: `SESSION#${sessionId}`, sk: "META" }, ConsistentRead: true })),
  ]);
  const token = tokenResponse.Item ? tokenSchema.parse(tokenResponse.Item) : undefined;
  const record = token && token.expiresAt > now
    ? toRecord(sessionId, token.presentationToken, metaResponse.Item, ownerId, now) : undefined;
  if (!record) throw new Error("Sitzung nicht gefunden oder abgelaufen.");
  return record;
}
