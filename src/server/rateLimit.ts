import { z } from "zod";
import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { isConditionalFailure } from "./transactionRetry";

/**
 * Anfragen je Identity und Minute. Lesepfade erhalten ein großzügiges Kontingent, damit Polling/Reloads nach
 * Live-Events nie blockiert werden, missbräuchliche Schleifen aber gebremst werden. Da Gast-Identitäten beliebig
 * neu erzeugt werden können, ist die WAF-IP-Grenze (backend.ts) die eigentliche Obergrenze. `lookup` bremst
 * zusätzlich das Durchprobieren kurzer Quiz-Codes (Codeauflösung und Rundeninfos per Code).
 */
export const RATE_LIMITS = { join: 20, answer: 30, delete: 10, read: 300, lookup: 30 } as const;
export type RateLimitedOperation = keyof typeof RATE_LIMITS;

export async function enforceRateLimit(
  client: DynamoDBDocumentClient, tableName: string, identityId: string,
  operation: RateLimitedOperation, now: number,
): Promise<void> {
  z.string().regex(/^[A-Za-z0-9_:.-]{1,128}$/).parse(identityId);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
  const minute = Math.floor(now / 60_000);
  const limit = RATE_LIMITS[operation];
  try {
    await client.send(new UpdateCommand({
      TableName: tableName, Key: { pk: `RATE#${identityId}`, sk: `${operation}#${minute}` },
      UpdateExpression: "SET #ttl = :ttl ADD #count :one",
      ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
      ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
      ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":ttl": (minute + 3) * 60 },
    }));
  } catch (error) {
    if (isConditionalFailure(error)) throw new Error("Zu viele Anfragen. Bitte versuche es gleich erneut.");
    throw error;
  }
}
