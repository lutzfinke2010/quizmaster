import { z } from "zod";
import {
  GetCommand, QueryCommand, TransactGetCommand, TransactWriteCommand, UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { scoreAnswer } from "../domain/scoring";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";
import { TimerObsoleteError } from "./timerObsolete";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const requestSchema = z.object({ sessionId: id, questionId: id, timerId: id }).strict();
const metaSchema = z.object({
  status: z.string(),
  currentQuestionId: id,
  timerId: id,
  opensAt: z.number().int(),
  closesAt: z.number().int(),
  expiresAt: z.number().int(),
});
const questionSchema = z.object({
  answerIds: z.array(id).min(2).max(8),
  correctChoiceId: id,
  explanation: z.string().max(1000),
}).refine((value) => new Set(value.answerIds).size === value.answerIds.length &&
  value.answerIds.includes(value.correctChoiceId), "Ungültiger Fragen-Snapshot.");
const answerSchema = z.object({ sk: z.string(), choiceId: id, receivedAt: z.number().int() });
const resultSchema = z.object({
  correct: z.boolean(), points: z.number().int(), elapsedMs: z.number().int(),
});

export type FinalizeRequest = z.infer<typeof requestSchema>;

/**
 * Internal workflow entry point. The caller must be server-only and `now` must be
 * taken from a trusted server clock, not a request argument from a browser.
 */
export async function finalizeQuestion(
  client: DynamoDBDocumentClient,
  tableName: string,
  rawRequest: unknown,
  now: number,
): Promise<void> {
  const request = requestSchema.parse(rawRequest);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
  const pk = `SESSION#${request.sessionId}`;
  const metaKey = { pk, sk: "META" };
  const questionKey = { pk, sk: `QUESTION#${request.questionId}` };
  const matchNames = { "#status": "status", "#version": "version" };
  const matchValues = { ":question": request.questionId, ":timer": request.timerId };

  async function readSnapshot() {
    const response = await withTransactionConflictRetry(() => client.send(new TransactGetCommand({
      TransactItems: [
        { Get: { TableName: tableName, Key: metaKey } },
        { Get: { TableName: tableName, Key: questionKey } },
      ],
    })));
    if (!response.Responses?.[0]?.Item || !response.Responses[1]?.Item) {
      throw new TimerObsoleteError("Sitzung oder Fragen-Snapshot nicht gefunden.");
    }
    const meta = metaSchema.parse(response.Responses[0].Item);
    const question = questionSchema.parse(response.Responses[1].Item);
    if (meta.currentQuestionId !== request.questionId || meta.timerId !== request.timerId) {
      throw new TimerObsoleteError("Veralteter Timerauftrag.");
    }
    if (meta.expiresAt <= now || meta.status === "CANCELLED") throw new TimerObsoleteError("Sitzung ist beendet oder abgelaufen.");
    if (meta.closesAt <= meta.opensAt) throw new Error("Ungültige Fragefrist.");
    return { meta, question };
  }

  let snapshot = await readSnapshot();
  if (snapshot.meta.status === "REVEAL" || snapshot.meta.status === "LEADERBOARD" ||
      snapshot.meta.status === "FINISHED") return;
  if (snapshot.meta.status === "QUESTION_OPEN" || snapshot.meta.status === "COUNTDOWN") {
    if (now < snapshot.meta.closesAt) throw new Error("Die Fragefrist ist noch nicht abgelaufen.");
    try {
      await withTransactionConflictRetry(() => client.send(new UpdateCommand({
        TableName: tableName, Key: metaKey,
        UpdateExpression: "SET #status = :closed ADD #version :one",
        ConditionExpression: "(#status = :open OR #status = :countdown) AND currentQuestionId = :question AND timerId = :timer AND closesAt <= :now",
        ExpressionAttributeNames: matchNames,
        ExpressionAttributeValues: { ...matchValues, ":closed": "QUESTION_CLOSED", ":open": "QUESTION_OPEN",
          ":countdown": "COUNTDOWN", ":one": 1, ":now": now },
      })));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
    snapshot = await readSnapshot();
  }
  if (snapshot.meta.status === "QUESTION_CLOSED") {
    try {
      await withTransactionConflictRetry(() => client.send(new UpdateCommand({
        TableName: tableName, Key: metaKey,
        UpdateExpression: "SET #status = :scoring ADD #version :one",
        ConditionExpression: "#status = :closed AND currentQuestionId = :question AND timerId = :timer",
        ExpressionAttributeNames: matchNames,
        ExpressionAttributeValues: { ...matchValues, ":closed": "QUESTION_CLOSED", ":scoring": "SCORING", ":one": 1 },
      })));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
    snapshot = await readSnapshot();
  }
  if (snapshot.meta.status === "REVEAL" || snapshot.meta.status === "LEADERBOARD" ||
      snapshot.meta.status === "FINISHED") return;
  if (snapshot.meta.status !== "SCORING") throw new Error("Die Frage kann nicht ausgewertet werden.");

  const prefix = `ANSWER#${request.questionId}#`;
  const answers: Array<z.infer<typeof answerSchema>> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
      ExclusiveStartKey: cursor,
    }));
    answers.push(...(page.Items ?? []).map((item) => answerSchema.parse(item)));
    cursor = page.LastEvaluatedKey;
  } while (cursor);

  const distribution = snapshot.question.answerIds.map((choiceId) => ({ choiceId, count: 0 }));
  for (const answer of answers) {
    const participantId = id.parse(answer.sk.slice(prefix.length));
    const choice = distribution.find((entry) => entry.choiceId === answer.choiceId);
    if (!choice || answer.receivedAt < snapshot.meta.opensAt || answer.receivedAt >= snapshot.meta.closesAt) {
      throw new Error("Ungültiger gespeicherter Antwortdatensatz.");
    }
    choice.count++;
    const correct = answer.choiceId === snapshot.question.correctChoiceId;
    const { points, elapsedMs } = scoreAnswer(
      correct, answer.receivedAt, snapshot.meta.opensAt, snapshot.meta.closesAt - snapshot.meta.opensAt,
    );
    const result = { correct, points, elapsedMs };
    const resultKey = { pk, sk: `RESULT#${request.questionId}#${participantId}` };
    try {
      await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: {
          TableName: tableName, Key: metaKey,
          ConditionExpression: "#status = :scoring AND currentQuestionId = :question AND timerId = :timer",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ...matchValues, ":scoring": "SCORING" },
        } },
        { Put: {
          TableName: tableName, Item: { ...resultKey, ...result, ttl: Math.ceil(snapshot.meta.expiresAt / 1000) },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Update: {
          TableName: tableName, Key: { pk, sk: `PARTICIPANT#${participantId}` },
          UpdateExpression: "ADD totalPoints :points, correctAnswers :correct, correctElapsedMs :elapsed",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: {
            ":points": points, ":correct": correct ? 1 : 0, ":elapsed": correct ? elapsedMs : 0,
          },
        } },
      ] })));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const existing = await client.send(new GetCommand({ TableName: tableName, Key: resultKey, ConsistentRead: true }));
      if (!existing.Item) throw error;
      const previous = resultSchema.parse(existing.Item);
      if (previous.correct !== result.correct || previous.points !== result.points || previous.elapsedMs !== result.elapsedMs) {
        throw new Error("Widersprüchliches Frageergebnis.");
      }
    }
  }

  try {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: tableName, Key: metaKey,
        UpdateExpression: "SET #status = :reveal ADD #version :one",
        ConditionExpression: "#status = :scoring AND currentQuestionId = :question AND timerId = :timer",
        ExpressionAttributeNames: matchNames,
        ExpressionAttributeValues: { ...matchValues, ":scoring": "SCORING", ":reveal": "REVEAL", ":one": 1 },
      } },
      { Put: {
        TableName: tableName,
        Item: { pk, sk: `REVEAL#${request.questionId}`, correctChoiceId: snapshot.question.correctChoiceId,
          explanation: snapshot.question.explanation, distribution, ttl: Math.ceil(snapshot.meta.expiresAt / 1000) },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      } },
    ] })));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const after = await readSnapshot();
    if (after.meta.status !== "REVEAL" && after.meta.status !== "LEADERBOARD" && after.meta.status !== "FINISHED") {
      throw error;
    }
  }
}
