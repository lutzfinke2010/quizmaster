import { createHash } from "node:crypto";
import { z } from "zod";
import { GetCommand, QueryCommand, TransactGetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { rankScores } from "../domain/scoring";
import { getMyParticipation, type Participation } from "./participation";
import { withTransactionConflictRetry } from "./transactionRetry";
import { requireQuizmaster } from "./adminPrincipal";
import { earnedBadges } from "../domain/gamification";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const metaSchema = z.object({
  status: z.enum(["LOBBY", "COUNTDOWN", "QUESTION_OPEN", "QUESTION_CLOSED", "SCORING", "REVEAL", "LEADERBOARD", "FINISHED", "CANCELLED"]),
  title: z.string(), version: z.number().int(), questionIndex: z.number().int(), questionCount: z.number().int(),
  participantCount: z.number().int(), expiresAt: z.number().int(), currentQuestionId: id.nullish(),
  opensAt: z.number().nullish(), closesAt: z.number().nullish(), answerCount: z.number().int().nullish(),
  eligibleParticipantCount: z.number().int().nullish(),
  joinCode: z.string().regex(/^\d{6}$/).optional(),
  streakBonusEnabled: z.boolean().optional(),
});
const questionSchema = z.object({
  text: z.string(), answers: z.array(z.object({ id, text: z.string() })).min(2).max(8),
});
const revealSchema = z.object({
  correctChoiceId: id, explanation: z.string(),
  distribution: z.array(z.object({ choiceId: id, count: z.number().int().min(0) })),
});
const participantSchema = z.object({
  participantId: id, displayName: z.string(), avatarId: z.string(),
  totalPoints: z.number().int().min(0), correctAnswers: z.number().int().min(0), correctElapsedMs: z.number().int().min(0),
  streak: z.number().int().nonnegative().optional(), maxStreak: z.number().int().nonnegative().optional(),
  lastAnsweredIndex: z.number().int().optional(),
});
const rankingResultSchema = z.object({
  sk: z.string(), correct: z.boolean(), points: z.number().int().min(0), elapsedMs: z.number().int().min(0),
});

type Authorization =
  | { kind: "participant"; identityId: string; participantId: string }
  | { kind: "presentation"; tokenHash: string }
  | { kind: "admin"; ownerId: string };

async function authorizedSnapshot(
  client: DynamoDBDocumentClient, tableName: string, sessionId: string, authorization: Authorization, now: number,
) {
  const pk = `SESSION#${sessionId}`;
  if (authorization.kind === "admin") {
    const result = await client.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true }));
    if (!result.Item || result.Item.ownerId !== authorization.ownerId) throw new Error("Keine gültige Berechtigung.");
    const meta = metaSchema.parse(result.Item);
    if (meta.expiresAt <= now) throw new Error("Keine gültige Berechtigung.");
    return meta;
  }
  const authKey = authorization.kind === "participant"
    ? { pk, sk: `IDENTITY#${authorization.identityId}` }
    : { pk: `PRESENT#${authorization.tokenHash}`, sk: "META" };
  const result = await withTransactionConflictRetry(() => client.send(new TransactGetCommand({ TransactItems: [
    { Get: { TableName: tableName, Key: { pk, sk: "META" } } },
    { Get: { TableName: tableName, Key: authKey } },
  ] })));
  if (!result.Responses?.[0]?.Item || !result.Responses[1]?.Item) throw new Error("Keine gültige Berechtigung.");
  const meta = metaSchema.parse(result.Responses[0].Item);
  const access = result.Responses[1].Item;
  if (meta.expiresAt <= now ||
      (authorization.kind === "participant" && access.participantId !== authorization.participantId) ||
      (authorization.kind === "presentation" && (access.sessionId !== sessionId ||
        typeof access.expiresAt !== "number" || access.expiresAt <= now))) {
    throw new Error("Keine gültige Berechtigung.");
  }
  return meta;
}

async function participants(client: DynamoDBDocumentClient, tableName: string, pk: string) {
  const items: Array<z.infer<typeof participantSchema>> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": "PARTICIPANT#" },
      ExclusiveStartKey: cursor,
    }));
    items.push(...(page.Items ?? []).filter((item) => item.removed !== true).map((item) => participantSchema.parse(item)));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function renderGameState(
  client: DynamoDBDocumentClient, tableName: string, sessionId: string, authorization: Authorization, now: number,
) {
  const pk = `SESSION#${sessionId}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const meta = await authorizedSnapshot(client, tableName, sessionId, authorization, now);
    let question: z.infer<typeof questionSchema> | null = null;
    let reveal: z.infer<typeof revealSchema> | null = null;
    if (meta.currentQuestionId && !["LOBBY", "CANCELLED"].includes(meta.status)) {
      const item = await client.send(new GetCommand({
        TableName: tableName, Key: { pk, sk: `QUESTION#${meta.currentQuestionId}` }, ConsistentRead: true,
      }));
      if (!item.Item) throw new Error("Fragen-Snapshot nicht gefunden.");
      question = questionSchema.parse(item.Item);
      if (["REVEAL", "LEADERBOARD", "FINISHED"].includes(meta.status)) {
        const published = await client.send(new GetCommand({
          TableName: tableName, Key: { pk, sk: `REVEAL#${meta.currentQuestionId}` }, ConsistentRead: true,
        }));
        if (!published.Item) throw new Error("Freigegebene Auflösung nicht gefunden.");
        reveal = revealSchema.parse(published.Item);
      }
    }
    const showRanking = ["LEADERBOARD", "FINISHED"].includes(meta.status) ||
      (meta.status === "REVEAL" && authorization.kind === "presentation");
    const people = meta.status === "LOBBY" || showRanking
      ? await participants(client, tableName, pk) : [];
    const results: Array<z.infer<typeof rankingResultSchema>> = [];
    if (meta.currentQuestionId && showRanking) {
      let cursor: Record<string, unknown> | undefined;
      do {
        const page = await client.send(new QueryCommand({
          TableName: tableName, ConsistentRead: true, KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":pk": pk, ":prefix": `RESULT#${meta.currentQuestionId}#` },
          ExclusiveStartKey: cursor,
        }));
        results.push(...(page.Items ?? []).map((item) => rankingResultSchema.parse(item)));
        cursor = page.LastEvaluatedKey;
      } while (cursor);
    }
    const latest = await authorizedSnapshot(client, tableName, sessionId, authorization, now);
    if (latest.version !== meta.version || latest.status !== meta.status ||
        latest.currentQuestionId !== meta.currentQuestionId) continue;
    const previousScores = rankScores(people.map((person) => {
      const result = results.find((item) => item.sk === `RESULT#${meta.currentQuestionId}#${person.participantId}`);
      const score = { participantId: person.participantId, points: person.totalPoints - (result?.points ?? 0),
        correctAnswers: person.correctAnswers - (result?.correct ? 1 : 0),
        correctElapsedMs: person.correctElapsedMs - (result?.correct ? result.elapsedMs : 0) };
      if (score.points < 0 || score.correctAnswers < 0 || score.correctElapsedMs < 0) {
        throw new Error("Vorheriger Punktestand ist inkonsistent.");
      }
      return score;
    }));
    const leaderboard = showRanking
      ? rankScores(people.map((person) => ({ participantId: person.participantId, points: person.totalPoints,
        correctAnswers: person.correctAnswers, correctElapsedMs: person.correctElapsedMs })))
        .map((score) => {
          const person = people.find((item) => item.participantId === score.participantId);
          if (!person) throw new Error("Teilnahme für Rangliste nicht gefunden.");
          const previous = previousScores.find((item) => item.participantId === score.participantId);
          if (!previous) throw new Error("Vorheriger Rang nicht gefunden.");
          return { ...score, displayName: person.displayName, avatarId: person.avatarId,
            streak: person.lastAnsweredIndex === meta.questionIndex ? person.streak ?? 0 : 0,
            maxStreak: person.maxStreak ?? 0,
            badges: earnedBadges(person.correctAnswers, person.maxStreak ?? 0,
              meta.status === "FINISHED" && person.correctAnswers === meta.questionCount),
            previousPoints: previous.points,
            previousRank: previous.rank, rankChange: previous.rank - score.rank };
        }).slice(0, meta.status === "REVEAL" ? 5 : undefined) : [];
    if (authorization.kind === "presentation" && meta.status === "LOBBY" && !meta.joinCode) {
      throw new Error("Spielcode nicht gefunden.");
    }
    return {
      sessionId, status: meta.status, version: meta.version, title: meta.title,
      streakBonusEnabled: meta.streakBonusEnabled ?? false,
      joinCode: authorization.kind === "presentation" && meta.status === "LOBBY" ? meta.joinCode : null,
      questionIndex: meta.questionIndex, questionCount: meta.questionCount,
      questionId: meta.currentQuestionId ?? null,
      participantCount: meta.participantCount, opensAt: meta.opensAt ?? null, closesAt: meta.closesAt ?? null,
      answerCount: meta.answerCount ?? 0, eligibleParticipantCount: meta.eligibleParticipantCount ?? 0,
      serverTime: now, question, reveal, leaderboard,
      participants: meta.status === "LOBBY" ? people.map(({ participantId, displayName, avatarId }) =>
        ({ participantId, displayName, avatarId })) : [],
    };
  }
  throw new Error("Der Spielstand wurde gleichzeitig geändert. Bitte erneut versuchen.");
}

export async function getGameState(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, identityId: string, now: number,
) {
  const sessionId = id.parse(rawSessionId);
  const membership: Participation = await getMyParticipation(client, tableName, sessionId, identityId, now);
  return renderGameState(client, tableName, sessionId,
    { kind: "participant", identityId, participantId: membership.participantId }, now);
}

export async function getAdminGameState(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, principal: unknown, now: number,
) {
  const sessionId = id.parse(rawSessionId);
  const ownerId = requireQuizmaster(principal);
  return renderGameState(client, tableName, sessionId, { kind: "admin", ownerId }, now);
}

export async function getPresentationState(
  client: DynamoDBDocumentClient, tableName: string, rawToken: unknown, now: number,
) {
  const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(rawToken);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await client.send(new GetCommand({
    TableName: tableName, Key: { pk: `PRESENT#${tokenHash}`, sk: "META" }, ConsistentRead: true,
  }));
  const mapping = z.object({ sessionId: id, expiresAt: z.number().int() }).safeParse(record.Item);
  if (!mapping.success || mapping.data.expiresAt <= now) throw new Error("Präsentationslink ungültig oder abgelaufen.");
  return renderGameState(client, tableName, mapping.data.sessionId, { kind: "presentation", tokenHash }, now);
}

export async function getMyResult(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, identityId: string, now: number,
) {
  const sessionId = id.parse(rawSessionId);
  const participation = await getMyParticipation(client, tableName, sessionId, identityId, now);
  const authorization: Authorization = { kind: "participant", identityId, participantId: participation.participantId };
  const meta = await authorizedSnapshot(client, tableName, sessionId, authorization, now);
  if (!meta.currentQuestionId || !["REVEAL", "LEADERBOARD", "FINISHED"].includes(meta.status)) {
    throw new Error("Das Ergebnis ist noch nicht freigegeben.");
  }

  const response = await client.send(new GetCommand({
    TableName: tableName, Key: { pk: `SESSION#${sessionId}`, sk: `RESULT#${meta.currentQuestionId}#${participation.participantId}` },
    ConsistentRead: true,
  }));
  const result = response.Item ? z.object({
    correct: z.boolean(), points: z.number().int().min(0), elapsedMs: z.number().int().min(0),
    streakBonusPoints: z.number().int().nonnegative().optional(),
  }).parse(response.Item) : null;
  if (!result) {
    const answer = await client.send(new GetCommand({
      TableName: tableName,
      Key: { pk: `SESSION#${sessionId}`, sk: `ANSWER#${meta.currentQuestionId}#${participation.participantId}` },
      ConsistentRead: true,
    }));
    if (answer.Item) throw new Error("Die Auswertung ist unvollständig.");
  }
  const person = await client.send(new GetCommand({
    TableName: tableName, Key: { pk: `SESSION#${sessionId}`, sk: `PARTICIPANT#${participation.participantId}` },
    ConsistentRead: true,
  }));
  const own = z.object({ totalPoints: z.number().int().min(0),
    correctAnswers: z.number().int().nonnegative().optional(), streak: z.number().int().nonnegative().optional(),
    maxStreak: z.number().int().nonnegative().optional(), lastAnsweredIndex: z.number().int().optional(),
  }).parse(person.Item);
  const latest = await authorizedSnapshot(client, tableName, sessionId, authorization, now);
  if (latest.version !== meta.version || latest.currentQuestionId !== meta.currentQuestionId || latest.status !== meta.status) {
    throw new Error("Der Spielstand wurde gleichzeitig geändert. Bitte erneut versuchen.");
  }
  return { questionId: meta.currentQuestionId, answered: result !== null,
    correct: result?.correct ?? false, points: result?.points ?? 0, totalPoints: own.totalPoints, elapsedMs: result?.elapsedMs ?? null,
    streakBonusPoints: result?.streakBonusPoints ?? 0,
    streak: own.lastAnsweredIndex === meta.questionIndex ? own.streak ?? 0 : 0,
    maxStreak: own.maxStreak ?? 0,
    badges: earnedBadges(own.correctAnswers ?? 0, own.maxStreak ?? 0,
      meta.status === "FINISHED" && own.correctAnswers === meta.questionCount) };
}

export async function getMyAnswer(
  client: DynamoDBDocumentClient, tableName: string, rawSessionId: unknown, identityId: string, now: number,
) {
  const sessionId = id.parse(rawSessionId);
  const participation = await getMyParticipation(client, tableName, sessionId, identityId, now);
  const authorization: Authorization = { kind: "participant", identityId, participantId: participation.participantId };
  for (let attempt = 0; attempt < 4; attempt++) {
    const meta = await authorizedSnapshot(client, tableName, sessionId, authorization, now);
    if (!meta.currentQuestionId) return { questionId: null, choiceId: null };
    const response = await client.send(new GetCommand({
      TableName: tableName,
      Key: { pk: `SESSION#${sessionId}`, sk: `ANSWER#${meta.currentQuestionId}#${participation.participantId}` },
      ConsistentRead: true,
    }));
    const answer = response.Item ? z.object({ choiceId: id }).parse(response.Item) : null;
    const latest = await authorizedSnapshot(client, tableName, sessionId, authorization, now);
    if (latest.version !== meta.version || latest.status !== meta.status ||
        latest.currentQuestionId !== meta.currentQuestionId) continue;
    return { questionId: meta.currentQuestionId, choiceId: answer?.choiceId ?? null };
  }
  throw new Error("Die Antwort wurde gleichzeitig geändert. Bitte erneut versuchen.");
}
