import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { ensureTimerStarted } from "../../../src/server/timerDispatch";
import { database, environment, sfn } from "./clients";

const keySchema = z.object({ sessionId: z.string(), questionId: z.string(), timerId: z.string() });
/** Gestartete Timer gelten erst so lange nach ihrer Frist als überfällig (Workflow-Retries brauchen Zeit). */
export const OVERDUE_GRACE_MS = 2 * 60_000;

export async function handler(): Promise<void> {
  await sweepPendingTimers(Date.now());
}

export async function sweepPendingTimers(now: number): Promise<void> {
  const tableName = environment("TABLE_NAME");
  const stateMachineArn = environment("STATE_MACHINE_ARN");
  const failures: unknown[] = [];
  const shards = await Promise.allSettled(Array.from({ length: 16 }, async (_, shard) => {
    let cursor: Record<string, unknown> | undefined;
    do {
      const page = await database.send(new QueryCommand({
        TableName: tableName, IndexName: "pending-timers",
        // Nicht gestartete Aufträge (`!`-Präfix) und überfällige gestartete Aufträge; laufende Timer werden übersprungen.
        KeyConditionExpression: "timerPartition = :partition AND timerDeadline < :cutoff",
        ExpressionAttributeValues: { ":partition": `PENDING#${shard}`, ":cutoff": new Date(now - OVERDUE_GRACE_MS).toISOString() },
        ExclusiveStartKey: cursor,
      }));
      for (const item of page.Items ?? []) {
        try {
          await ensureTimerStarted(database, sfn, tableName, stateMachineArn, keySchema.parse(item));
        } catch (error) {
          failures.push(error);
        }
      }
      cursor = page.LastEvaluatedKey;
    } while (cursor);
  }));
  for (const shard of shards) if (shard.status === "rejected") failures.push(shard.reason);
  if (failures.length) throw new AggregateError(failures, `${failures.length} Timeraufträge oder Shards konnten nicht verarbeitet werden.`);
}
