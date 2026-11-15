import { z } from "zod";
import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireQuizmaster } from "./adminPrincipal";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";
import { TimerObsoleteError } from "./timerObsolete";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const timerRequestSchema = z.object({ sessionId: id, questionId: id, timerId: id }).strict();
const closeRequestSchema = z.object({
  sessionId: id, questionId: id, expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();

function assertTime(now: number) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
}

/**
 * Server-only timer step. It cannot reopen an expired, closed, or replaced question.
 */
export async function openQuestion(
  client: DynamoDBDocumentClient, tableName: string, rawRequest: unknown, now: number,
): Promise<void> {
  const request = timerRequestSchema.parse(rawRequest);
  assertTime(now);
  try {
    await withTransactionConflictRetry(() => client.send(new UpdateCommand({
      TableName: tableName, Key: { pk: `SESSION#${request.sessionId}`, sk: "META" },
      UpdateExpression: "SET #status = :open ADD #version :one",
      ConditionExpression: "#status = :countdown AND currentQuestionId = :question AND timerId = :timer AND opensAt <= :now AND closesAt > :now AND expiresAt > :now",
      ExpressionAttributeNames: { "#status": "status", "#version": "version" },
      ExpressionAttributeValues: { ":open": "QUESTION_OPEN", ":countdown": "COUNTDOWN",
        ":question": request.questionId, ":timer": request.timerId, ":now": now, ":one": 1 },
    })));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const response = await client.send(new GetCommand({
      TableName: tableName, Key: { pk: `SESSION#${request.sessionId}`, sk: "META" }, ConsistentRead: true,
    }));
    const meta = response.Item;
    if (!meta || meta.currentQuestionId !== request.questionId || meta.timerId !== request.timerId ||
        meta.status === "CANCELLED" || (typeof meta.expiresAt === "number" && meta.expiresAt <= now)) {
      throw new TimerObsoleteError("Timerauftrag ist abgelaufen oder nicht mehr aktuell.");
    }
    if (meta?.currentQuestionId === request.questionId && meta.timerId === request.timerId &&
        (["QUESTION_OPEN", "QUESTION_CLOSED", "SCORING", "REVEAL", "LEADERBOARD", "FINISHED", "CANCELLED"].includes(meta.status) ||
          (meta.status === "COUNTDOWN" && typeof meta.closesAt === "number" && now >= meta.closesAt))) {
      return;
    }
    throw error;
  }
}

/**
 * Only a trusted entry point may construct the principal and timestamp. The
 * persisted close remains safe even if invoking the finalizer subsequently fails.
 */
export async function closeQuestion(
  client: DynamoDBDocumentClient, tableName: string, rawRequest: unknown, rawPrincipal: unknown, now: number,
): Promise<{ timerId: string; version: number }> {
  const request = closeRequestSchema.parse(rawRequest);
  const ownerId = requireQuizmaster(rawPrincipal);
  assertTime(now);
  const key = { pk: `SESSION#${request.sessionId}`, sk: "META" };
  const response = await client.send(new GetCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
  const meta = z.object({ timerId: id }).parse(response.Item);
  await withTransactionConflictRetry(() => client.send(new UpdateCommand({
    TableName: tableName, Key: key,
    UpdateExpression: "SET #status = :closed ADD #version :one",
    ConditionExpression: "#status = :open AND currentQuestionId = :question AND timerId = :timer AND #version = :expectedVersion AND ownerId = :owner AND expiresAt > :now",
    ExpressionAttributeNames: { "#status": "status", "#version": "version" },
    ExpressionAttributeValues: { ":closed": "QUESTION_CLOSED", ":open": "QUESTION_OPEN",
      ":question": request.questionId, ":timer": meta.timerId, ":expectedVersion": request.expectedVersion,
      ":owner": ownerId, ":now": now, ":one": 1 },
  })));
  return { timerId: meta.timerId, version: request.expectedVersion + 1 };
}
