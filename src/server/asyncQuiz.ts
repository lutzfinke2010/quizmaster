import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  BatchWriteCommand, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand,
  type BatchWriteWriteRequest, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import avatars from "../domain/avatars.json";
import { requireQuizmaster } from "./adminPrincipal";
import { avatarIds, chooseAvatar, displayNameFor } from "./participation";
import { QuizStore } from "./quizStore";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";

const uuidSchema = z.string().uuid();
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const identitySchema = z.string().min(1).max(128);
const avatarLabels = new Map(avatars.avatars.map(({ id, label }) => [id, label]));
const zoneSchema = z.string().min(1).max(100);
const questionSchema = z.object({
  text: z.string().min(1).max(500),
  answers: z.array(z.object({ text: z.string().min(1).max(200), correct: z.boolean() })).min(2).max(8)
    .refine((answers) => answers.filter((answer) => answer.correct).length === 1),
  durationSeconds: z.number().int().min(5).max(120),
  explanation: z.string().max(1000),
});
const snapshotSchema = z.object({
  title: z.string().min(1).max(120), description: z.string().max(500),
  questions: z.array(questionSchema).min(1).max(100),
});
const publicationSchema = z.object({
  publicationId: uuidSchema,
  ownerId: z.string().min(1).max(128),
  quizId: uuidSchema,
  title: z.string().min(1).max(120),
  snapshot: snapshotSchema,
  status: z.enum(["ACTIVE", "ENDED"]),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  timeZone: zoneSchema,
  endedAt: z.number().int().positive().optional(),
  retentionAt: z.number().int().positive(),
  retentionDays: z.number().int().min(1).max(365),
  maxParticipants: z.number().int().min(1).max(1000),
  startedCount: z.number().int().nonnegative(),
  retentionSyncedTtl: z.number().int().optional(),
});
type Publication = z.infer<typeof publicationSchema>;

const answerRecordSchema = z.object({
  questionIndex: z.number().int().nonnegative(), choiceId: z.string().regex(/^a[0-7]$/),
  acceptedAt: z.number().int().positive(),
});
const attemptSchema = z.object({
  identityHash: z.string().regex(/^[a-f0-9]{64}$/),
  displayName: z.string().min(1).max(80),
  avatarId: z.string().min(1).max(100),
  startedAt: z.number().int().positive(),
  answeredCount: z.number().int().nonnegative(),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  completedAt: z.number().int().positive().optional(),
});
type Attempt = z.infer<typeof attemptSchema>;


function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertTime(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
}

function publicationKey(publicationId: string) {
  return { pk: `ASYNC#${publicationId}`, sk: "META" };
}

function asPublication(item: unknown): Publication {
  return publicationSchema.parse(item);
}

async function getPublication(
  client: DynamoDBDocumentClient, tableName: string, publicationId: string, now: number,
): Promise<Publication> {
  const result = await client.send(new GetCommand({
    TableName: tableName, Key: publicationKey(publicationId), ConsistentRead: true,
  }));
  if (!result.Item) throw new Error("Veröffentlichung nicht gefunden oder nicht mehr verfügbar.");
  const publication = asPublication(result.Item);
  if (publication.retentionAt <= now) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
  return publication;
}

function statusOf(publication: Publication, now: number): "ACTIVE" | "ENDED" | "EXPIRED" {
  if (publication.status === "ENDED") return "ENDED";
  return now >= publication.expiresAt ? "EXPIRED" : "ACTIVE";
}

function metadata(publication: Publication, now: number) {
  const status = statusOf(publication, now);
  return {
    title: publication.title,
    description: publication.snapshot.description,
    questionCount: publication.snapshot.questions.length,
    expiresAt: publication.expiresAt,
    timeZone: publication.timeZone,
    status,
    retentionAt: publication.retentionAt,
    endedAt: publication.endedAt ?? (status === "EXPIRED" ? publication.expiresAt : null),
    maxParticipants: publication.maxParticipants,
    serverTime: now,
  };
}

export async function publishAsyncQuiz(
  client: DynamoDBDocumentClient,
  tableName: string,
  raw: unknown,
  principal: unknown,
  retentionDays: number,
  maxParticipants: number,
  now: number,
): Promise<{ publicationId: string; token: string; expiresAt: number; timeZone: string; retentionDays: number; maxParticipants: number }> {
  const ownerId = requireQuizmaster(principal);
  const input = z.object({
    quizId: uuidSchema,
    requestId: uuidSchema,
    expiresAt: z.number().int().positive(),
    timeZone: zoneSchema,
  }).strict().parse(raw);
  z.number().int().min(1).max(365).parse(retentionDays);
  z.number().int().min(1).max(1000).parse(maxParticipants);
  assertTime(now);
  const ownerPk = `OWNER#${ownerId}`;
  const requestKey = { pk: ownerPk, sk: `ASYNC_REQUEST#${input.requestId}` };
  const requestHash = hash(JSON.stringify({
    quizId: input.quizId, expiresAt: input.expiresAt, timeZone: input.timeZone,
  }));
  const existing = await client.send(new GetCommand({ TableName: tableName, Key: requestKey, ConsistentRead: true }));
  if (existing.Item) {
    const saved = z.object({ publicationId: uuidSchema, token: tokenSchema, expiresAt: z.number().int(),
      timeZone: zoneSchema, retentionAt: z.number().int(), retentionDays: z.number().int(), maxParticipants: z.number().int(),
      requestHash: z.string() }).parse(existing.Item);
    if (saved.requestHash !== requestHash) throw new Error("Diese Vorgangsidentität wurde bereits für eine andere Veröffentlichung verwendet.");
    if (saved.retentionAt <= Date.now()) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
    return { publicationId: saved.publicationId, token: saved.token, expiresAt: saved.expiresAt,
      timeZone: saved.timeZone, retentionDays: saved.retentionDays, maxParticipants: saved.maxParticipants };
  }
  if (input.expiresAt <= now) throw new Error("Das Ablaufdatum muss in der Zukunft liegen.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.timeZone }).format(now);
  } catch {
    throw new Error("Die angegebene Zeitzone ist ungültig.");
  }

  const { quiz } = await new QuizStore(client, tableName).getQuiz(principal, input.quizId);
  const snapshot = snapshotSchema.parse(structuredClone(quiz));
  const createdAt = Date.now();
  if (input.expiresAt <= createdAt) throw new Error("Das Ablaufdatum muss in der Zukunft liegen.");
  const publicationId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hash(token);
  const retentionAt = input.expiresAt + retentionDays * 86_400_000;
  if (!Number.isSafeInteger(retentionAt)) throw new Error("Ungültiger Aufbewahrungszeitpunkt.");
  const publication: Publication = {
    publicationId, ownerId, quizId: input.quizId, title: snapshot.title, snapshot,
    status: "ACTIVE", tokenHash, createdAt, expiresAt: input.expiresAt, timeZone: input.timeZone,
    retentionAt, retentionDays, maxParticipants, startedCount: 0,
  };
  const idempotency = { ...requestKey, publicationId, token, expiresAt: input.expiresAt, timeZone: input.timeZone,
    retentionAt, retentionDays, maxParticipants, requestHash,
    ttl: Math.ceil(retentionAt / 1000) };
  try {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: { ...publicationKey(publicationId), ...publication,
        ttl: Math.ceil(retentionAt / 1000) },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
      { Put: { TableName: tableName, Item: { pk: ownerPk, sk: `ASYNC#${String(createdAt).padStart(16, "0")}#${publicationId}`,
        publicationId, createdAt, token, retentionAt, ttl: Math.ceil(retentionAt / 1000) },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
      { Put: { TableName: tableName, Item: idempotency,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
      { Put: { TableName: tableName, Item: { pk: `ASYNC_TOKEN#${tokenHash}`, sk: "META", publicationId,
        ttl: Math.ceil(retentionAt / 1000) },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
    ] })));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const retry = await client.send(new GetCommand({ TableName: tableName, Key: requestKey, ConsistentRead: true }));
    if (!retry.Item) throw error;
    const saved = z.object({ publicationId: uuidSchema, token: tokenSchema, expiresAt: z.number().int(),
      timeZone: zoneSchema, retentionAt: z.number().int(), retentionDays: z.number().int(), maxParticipants: z.number().int(),
      requestHash: z.string() }).parse(retry.Item);
    if (saved.requestHash !== requestHash) throw new Error("Diese Vorgangsidentität wurde bereits für eine andere Veröffentlichung verwendet.");
    if (saved.retentionAt <= Date.now()) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
    return { publicationId: saved.publicationId, token: saved.token, expiresAt: saved.expiresAt,
      timeZone: saved.timeZone, retentionDays: saved.retentionDays, maxParticipants: saved.maxParticipants };
  }
  return { publicationId, token, expiresAt: input.expiresAt, timeZone: input.timeZone, retentionDays, maxParticipants };
}

async function resolveToken(
  client: DynamoDBDocumentClient, tableName: string, rawToken: unknown, now: number,
): Promise<Publication> {
  const token = tokenSchema.parse(rawToken);
  const tokenHash = hash(token);
  const pointer = await client.send(new GetCommand({
    TableName: tableName, Key: { pk: `ASYNC_TOKEN#${tokenHash}`, sk: "META" }, ConsistentRead: true,
  }));
  const publicationId = z.string().uuid().safeParse(pointer.Item?.publicationId);
  if (!publicationId.success) throw new Error("Der Teilnahmelink ist ungültig oder nicht mehr verfügbar.");
  const publication = await getPublication(client, tableName, publicationId.data, now);
  if (publication.tokenHash !== tokenHash) throw new Error("Der Teilnahmelink ist ungültig oder nicht mehr verfügbar.");
  return publication;
}

export async function getAsyncPublicInfo(
  client: DynamoDBDocumentClient, tableName: string, token: unknown, now: number,
) {
  assertTime(now);
  const publication = await resolveToken(client, tableName, token, now);
  const serverTime = Date.now();
  if (publication.retentionAt <= serverTime) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
  return metadata(publication, serverTime);
}

function identityHash(identityId: string): string {
  identitySchema.parse(identityId);
  return hash(identityId);
}

async function getAttempt(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, identityId: string,
): Promise<Attempt | null> {
  const identity = identityHash(identityId);
  const result = await client.send(new GetCommand({
    TableName: tableName, Key: { pk: `ASYNC#${publication.publicationId}`, sk: `ATTEMPT#${identity}` },
    ConsistentRead: true,
  }));
  return result.Item ? attemptSchema.parse(result.Item) : null;
}

async function listAttemptAnswers(
  client: DynamoDBDocumentClient, tableName: string, publicationId: string, identity: string,
): Promise<z.infer<typeof answerRecordSchema>[]> {
  const result = await client.send(new QueryCommand({
    TableName: tableName, ConsistentRead: true,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `ASYNC#${publicationId}`, ":prefix": `ANSWER#${identity}#` },
  }));
  return (result.Items ?? []).map((item) => answerRecordSchema.parse(item))
    .sort((left, right) => left.questionIndex - right.questionIndex);
}

function guestState(publication: Publication, attempt: Attempt, answers: z.infer<typeof answerRecordSchema>[], now: number) {
  const roundStatus = statusOf(publication, now);
  const complete = attempt.answeredCount === publication.snapshot.questions.length;
  const nextIndex = complete ? -1 : attempt.answeredCount;
  const question = roundStatus === "ACTIVE" && nextIndex >= 0
    ? publication.snapshot.questions[nextIndex] : null;
  const resultAvailable = roundStatus !== "ACTIVE";
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionIndex, answer]));
  return {
    ...metadata(publication, now),
    displayName: attempt.displayName,
    avatarId: attempt.avatarId,
    startedAt: attempt.startedAt,
    answeredCount: attempt.answeredCount,
    attemptStatus: complete ? "COMPLETED" : roundStatus === "ACTIVE" ? "IN_PROGRESS" : "EXPIRED_PARTIAL",
    nextQuestionIndex: nextIndex,
    answers: answers.map((answer) => {
      const question = publication.snapshot.questions[answer.questionIndex];
      const correctChoiceId = `a${question.answers.findIndex((choice) => choice.correct)}`;
      const selectedChoice = question.answers[Number(answer.choiceId.slice(1))];
      const correctChoice = question.answers[Number(correctChoiceId.slice(1))];
      return {
        questionIndex: answer.questionIndex, choiceId: answer.choiceId, acceptedAt: answer.acceptedAt,
        correct: resultAvailable ? answer.choiceId === correctChoiceId : null,
        correctChoiceId: resultAvailable ? correctChoiceId : null,
        explanation: resultAvailable ? question.explanation : null,
        questionText: resultAvailable ? question.text : null,
        selectedText: resultAvailable ? selectedChoice.text : null,
        correctText: resultAvailable ? correctChoice.text : null,
      };
    }),
    question: question ? {
      questionIndex: nextIndex,
      text: question.text,
      answers: question.answers.map((answer, index) => ({ id: `a${index}`, text: answer.text })),
    } : null,
    points: resultAvailable ? answers.reduce((sum, answer) => {
      const question = publication.snapshot.questions[answer.questionIndex];
      return sum + (answer.choiceId === `a${question.answers.findIndex((choice) => choice.correct)}` ? 1 : 0);
    }, 0) : null,
    results: resultAvailable ? publication.snapshot.questions.map((resultQuestion, questionIndex) => {
      const answer = answerByQuestion.get(questionIndex);
      const correctIndex = resultQuestion.answers.findIndex((choice) => choice.correct);
      const selectedIndex = answer ? Number(answer.choiceId.slice(1)) : -1;
      return {
        questionIndex,
        questionText: resultQuestion.text,
        answered: Boolean(answer),
        selectedText: answer ? resultQuestion.answers[selectedIndex].text : null,
        correctText: resultQuestion.answers[correctIndex].text,
        correct: answer ? selectedIndex === correctIndex : null,
        explanation: resultQuestion.explanation,
        acceptedAt: answer?.acceptedAt ?? null,
      };
    }) : [],
  };
}

export async function startAsyncQuiz(
  client: DynamoDBDocumentClient, tableName: string, token: unknown, identityId: string, now: number,
) {
  assertTime(now);
  const publication = await resolveToken(client, tableName, token, now);
  const identity = identityHash(identityId);
  let attempt = await getAttempt(client, tableName, publication, identityId);
  if (!attempt) {
    if (statusOf(publication, now) !== "ACTIVE") throw new Error("Diese Quizrunde ist beendet. Ein neuer Versuch ist nicht mehr möglich.");
    for (let profileAttempt = 0; profileAttempt < 100; profileAttempt++) {
      const currentAttempts = await queryAll(client, tableName, `ASYNC#${publication.publicationId}`, "ATTEMPT#");
      const counts = new Map(avatarIds.map((id) => [id, 0]));
      const usedNames = new Set<string>();
      for (const record of currentAttempts) {
        const parsed = attemptSchema.parse(record);
        counts.set(parsed.avatarId, (counts.get(parsed.avatarId) ?? 0) + 1);
        usedNames.add(parsed.displayName);
      }
      const avatar = chooseAvatar(counts);
      const label = avatarLabels.get(avatar.id);
      if (!label) throw new Error("Avatar fehlt im lokalen Katalog.");
      const baseName = displayNameFor(label);
      const displayName = usedNames.has(baseName) ? `${baseName} ${randomInt(10, 1000)}` : baseName;
      const startedAt = Date.now();
      if (startedAt >= publication.expiresAt) throw new Error("Diese Quizrunde ist beendet. Ein neuer Versuch ist nicht mehr möglich.");
      const item: Attempt = {
        identityHash: identity, displayName, avatarId: avatar.id, startedAt, answeredCount: 0, status: "IN_PROGRESS",
      };
      const ttl = Math.ceil(publication.retentionAt / 1000);
      try {
        const writes = [
          { Put: { TableName: tableName,
            Item: { pk: `ASYNC#${publication.publicationId}`, sk: `ATTEMPT#${identity}`, ...item, ttl },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
          { Put: { TableName: tableName, Item: { pk: `ASYNC#${publication.publicationId}`, sk: `NAME#${displayName}`, identity, ttl },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
          { Update: { TableName: tableName, Key: publicationKey(publication.publicationId),
            UpdateExpression: "ADD startedCount :one",
            ConditionExpression: "#status = :active AND expiresAt > :now AND startedCount < #maxParticipants",
            ExpressionAttributeNames: { "#status": "status", "#maxParticipants": "maxParticipants" },
            ExpressionAttributeValues: { ":one": 1, ":active": "ACTIVE", ":now": startedAt } } },
        ];
        if (avatar.reserve) writes.push({ Put: {
          TableName: tableName, Item: { pk: `ASYNC#${publication.publicationId}`, sk: `AVATAR#${avatar.id}`, identity, ttl },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        } });
        await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: writes })));
        attempt = item;
        break;
      } catch (error) {
        if (!isConditionalFailure(error)) throw error;
        attempt = await getAttempt(client, tableName, publication, identityId);
        if (attempt) break;
        const current = await getPublication(client, tableName, publication.publicationId, Date.now());
        if (current.startedCount >= current.maxParticipants) throw new Error("Diese Quizrunde hat die maximale Teilnehmerzahl erreicht.");
        if (statusOf(current, Date.now()) !== "ACTIVE") {
          throw new Error("Das Quiz wurde beendet oder der Versuch konnte nicht gestartet werden.");
        }
      }
    }
    if (!attempt) throw new Error("Es konnte kein eindeutiger Spielname vergeben werden.");
  }
  const answers = await listAttemptAnswers(client, tableName, publication.publicationId, identity);
  return guestState(publication, attempt, answers, Date.now());
}

export async function getMyAsyncState(
  client: DynamoDBDocumentClient, tableName: string, token: unknown, identityId: string, now: number,
) {
  assertTime(now);
  const publication = await resolveToken(client, tableName, token, now);
  const identity = identityHash(identityId);
  const attempt = await getAttempt(client, tableName, publication, identityId);
  if (!attempt) return null;
  const answers = await listAttemptAnswers(client, tableName, publication.publicationId, identity);
  const serverTime = Date.now();
  if (publication.retentionAt <= serverTime) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
  return guestState(publication, attempt, answers, serverTime);
}

export async function submitAsyncAnswer(
  client: DynamoDBDocumentClient, tableName: string, raw: unknown, identityId: string, now: number,
) {
  const input = z.object({
    token: tokenSchema, questionIndex: z.number().int().nonnegative().max(99),
    choiceId: z.string().regex(/^a[0-7]$/),
  }).strict().parse(raw);
  assertTime(now);
  const publication = await resolveToken(client, tableName, input.token, now);
  const identity = identityHash(identityId);
  const attemptKey = { pk: `ASYNC#${publication.publicationId}`, sk: `ATTEMPT#${identity}` };
  const attemptResult = await client.send(new GetCommand({ TableName: tableName, Key: attemptKey, ConsistentRead: true }));
  if (!attemptResult.Item) throw new Error("Kein eigener Quizversuch gefunden.");
  const attempt = attemptSchema.parse(attemptResult.Item);
  const answers = publication.snapshot.questions;
  const question = answers[input.questionIndex];
  if (!question || !question.answers[Number(input.choiceId.slice(1))]) throw new Error("Diese Antwortoption gehört nicht zur Frage.");
  const answerKey = { pk: `ASYNC#${publication.publicationId}`, sk: `ANSWER#${identity}#${String(input.questionIndex).padStart(3, "0")}` };
  const prior = await client.send(new GetCommand({ TableName: tableName, Key: answerKey, ConsistentRead: true }));
  if (prior.Item) {
    if (publication.retentionAt <= Date.now()) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
    const saved = answerRecordSchema.parse(prior.Item);
    if (saved.choiceId !== input.choiceId) throw new Error("Für diese Frage wurde bereits eine andere Antwort bestätigt.");
    return { acceptedAt: saved.acceptedAt, answeredCount: attempt.answeredCount };
  }
  if (statusOf(publication, now) !== "ACTIVE") throw new Error("Die Quizfrist ist abgelaufen. Es werden keine neuen Antworten angenommen.");
  if (input.questionIndex !== attempt.answeredCount) throw new Error("Der Quizfortschritt hat sich geändert. Bitte lade den bestätigten Stand neu.");
  const acceptedAt = Date.now();
  const completed = input.questionIndex === answers.length - 1;
  const answer = { ...answerKey, questionIndex: input.questionIndex, choiceId: input.choiceId, acceptedAt,
    ttl: Math.ceil(publication.retentionAt / 1000) };
  try {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { ConditionCheck: { TableName: tableName, Key: publicationKey(publication.publicationId),
        ConditionExpression: "#status = :active AND expiresAt > :now AND retentionAt > :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":active": "ACTIVE", ":now": acceptedAt } } },
      { Update: { TableName: tableName, Key: attemptKey,
        UpdateExpression: completed ? "SET #status = :completed, completedAt = :now ADD answeredCount :one"
          : "SET #status = :progress ADD answeredCount :one",
        ConditionExpression: "#status = :progress AND answeredCount = :index",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":progress": "IN_PROGRESS", ":one": 1, ":index": input.questionIndex,
          ...(completed ? { ":completed": "COMPLETED", ":now": acceptedAt } : {}),
        } } },
      { Put: { TableName: tableName, Item: answer,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
    ] })));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const retry = await client.send(new GetCommand({ TableName: tableName, Key: answerKey, ConsistentRead: true }));
    if (retry.Item) {
      const saved = answerRecordSchema.parse(retry.Item);
      if (saved.choiceId === input.choiceId) return { acceptedAt: saved.acceptedAt, answeredCount: attempt.answeredCount + 1 };
      throw new Error("Für diese Frage wurde bereits eine andere Antwort bestätigt.");
    }
    const current = await client.send(new GetCommand({
      TableName: tableName, Key: publicationKey(publication.publicationId), ConsistentRead: true,
    }));
    const currentPublication = current.Item ? publicationSchema.safeParse(current.Item) : null;
    if (!currentPublication?.success || statusOf(currentPublication.data, Date.now()) !== "ACTIVE") {
      throw new Error("Die Quizfrist ist abgelaufen. Es werden keine neuen Antworten angenommen.");
    }
    const latestAttempt = await client.send(new GetCommand({ TableName: tableName, Key: attemptKey, ConsistentRead: true }));
    if (latestAttempt.Item && attemptSchema.parse(latestAttempt.Item).answeredCount !== input.questionIndex) {
      throw new Error("Der Quizfortschritt hat sich geändert. Bitte lade den bestätigten Stand neu.");
    }
    throw new Error("Die Antwort wurde nicht bestätigt. Bitte versuche es erneut.");
  }
  return { acceptedAt, answeredCount: input.questionIndex + 1 };
}

async function queryAll(
  client: DynamoDBDocumentClient, tableName: string, pk: string, prefix: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
      ExclusiveStartKey: cursor,
    }));
    items.push(...(page.Items ?? []));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function queryPartition(
  client: DynamoDBDocumentClient, tableName: string, pk: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ExclusiveStartKey: cursor,
    }));
    items.push(...(page.Items ?? []));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}

function effectiveStatus(publication: Publication, now: number): string {
  return statusOf(publication, now);
}

async function summaries(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, token: string, now: number,
) {
  const attempts = await queryAll(client, tableName, `ASYNC#${publication.publicationId}`, "ATTEMPT#");
  const complete = attempts.filter((item) => item.status === "COMPLETED").length;
  const status = effectiveStatus(publication, now);
  return {
    publicationId: publication.publicationId, quizId: publication.quizId, title: publication.title, token,
    createdAt: publication.createdAt, expiresAt: publication.expiresAt, timeZone: publication.timeZone,
    status, retentionAt: publication.retentionAt,
    endedAt: publication.endedAt ?? (status === "EXPIRED" ? publication.expiresAt : null),
    maxParticipants: publication.maxParticipants,
    participantCount: attempts.length,
    completedCount: complete, partialCount: attempts.length - complete,
  };
}

export async function listAsyncPublications(
  client: DynamoDBDocumentClient, tableName: string, principal: unknown, now: number,
) {
  const ownerId = requireQuizmaster(principal);
  assertTime(now);
  const ownerItems = await queryAll(client, tableName, `OWNER#${ownerId}`, "ASYNC#");
  const unique = [...new Map(ownerItems.filter((item) => typeof item.publicationId === "string")
    .map((item) => [String(item.publicationId), item])).values()];
  const result = [];
  for (const ownerItem of unique) {
    if (typeof ownerItem.retentionAt === "number" && ownerItem.retentionAt <= Date.now()) continue;
    const publicationId = uuidSchema.safeParse(ownerItem.publicationId);
    const token = tokenSchema.safeParse(ownerItem.token);
    if (!publicationId.success || !token.success) continue;
    // TTL deletion is asynchronous and unordered: skip index rows whose publication is already gone or past retention.
    const stored = await client.send(new GetCommand({
      TableName: tableName, Key: publicationKey(publicationId.data), ConsistentRead: true,
    }));
    const parsed = stored.Item ? publicationSchema.safeParse(stored.Item) : null;
    if (!parsed?.success) continue;
    const publication = parsed.data;
    if (publication.ownerId !== ownerId || publication.retentionAt <= Date.now()) continue;
    if (publication.status === "ENDED" && publication.retentionSyncedTtl !== Math.ceil(publication.retentionAt / 1000)) {
      await shortenRetention(client, tableName, publication, ownerId);
    }
    result.push(await summaries(client, tableName, publication, token.data, Date.now()));
  }
  return result.sort((left, right) => right.createdAt - left.createdAt);
}

export async function endAsyncPublication(
  client: DynamoDBDocumentClient, tableName: string, raw: unknown, principal: unknown, now: number,
) {
  const ownerId = requireQuizmaster(principal);
  const input = z.object({ publicationId: uuidSchema }).strict().parse(raw);
  assertTime(now);
  const key = publicationKey(input.publicationId);
  let publication = await getPublication(client, tableName, input.publicationId, now);
  if (publication.ownerId !== ownerId) throw new Error("Veröffentlichung gehört nicht zu diesem Konto.");
  let serverTime = Date.now();
  if (publication.status !== "ENDED" && serverTime < publication.expiresAt) {
    const retentionAt = serverTime + publication.retentionDays * 86_400_000;
    try {
      await client.send(new UpdateCommand({
        TableName: tableName, Key: key,
        UpdateExpression: "SET #status = :ended, endedAt = :now, retentionAt = :retentionAt, #ttl = :ttl",
        ConditionExpression: "ownerId = :owner AND #status = :active AND expiresAt > :now",
        ExpressionAttributeNames: { "#status": "status", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":ended": "ENDED", ":active": "ACTIVE", ":owner": ownerId, ":now": serverTime,
          ":retentionAt": retentionAt, ":ttl": Math.ceil(retentionAt / 1000) },
      }));
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
    publication = await getPublication(client, tableName, input.publicationId, now);
    if (publication.ownerId !== ownerId) throw new Error("Veröffentlichung gehört nicht zu diesem Konto.");
    serverTime = Date.now();
  }
  if (publication.status === "ENDED" || serverTime >= publication.expiresAt) {
    await shortenRetention(client, tableName, publication, ownerId);
  }
  return { status: statusOf(publication, Date.now()), endedAt: publication.endedAt ?? publication.expiresAt };
}

async function shortenRetention(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, ownerId: string,
): Promise<void> {
  const ttl = Math.ceil(publication.retentionAt / 1000);
  const rows = await queryPartition(client, tableName, `ASYNC#${publication.publicationId}`);
  const writes: BatchWriteWriteRequest[] = rows.filter((item) => item.sk !== "META" && item.ttl !== ttl).map((item) => ({
    PutRequest: { Item: { ...item, ttl } },
  }));
  const ownerRows = await queryAll(client, tableName, `OWNER#${ownerId}`, "ASYNC");
  writes.push(...ownerRows.filter((item) => item.publicationId === publication.publicationId &&
    (item.ttl !== ttl || item.retentionAt !== publication.retentionAt))
    .map((item) => ({ PutRequest: { Item: {
      ...item, ttl, ...("retentionAt" in item ? { retentionAt: publication.retentionAt } : {}),
    } } })));
  const tokenRow = await client.send(new GetCommand({
    TableName: tableName, Key: { pk: `ASYNC_TOKEN#${publication.tokenHash}`, sk: "META" }, ConsistentRead: true,
  }));
  if (tokenRow.Item && tokenRow.Item.ttl !== ttl) writes.push({ PutRequest: { Item: { ...tokenRow.Item, ttl } } });
  for (let offset = 0; offset < writes.length; offset += 25) {
    let requestItems: Record<string, BatchWriteWriteRequest[]> = { [tableName]: writes.slice(offset, offset + 25) };
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await client.send(new BatchWriteCommand({ RequestItems: requestItems }));
      const unprocessed = result.UnprocessedItems?.[tableName] ?? [];
      if (unprocessed.length === 0) break;
      requestItems = { [tableName]: unprocessed };
      if (attempt === 4) throw new Error("Aufbewahrungsfrist konnte nicht für alle Quizdaten aktualisiert werden.");
    }
  }
  try {
    await client.send(new UpdateCommand({
      TableName: tableName, Key: publicationKey(publication.publicationId),
      UpdateExpression: "SET retentionSyncedTtl = :ttl",
      ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeValues: { ":ttl": ttl },
    }));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
  }
}

export async function getAsyncPublicationResults(
  client: DynamoDBDocumentClient, tableName: string, raw: unknown, principal: unknown, now: number,
) {
  const ownerId = requireQuizmaster(principal);
  const input = z.object({ publicationId: uuidSchema, cursor: z.string().regex(/^\d+$/).optional() }).strict().parse(raw);
  const offset = input.cursor ? Number(input.cursor) : 0;
  if (!Number.isSafeInteger(offset)) throw new Error("Ungültiger Ergebniscursor.");
  const pageSize = 50;
  assertTime(now);
  const publication = await getPublication(client, tableName, input.publicationId, now);
  if (publication.ownerId !== ownerId) throw new Error("Veröffentlichung gehört nicht zu diesem Konto.");
  const answers = publication.snapshot.questions.map((question, questionIndex) => ({
    questionIndex, text: question.text, correctChoiceId: `a${question.answers.findIndex((answer) => answer.correct)}`,
    explanation: question.explanation,
    options: question.answers.map((answer, optionIndex) => ({ id: `a${optionIndex}`, text: answer.text, correct: answer.correct, count: 0 })),
    answeredCount: 0,
  }));
  const attempts = await queryAll(client, tableName, `ASYNC#${input.publicationId}`, "ATTEMPT#");
  const answersByIdentity = new Map<string, z.infer<typeof answerRecordSchema>[]>();
  const allAnswers = await queryAll(client, tableName, `ASYNC#${input.publicationId}`, "ANSWER#");
  for (const rawAnswer of allAnswers) {
    const match = /^ANSWER#([a-f0-9]{64})#/.exec(String(rawAnswer.sk));
    if (!match) throw new Error("Ungültiger gespeicherter Antwortdatensatz.");
    const list = answersByIdentity.get(match[1]) ?? [];
    list.push(answerRecordSchema.parse(rawAnswer));
    answersByIdentity.set(match[1], list);
  }
  const players = [];
  for (const rawAttempt of attempts) {
    const attempt = attemptSchema.parse(rawAttempt);
    const identity = attempt.identityHash;
    const playerAnswers = (answersByIdentity.get(identity) ?? [])
      .sort((left, right) => left.questionIndex - right.questionIndex);
    const results = playerAnswers.map((answer) => {
      const question = publication.snapshot.questions[answer.questionIndex];
      const correct = answer.choiceId === `a${question.answers.findIndex((choice) => choice.correct)}`;
      answers[answer.questionIndex].answeredCount++;
      const option = answers[answer.questionIndex].options.find((item) => item.id === answer.choiceId);
      if (option) option.count++;
      return { questionIndex: answer.questionIndex, choiceId: answer.choiceId, acceptedAt: answer.acceptedAt, correct };
    });
    const points = results.filter((answer) => answer.correct).length;
    const complete = playerAnswers.length === publication.snapshot.questions.length;
    players.push({
      displayName: attempt.displayName, avatarId: attempt.avatarId, startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? (complete ? playerAnswers.at(-1)?.acceptedAt ?? null : null),
      answeredCount: playerAnswers.length,
      questionCount: publication.snapshot.questions.length,
      status: complete ? "COMPLETED" : statusOf(publication, now) === "ACTIVE" ? "IN_PROGRESS" : "EXPIRED_PARTIAL",
      points, rank: 0, answers: results,
    });
  }
  players.sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName));
  let rank = 0;
  let previousPoints: number | undefined;
  players.forEach((player, index) => {
    if (player.points !== previousPoints) rank = index + 1;
    player.rank = rank;
    previousPoints = player.points;
  });
  const resultTime = Date.now();
  if (publication.retentionAt <= resultTime) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
  for (const player of players) {
    if (player.status !== "COMPLETED") {
      player.status = statusOf(publication, resultTime) === "ACTIVE" ? "IN_PROGRESS" : "EXPIRED_PARTIAL";
    }
  }
  const summary = await summaries(client, tableName, publication, "", resultTime);
  const participantPage = players.slice(offset, offset + pageSize);
  return {
    ...summary, token: undefined, updatedAt: resultTime, isFinal: statusOf(publication, resultTime) !== "ACTIVE",
    questions: answers, participants: participantPage,
    nextCursor: offset + participantPage.length < players.length ? String(offset + participantPage.length) : null,
  };
}
