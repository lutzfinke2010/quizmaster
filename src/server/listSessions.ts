import { z } from "zod";
import { GetCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireQuizmaster } from "./adminPrincipal";

export async function listSessions(
  client: DynamoDBDocumentClient, tableName: string, principal: unknown, now: number,
) {
  const ownerId = requireQuizmaster(principal);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("Ungültige Anfrage.");
  }
  const records: Array<{ sessionId: string; title: string; status: string; joinCode: string; presentationToken: string; createdAt: number }> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :owner AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":owner": `OWNER#${ownerId}`, ":prefix": "SESSIONTOKEN#" },
      ExclusiveStartKey: cursor,
    }));
    for (const raw of page.Items ?? []) {
      const token = z.object({ sk: z.string().startsWith("SESSIONTOKEN#"),
        presentationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/), expiresAt: z.number().int() }).parse(raw);
      if (token.expiresAt <= now) continue;
      const sessionId = z.string().uuid().parse(token.sk.slice("SESSIONTOKEN#".length));
      const response = await client.send(new GetCommand({
        TableName: tableName, Key: { pk: `SESSION#${sessionId}`, sk: "META" }, ConsistentRead: true,
      }));
      if (!response.Item) throw new Error("Gespeicherte Sitzung nicht gefunden.");
      const meta = z.object({ ownerId: z.string(), title: z.string(), status: z.string(),
        joinCode: z.string().regex(/^\d{6}$/), createdAt: z.number().int(), expiresAt: z.number().int() }).parse(response.Item);
      if (meta.ownerId !== ownerId) throw new Error("Sitzung gehört nicht zu diesem Konto.");
      if (meta.expiresAt <= now || meta.status === "PREPARING" || meta.status === "FAILED") continue;
      records.push({ sessionId, title: meta.title, status: meta.status, joinCode: meta.joinCode,
        presentationToken: token.presentationToken, createdAt: meta.createdAt });
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return records.sort((a, b) => b.createdAt - a.createdAt || a.sessionId.localeCompare(b.sessionId));
}
