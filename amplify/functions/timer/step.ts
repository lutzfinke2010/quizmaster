import { z } from "zod";
import { openQuestion } from "../../../src/server/controlQuestion";
import { finalizeQuestion } from "../../../src/server/finalizeQuestion";
import { completeTimer } from "../../../src/server/timerDispatch";
import { TimerObsoleteError } from "../../../src/server/timerObsolete";
import { database, environment } from "./clients";

const eventSchema = z.object({
  action: z.enum(["open", "finalize"]),
  timer: z.object({
    sessionId: z.string(), questionId: z.string(), timerId: z.string(),
    openAt: z.iso.datetime(), deadlineAt: z.iso.datetime(), obsolete: z.boolean().optional(),
  }).strict(),
}).strict();

export async function handler(event: unknown) {
  const { action, timer } = eventSchema.parse(event);
  const key = { sessionId: timer.sessionId, questionId: timer.questionId, timerId: timer.timerId };
  const tableName = environment("TABLE_NAME");
  if (action === "open" && !timer.obsolete) {
    try {
      await openQuestion(database, tableName, key, Date.now());
    } catch (error) {
      if (!(error instanceof TimerObsoleteError)) throw error;
      return { ...timer, obsolete: true };
    }
  }
  if (action === "finalize") {
    if (!timer.obsolete) {
      try {
        await finalizeQuestion(database, tableName, key, Date.now());
      } catch (error) {
        if (!(error instanceof TimerObsoleteError)) throw error;
      }
    }
    await completeTimer(database, tableName, key);
  }
  return timer;
}
