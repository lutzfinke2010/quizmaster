import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TransactGetCommand, TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";
import { requireQuizmaster } from "./adminPrincipal";
import { undispatchedTimerDeadline } from "./timerDispatch";
import { transition } from "../domain/session";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const requestSchema = z.object({
  sessionId: id,
  questionId: id,
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();
const metaSchema = z.object({
  status: z.enum(["LOBBY", "LEADERBOARD"]),
  ownerId: z.string(),
  version: z.number().int(),
  questionIndex: z.number().int(),
  questionCount: z.number().int().min(1).max(100),
  expiresAt: z.number().int(),
});
const questionSchema = z.object({
  index: z.number().int().min(0).max(99),
  durationSeconds: z.number().int().min(5).max(120),
});

/**
 * Principal and time must come from the trusted server entry point. Der Timerauftrag (`TIMER#…`) wird über den
 * DynamoDB-Stream an Step Functions übergeben (`amplify/functions/timer/dispatch.ts`); der minütliche Sweep
 * (`sweep.ts`) holt verlorene oder überfällige Aufträge nach.
 */
export async function startQuestion(
  client: DynamoDBDocumentClient,
  tableName: string,
  rawRequest: unknown,
  rawPrincipal: unknown,
  now: number,
): Promise<{ timerId: string; opensAt: number; closesAt: number; version: number }> {
  const request = requestSchema.parse(rawRequest);
  const ownerId = requireQuizmaster(rawPrincipal);
  if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000 - 123_000) {
    throw new Error("Ungültige Serverzeit.");
  }
  const pk = `SESSION#${request.sessionId}`;
  const metaKey = { pk, sk: "META" };
  const questionKey = { pk, sk: `QUESTION#${request.questionId}` };
  const snapshot = await withTransactionConflictRetry(() => client.send(new TransactGetCommand({
    TransactItems: [
      { Get: { TableName: tableName, Key: metaKey } },
      { Get: { TableName: tableName, Key: questionKey } },
    ],
  })));
  if (!snapshot.Responses?.[0]?.Item || !snapshot.Responses[1]?.Item) {
    throw new Error("Sitzung oder Frage nicht gefunden.");
  }
  const meta = metaSchema.parse(snapshot.Responses[0].Item);
  const question = questionSchema.parse(snapshot.Responses[1].Item);
  if (meta.ownerId !== ownerId) throw new Error("Keine Berechtigung für diese Sitzung.");
  if (meta.expiresAt <= now) throw new Error("Die Sitzung ist abgelaufen.");
  // Fachliche Regeln (erlaubter Übergang, Version, Fristberechnung) kommen aus dem Domain-Zustandsautomaten;
  // die DynamoDB-Bedingungen unten sichern dieselben Invarianten zusätzlich gegen Nebenläufigkeit ab.
  const next = transition(
    { status: meta.status, version: meta.version, questionIndex: meta.questionIndex, questionCount: meta.questionCount,
      opensAt: null, closesAt: null },
    request.expectedVersion,
    { type: meta.status === "LOBBY" ? "startQuestion" : "nextQuestion", durationSeconds: question.durationSeconds, now },
  );
  if (question.index !== next.questionIndex || next.opensAt === null || next.closesAt === null) {
    throw new Error("Diese Frage ist nicht der nächste Spielschritt.");
  }
  const timerId = randomUUID();
  const { opensAt, closesAt } = next;
  const deadlineAt = new Date(Math.ceil(closesAt / 1000) * 1000).toISOString();
  const timerPartition = `PENDING#${parseInt(timerId.slice(0, 2), 16) % 16}`;
  try {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: tableName, Key: metaKey,
        // Teilnehmendenzahl wird atomar beim Start übernommen (Snapshot), statt sie als Bedingung zu prüfen:
        // gleichzeitige Löschungen lassen den Start dadurch nicht mehr scheitern.
        UpdateExpression: "SET #status = :countdown, currentQuestionId = :question, questionIndex = :nextIndex, timerId = :timer, opensAt = :opensAt, closesAt = :closesAt, answerCount = :zero, eligibleParticipantCount = participantCount ADD #version :one",
        ConditionExpression: "#status = :previousStatus AND #version = :expectedVersion AND ownerId = :owner AND questionIndex = :previousIndex AND questionCount = :questionCount AND expiresAt > :now",
        ExpressionAttributeNames: { "#status": "status", "#version": "version" },
        ExpressionAttributeValues: { ":countdown": "COUNTDOWN", ":question": request.questionId,
          ":nextIndex": question.index, ":timer": timerId, ":opensAt": opensAt, ":closesAt": closesAt,
          ":zero": 0, ":one": 1, ":previousStatus": meta.status, ":expectedVersion": request.expectedVersion,
          ":owner": ownerId, ":previousIndex": meta.questionIndex, ":questionCount": meta.questionCount, ":now": now },
      } },
      { ConditionCheck: {
        TableName: tableName, Key: questionKey,
        ConditionExpression: "#index = :index AND durationSeconds = :duration",
        ExpressionAttributeNames: { "#index": "index" },
        ExpressionAttributeValues: { ":index": question.index, ":duration": question.durationSeconds },
      } },
      { Put: {
        TableName: tableName,
        Item: { pk, sk: `TIMER#${request.questionId}#${timerId}`, sessionId: request.sessionId,
          questionId: request.questionId, timerId, opensAt, closesAt, deadlineAt, status: "PENDING",
          attempt: 0, timerPartition, timerDeadline: undispatchedTimerDeadline(deadlineAt, timerId), ttl: Math.ceil(meta.expiresAt / 1000) },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      } },
    ] })));
  } catch (error) {
    if (isConditionalFailure(error)) {
      throw new Error("Der Spielstand hat sich zwischenzeitlich geändert. Die Ansicht wird aktualisiert – bitte erneut starten.");
    }
    throw error;
  }
  return { timerId, opensAt, closesAt, version: request.expectedVersion + 1 };
}
