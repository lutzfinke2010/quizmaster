import { z } from "zod";
import {
  GetCommand, QueryCommand, TransactGetCommand, TransactWriteCommand, UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { scoreAnswer } from "../domain/scoring";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";
import { TimerObsoleteError } from "./timerObsolete";
import { mapWithConcurrency } from "./batchGet";
import { advanceStreak, streakBonus } from "../domain/gamification";

/** Parallele Ergebnis-Transaktionen; hält ~1000 Teilnehmende deutlich unter dem Lambda-Timeout. */
const RESULT_WRITE_CONCURRENCY = 25;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const requestSchema = z.object({ sessionId: id, questionId: id, timerId: id }).strict();
const metaSchema = z.object({
  status: z.string(),
  currentQuestionId: id,
  timerId: id,
  opensAt: z.number().int(),
  closesAt: z.number().int(),
  expiresAt: z.number().int(),
  gamificationVersion: z.string().optional(),
  streakBonusEnabled: z.boolean().optional(),
  questionIndex: z.number().int().optional(),
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
  questionIndex: z.number().int().optional(), streak: z.number().int().optional(),
  maxStreak: z.number().int().optional(), streakBonusPoints: z.number().int().optional(),
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
  if (snapshot.meta.gamificationVersion && snapshot.meta.questionIndex === undefined) {
    throw new Error("Fragenindex für die Serienwertung fehlt.");
  }

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
  const histories = new Map<string, Array<z.infer<typeof resultSchema>>>();
  if (snapshot.meta.gamificationVersion) {
    let historyCursor: Record<string, unknown> | undefined;
    do {
      const page = await client.send(new QueryCommand({
        TableName: tableName, ConsistentRead: true,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": pk, ":prefix": "RESULT#" },
        ExclusiveStartKey: historyCursor,
      }));
      for (const item of page.Items ?? []) {
        const result = resultSchema.parse(item);
        if (result.questionIndex === undefined) throw new Error("Fragenindex im gespeicherten Serienergebnis fehlt.");
        if (result.questionIndex >= (snapshot.meta.questionIndex ?? 0)) continue;
        const participantId = id.parse(String(item.sk).split("#").at(-1));
        const history = histories.get(participantId) ?? [];
        history.push(result);
        histories.set(participantId, history);
      }
      historyCursor = page.LastEvaluatedKey;
    } while (historyCursor);
  }
  const scored = answers.map((answer) => {
    const participantId = id.parse(answer.sk.slice(prefix.length));
    const choice = distribution.find((entry) => entry.choiceId === answer.choiceId);
    if (!choice || answer.receivedAt < snapshot.meta.opensAt || answer.receivedAt >= snapshot.meta.closesAt) {
      throw new Error("Ungültiger gespeicherter Antwortdatensatz.");
    }
    choice.count++;
    return { participantId, answer };
  });
  // Jede Ergebnis-Transaktion ist idempotent (bedingtes Put + Vergleich bei Konflikt) und kann daher parallel laufen.
  // Bewusst ohne ConditionCheck auf META: parallele Transaktionen auf demselben Item würden sich gegenseitig mit
  // TransactionConflict abbrechen. Der SCORING-Zustand wurde oben geprüft; neue Antworten sind nach dem Schließen
  // ausgeschlossen, und der REVEAL-Übergang unten ist weiterhin an SCORING/Frage/Timer gebunden.
  await mapWithConcurrency(scored, RESULT_WRITE_CONCURRENCY, async ({ participantId, answer }) => {
    const correct = answer.choiceId === snapshot.question.correctChoiceId;
    const { points: answerPoints, elapsedMs } = scoreAnswer(
      correct, answer.receivedAt, snapshot.meta.opensAt, snapshot.meta.closesAt - snapshot.meta.opensAt,
    );
    let streak = 0;
    let maxStreak = 0;
    let lastIndex = -1;
    for (const previous of (histories.get(participantId) ?? []).sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0))) {
      if (previous.questionIndex !== lastIndex + 1) streak = 0;
      ({ streak, maxStreak } = advanceStreak(streak, maxStreak, previous.correct));
      lastIndex = previous.questionIndex ?? -1;
    }
    if (lastIndex !== (snapshot.meta.questionIndex ?? 0) - 1) streak = 0;
    ({ streak, maxStreak } = advanceStreak(streak, maxStreak, correct));
    const streakBonusPoints = streakBonus(streak, snapshot.meta.streakBonusEnabled === true);
    const points = answerPoints + streakBonusPoints;
    const tracked = Boolean(snapshot.meta.gamificationVersion);
    const result = { correct, points, elapsedMs, ...(tracked ? {
      questionIndex: snapshot.meta.questionIndex, streak, maxStreak, streakBonusPoints,
    } : {}) };
    const resultKey = { pk, sk: `RESULT#${request.questionId}#${participantId}` };
    try {
      await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
        { Put: {
          TableName: tableName, Item: { ...resultKey, ...result, ttl: Math.ceil(snapshot.meta.expiresAt / 1000) },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } },
        { Update: {
          TableName: tableName, Key: { pk, sk: `PARTICIPANT#${participantId}` },
          UpdateExpression: (tracked ? "SET streak = :streak, maxStreak = :maxStreak, lastAnsweredIndex = :index " : "") +
            "ADD totalPoints :points, correctAnswers :correct, correctElapsedMs :elapsed",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: {
            ":points": points, ":correct": correct ? 1 : 0, ":elapsed": correct ? elapsedMs : 0,
            ...(tracked ? { ":streak": streak, ":maxStreak": maxStreak, ":index": snapshot.meta.questionIndex } : {}),
          },
        } },
      ] })));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const existing = await client.send(new GetCommand({ TableName: tableName, Key: resultKey, ConsistentRead: true }));
      if (!existing.Item) throw error;
      const previous = resultSchema.parse(existing.Item);
      if (previous.correct !== result.correct || previous.points !== result.points || previous.elapsedMs !== result.elapsedMs ||
          (tracked && (previous.streak !== streak || previous.streakBonusPoints !== streakBonusPoints))) {
        throw new Error("Widersprüchliches Frageergebnis.");
      }
    }
  });

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
