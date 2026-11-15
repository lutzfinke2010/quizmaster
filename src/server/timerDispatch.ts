import { z } from "zod";
import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DescribeExecutionCommand, StartExecutionCommand, type SFNClient } from "@aws-sdk/client-sfn";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const keySchema = z.object({ sessionId: id, questionId: id, timerId: id }).strict();
const jobSchema = z.object({
  ...keySchema.shape,
  status: z.enum(["PENDING", "COMPLETE"]),
  opensAt: z.number().int().min(0).max(8_640_000_000_000_000 - 1000),
  closesAt: z.number().int().min(0).max(8_640_000_000_000_000 - 1000),
  deadlineAt: z.iso.datetime(),
  attempt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).refine((job) => job.closesAt > job.opensAt &&
  job.deadlineAt === new Date(Math.ceil(job.closesAt / 1000) * 1000).toISOString(),
  "Ungültiger Timerauftrag.");

export type TimerKey = z.infer<typeof keySchema>;

function itemKey(key: TimerKey) {
  return { pk: `SESSION#${key.sessionId}`, sk: `TIMER#${key.questionId}#${key.timerId}` };
}

function executionArn(stateMachineArn: string, name: string) {
  if (!/^arn:[^:]+:states:[^:]+:\d{12}:stateMachine:[^:/]+$/.test(stateMachineArn)) {
    throw new Error("Ungültige State-Machine-ARN.");
  }
  return `${stateMachineArn.replace(":stateMachine:", ":execution:")}:${name}`;
}

export async function completeTimer(
  client: DynamoDBDocumentClient, tableName: string, rawKey: unknown,
): Promise<void> {
  const key = keySchema.parse(rawKey);
  try {
    await client.send(new UpdateCommand({
      TableName: tableName, Key: itemKey(key),
      UpdateExpression: "SET #status = :complete REMOVE timerPartition, timerDeadline",
      ConditionExpression: "#status = :pending AND timerId = :timer",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":pending": "PENDING", ":complete": "COMPLETE", ":timer": key.timerId },
    }));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const result = await client.send(new GetCommand({ TableName: tableName, Key: itemKey(key), ConsistentRead: true }));
    if (result.Item?.status !== "COMPLETE" || result.Item.timerId !== key.timerId) throw error;
  }
}

/**
 * Idempotent dispatcher for a persisted outbox item. Pending jobs stay indexed
 * until the workflow finishes, so a separate periodic sweep can recover failures.
 */
export async function ensureTimerStarted(
  database: DynamoDBDocumentClient, sfn: SFNClient, tableName: string, stateMachineArn: string, rawKey: unknown,
): Promise<void> {
  const key = keySchema.parse(rawKey);
  const keyInTable = itemKey(key);
  for (let retry = 0; retry < 5; retry++) {
    const result = await database.send(new GetCommand({ TableName: tableName, Key: keyInTable, ConsistentRead: true }));
    if (!result.Item) throw new Error("Timerauftrag nicht gefunden.");
    const job = jobSchema.parse(result.Item);
    if (job.sessionId !== key.sessionId || job.questionId !== key.questionId || job.timerId !== key.timerId) {
      throw new Error("Timerauftrag stimmt nicht mit seinem Schlüssel überein.");
    }
    if (job.status === "COMPLETE") return;
    const name = `${job.timerId}-${job.attempt}`;
    if (name.length > 80) throw new Error("Timer-Ausführungsname ist zu lang.");
    const input = JSON.stringify({ ...key,
      openAt: new Date(Math.ceil(job.opensAt / 1000) * 1000).toISOString(),
      deadlineAt: job.deadlineAt });
    try {
      await sfn.send(new StartExecutionCommand({ stateMachineArn, name, input }));
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ExecutionAlreadyExists") throw error;
    }
    const execution = await sfn.send(new DescribeExecutionCommand({ executionArn: executionArn(stateMachineArn, name) }));
    if (execution.status === "RUNNING" || execution.status === "PENDING_REDRIVE") return;
    if (execution.status === "SUCCEEDED") {
      await completeTimer(database, tableName, key);
      return;
    }
    if (execution.status !== "FAILED" && execution.status !== "TIMED_OUT" && execution.status !== "ABORTED") {
      throw new Error("Unbekannter Timer-Ausführungsstatus.");
    }
    try {
      await withTransactionConflictRetry(() => database.send(new UpdateCommand({
        TableName: tableName, Key: keyInTable,
        UpdateExpression: "SET attempt = :next",
        ConditionExpression: "#status = :pending AND attempt = :current AND timerId = :timer",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":pending": "PENDING", ":current": job.attempt,
          ":next": job.attempt + 1, ":timer": key.timerId },
      })));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
  }
  throw new Error("Timerauftrag konnte nach konkurrierenden Aktualisierungen nicht gestartet werden.");
}
