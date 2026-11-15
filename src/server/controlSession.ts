import { z } from "zod";
import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireQuizmaster } from "./adminPrincipal";
import { withTransactionConflictRetry } from "./transactionRetry";

const requestSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
}).strict();

export async function controlSession(
  client: DynamoDBDocumentClient, tableName: string, rawRequest: unknown,
  rawPrincipal: unknown, now: number, action: "showLeaderboard" | "finishSession" | "cancelSession",
): Promise<{ version: number }> {
  const request = requestSchema.parse(rawRequest);
  const ownerId = requireQuizmaster(rawPrincipal);
  z.enum(["showLeaderboard", "finishSession", "cancelSession"]).parse(action);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
  let condition: string;
  let nextStatus: string;
  let values: Record<string, string | number>;
  if (action === "showLeaderboard") {
    condition = "#status = :reveal";
    nextStatus = "LEADERBOARD";
    values = { ":reveal": "REVEAL" };
  } else if (action === "finishSession") {
    const result = await client.send(new GetCommand({
      TableName: tableName, Key: { pk: `SESSION#${request.sessionId}`, sk: "META" }, ConsistentRead: true,
    }));
    const meta = z.object({ ownerId: z.string(), expiresAt: z.number(),
      questionIndex: z.number().int(), questionCount: z.number().int().min(1) }).parse(result.Item);
    if (meta.ownerId !== ownerId || meta.expiresAt <= now) throw new Error("Keine Berechtigung für diese Sitzung.");
    if (meta.questionIndex !== meta.questionCount - 1) throw new Error("Es sind noch Fragen offen.");
    condition = "#status = :leaderboard AND questionIndex = :lastIndex AND questionCount = :questionCount";
    nextStatus = "FINISHED";
    values = { ":leaderboard": "LEADERBOARD", ":lastIndex": meta.questionIndex, ":questionCount": meta.questionCount };
  } else {
    condition = "#status <> :finished AND #status <> :cancelled AND #status <> :preparing AND #status <> :failed";
    nextStatus = "CANCELLED";
    values = { ":finished": "FINISHED", ":cancelled": "CANCELLED", ":preparing": "PREPARING", ":failed": "FAILED" };
  }
  await withTransactionConflictRetry(() => client.send(new UpdateCommand({
    TableName: tableName, Key: { pk: `SESSION#${request.sessionId}`, sk: "META" },
    UpdateExpression: "SET #status = :next ADD #version :one",
    ConditionExpression: `${condition} AND ownerId = :owner AND #version = :expected AND expiresAt > :now`,
    ExpressionAttributeNames: { "#status": "status", "#version": "version" },
    ExpressionAttributeValues: { ...values, ":next": nextStatus, ":one": 1,
      ":owner": ownerId, ":expected": request.expectedVersion, ":now": now },
  })));
  return { version: request.expectedVersion + 1 };
}
