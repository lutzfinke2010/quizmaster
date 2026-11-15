import type { DynamoDBStreamEvent } from "aws-lambda";
import { z } from "zod";
import { ensureTimerStarted } from "../../../src/server/timerDispatch";
import { database, environment, sfn } from "./clients";

const keySchema = z.object({ sessionId: z.string(), questionId: z.string(), timerId: z.string() });

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    const image = record.dynamodb?.NewImage;
    if (!image?.sk?.S) throw new Error("Missing stream image.");
    if (!image.sk.S.startsWith("TIMER#")) continue;
    const key = keySchema.parse({
      sessionId: image.sessionId?.S, questionId: image.questionId?.S, timerId: image.timerId?.S,
    });
    await ensureTimerStarted(database, sfn, environment("TABLE_NAME"), environment("STATE_MACHINE_ARN"), key);
  }
}
