import { z } from "zod";
import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { isConditionalFailure } from "./transactionRetry";

export async function enforceRateLimit(
  client: DynamoDBDocumentClient, tableName: string, identityId: string,
  operation: "join" | "answer", now: number,
): Promise<void> {
  z.string().regex(/^[A-Za-z0-9_:.-]{1,128}$/).parse(identityId);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
  const minute = Math.floor(now / 60_000);
  const limit = operation === "join" ? 20 : 30;
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
