import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  BatchWriteCommand, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand,
  type BatchWriteWriteRequest, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import avatars from "../domain/avatars.json";
import { requireQuizmaster } from "./adminPrincipal";
import { backoffWithJitter, chooseAvatarSlot, displayNameFor, reservedAvatarSlots } from "./participation";
import { logger } from "./logger";
import { QuizStore } from "./quizStore";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";
import { batchGetAll, mapWithConcurrency } from "./batchGet";
import {
  JOIN_CODE_FREE_CONDITION, JOIN_CODE_PATTERN, isJoinCodeLike, joinCodeKey, normalizeJoinCode, reserveJoinCode,
} from "./joinCode";
import { ASYNC_MAX_DURATION_MS, ASYNC_MAX_DURATION_DAYS, ASYNC_MAX_PARTICIPANTS } from "../domain/limits";
import { ASYNC_LEGACY_SCORING, ASYNC_SPEED_V1, scoreAsyncSpeedAnswer, type AsyncScoringRule } from "../domain/scoring";

const uuidSchema = z.string().uuid();
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const joinCodeSchema = z.string().regex(JOIN_CODE_PATTERN);
/** Langer Teilnahmelink-Token oder Quiz-Code; die genaue Prüfung erfolgt in `resolveToken`. */
const participationRefSchema = z.string().min(1).max(64);
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
  // Fehlt bei Runden aus der Zeit vor den Quiz-Codes, bis `ensureAsyncJoinCode` ihn einmalig vergibt.
  joinCode: joinCodeSchema.optional(),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  timeZone: zoneSchema,
  endedAt: z.number().int().positive().optional(),
  retentionAt: z.number().int().positive(),
  retentionDays: z.number().int().min(1).max(365),
  maxParticipants: z.number().int().min(1).max(1000),
  startedCount: z.number().int().nonnegative(),
  retentionSyncedTtl: z.number().int().optional(),
  // Ab statsVersion 1 werden Abschlüsse und Antwortverteilung beim Antworten aggregiert (keine Vollscans beim Lesen).
  statsVersion: z.literal(1).optional(),
  completedCount: z.number().int().nonnegative().optional(),
  // Fehlt bei historischen Runden: dann gilt die Legacy-Wertung (1 Punkt je richtiger Antwort), keine Umwertung.
  scoringVersion: z.literal(ASYNC_SPEED_V1.version).optional(),
  scoring: z.object({
    basePoints: z.number().int().positive().max(1_000_000),
    maxBonusPoints: z.number().int().nonnegative().max(1_000_000),
    bonusWindowMs: z.number().int().positive().max(86_400_000),
  }).optional(),
});
type Publication = z.infer<typeof publicationSchema> & { optionCounts?: Map<string, number> };
const statPattern = /^stat_(\d{3})_(a[0-7])$/;
const statAttribute = (questionIndex: number, choiceId: string) => `stat_${String(questionIndex).padStart(3, "0")}_${choiceId}`;

const answerRecordSchema = z.object({
  questionIndex: z.number().int().nonnegative(), choiceId: z.string().regex(/^a[0-7]$/),
  acceptedAt: z.number().int().positive(),
  // Nur ASYNC_SPEED_V1: bei Annahme serverseitig berechnete, danach unveränderliche Wertung.
  questionStartedAt: z.number().int().positive().optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  basePoints: z.number().int().nonnegative().optional(),
  bonusPoints: z.number().int().nonnegative().optional(),
  points: z.number().int().nonnegative().optional(),
});
type AnswerRecord = z.infer<typeof answerRecordSchema>;
const attemptSchema = z.object({
  identityHash: z.string().regex(/^[a-f0-9]{64}$/),
  displayName: z.string().min(1).max(80),
  avatarId: z.string().min(1).max(100),
  startedAt: z.number().int().positive(),
  answeredCount: z.number().int().nonnegative(),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  completedAt: z.number().int().positive().optional(),
  points: z.number().int().nonnegative().optional(),
  // Nur ASYNC_SPEED_V1: Index und serverseitiger Start der zuletzt geöffneten Frage dieses Versuchs.
  currentQuestionIndex: z.number().int().nonnegative().optional(),
  currentQuestionStartedAt: z.number().int().positive().optional(),
});
type Attempt = z.infer<typeof attemptSchema>;
const maxStartAttempts = 20;


function scoringRuleOf(publication: Publication): AsyncScoringRule {
  if (publication.scoringVersion !== ASYNC_SPEED_V1.version) return ASYNC_LEGACY_SCORING;
  return { version: ASYNC_SPEED_V1.version, ...(publication.scoring ?? ASYNC_SPEED_V1) };
}

function isSpeedScoring(publication: Publication): boolean {
  return publication.scoringVersion === ASYNC_SPEED_V1.version;
}

function scoringInfo(publication: Publication) {
  const rule = scoringRuleOf(publication);
  return { scoringVersion: rule.version, basePoints: rule.basePoints, maxBonusPoints: rule.maxBonusPoints,
    bonusWindowMs: rule.bonusWindowMs };
}

/** Gespeicherter Fragebeginn der aktuellen Frage – nur gültig, wenn er genau zu dieser Frage gehört. */
function questionStartOf(attempt: Attempt, questionIndex: number): number | null {
  return attempt.currentQuestionIndex === questionIndex && attempt.currentQuestionStartedAt !== undefined
    ? attempt.currentQuestionStartedAt : null;
}

function questionPayload(publication: Publication, questionIndex: number, startedAt: number | null) {
  const question = publication.snapshot.questions[questionIndex];
  return {
    questionIndex,
    text: question.text,
    answers: question.answers.map((answer, index) => ({ id: `a${index}`, text: answer.text })),
    startedAt,
  };
}

/**
 * ASYNC_SPEED_V1 gibt eine Frage erst heraus, wenn die Person sie ausdrücklich geöffnet hat (persistierter Start);
 * so bleibt sie während der Pause zwischen zwei Fragen verborgen. Ohne Tempo-Wertung gibt es keinen Timer.
 */
function releasedQuestion(publication: Publication, attempt: Attempt, questionIndex: number) {
  const startedAt = questionStartOf(attempt, questionIndex);
  if (isSpeedScoring(publication) && startedAt === null) return null;
  return questionPayload(publication, questionIndex, startedAt);
}

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
  const publication: Publication = publicationSchema.parse(item);
  if (item && typeof item === "object") {
    const optionCounts = new Map<string, number>();
    for (const [key, value] of Object.entries(item)) {
      if (statPattern.test(key) && typeof value === "number") optionCounts.set(key, value);
    }
    publication.optionCounts = optionCounts;
  }
  return publication;
}

/** Stabile, pro Runde pseudonyme Kennung eines Versuchs (nicht über Runden hinweg verknüpfbar). */
function attemptIdFor(publicationId: string, identity: string): string {
  return hash(`${publicationId}#${identity}`).slice(0, 24);
}

class PublicationUnavailableError extends Error {}

async function getPublication(
  client: DynamoDBDocumentClient, tableName: string, publicationId: string, now: number,
): Promise<Publication> {
  const result = await client.send(new GetCommand({
    TableName: tableName, Key: publicationKey(publicationId), ConsistentRead: true,
  }));
  if (!result.Item) throw new PublicationUnavailableError("Veröffentlichung nicht gefunden oder nicht mehr verfügbar.");
  const publication = asPublication(result.Item);
  if (publication.retentionAt <= now) throw new PublicationUnavailableError("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
  return ensureParticipantLimit(client, tableName, publication);
}

/** Hebt laufende Bestandsrunden einmalig an; abgeschlossene Runden und höhere Sonderlimits bleiben unverändert. */
async function ensureParticipantLimit(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication,
): Promise<Publication> {
  const now = Date.now();
  if (statusOf(publication, now) !== "ACTIVE" || publication.maxParticipants >= ASYNC_MAX_PARTICIPANTS) return publication;
  try {
    const result = await client.send(new UpdateCommand({
      TableName: tableName, Key: publicationKey(publication.publicationId),
      UpdateExpression: "SET maxParticipants = :limit",
      ConditionExpression: "#status = :active AND expiresAt > :now AND maxParticipants < :limit",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":limit": ASYNC_MAX_PARTICIPANTS, ":active": "ACTIVE", ":now": now },
      ReturnValues: "ALL_NEW",
    }));
    return asPublication(result.Attributes);
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    // Ein paralleler Zugriff hat das Limit bereits angehoben oder die Runde ist inzwischen beendet.
    return getPublication(client, tableName, publication.publicationId, Date.now());
  }
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
    joinCode: publication.joinCode ?? null,
    serverTime: now,
    ...scoringInfo(publication),
  };
}

type PublishReceipt = {
  publicationId: string; token: string; joinCode: string; expiresAt: number; timeZone: string;
  retentionDays: number; maxParticipants: number;
};
const savedRequestSchema = z.object({ publicationId: uuidSchema, token: tokenSchema, expiresAt: z.number().int(),
  timeZone: zoneSchema, retentionAt: z.number().int(), retentionDays: z.number().int(), maxParticipants: z.number().int(),
  requestHash: z.string(), joinCode: joinCodeSchema.optional() });

export async function publishAsyncQuiz(
  client: DynamoDBDocumentClient,
  tableName: string,
  raw: unknown,
  principal: unknown,
  retentionDays: number,
  now: number,
  joinCodeCandidates?: () => string,
): Promise<PublishReceipt> {
  const ownerId = requireQuizmaster(principal);
  const input = z.object({
    quizId: uuidSchema,
    requestId: uuidSchema,
    expiresAt: z.number().int().positive(),
    timeZone: zoneSchema,
  }).strict().parse(raw);
  z.number().int().min(1).max(365).parse(retentionDays);
  const maxParticipants = ASYNC_MAX_PARTICIPANTS;
  assertTime(now);
  const ownerPk = `OWNER#${ownerId}`;
  const requestKey = { pk: ownerPk, sk: `ASYNC_REQUEST#${input.requestId}` };
  const requestHash = hash(JSON.stringify({
    quizId: input.quizId, expiresAt: input.expiresAt, timeZone: input.timeZone,
  }));
  /** Idempotenter Retry (z. B. nach verlorenem Response): gleiche Runde, gleicher Code, keine zweite Veröffentlichung. */
  const replay = async (): Promise<PublishReceipt | undefined> => {
    const existing = await client.send(new GetCommand({ TableName: tableName, Key: requestKey, ConsistentRead: true }));
    if (!existing.Item) return undefined;
    const saved = savedRequestSchema.parse(existing.Item);
    if (saved.requestHash !== requestHash) throw new Error("Diese Vorgangsidentität wurde bereits für eine andere Veröffentlichung verwendet.");
    if (saved.retentionAt <= Date.now()) throw new Error("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
    // Vorgänge aus der Zeit vor den Quiz-Codes erhalten ihren Code einmalig nachträglich.
    const joinCode = saved.joinCode ?? await ensureJoinCodeFor(client, tableName, saved.publicationId, ownerId, Date.now());
    const publication = await getPublication(client, tableName, saved.publicationId, Date.now());
    return { publicationId: saved.publicationId, token: saved.token, joinCode, expiresAt: saved.expiresAt,
      timeZone: saved.timeZone, retentionDays: saved.retentionDays, maxParticipants: publication.maxParticipants };
  };
  const previous = await replay();
  if (previous) return previous;
  if (input.expiresAt <= now) throw new Error("Das Ende muss in der Zukunft liegen.");
  if (input.expiresAt > now + ASYNC_MAX_DURATION_MS) {
    throw new Error(`Eine Quizrunde darf höchstens ${ASYNC_MAX_DURATION_DAYS} Tage laufen.`);
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.timeZone }).format(now);
  } catch {
    throw new Error("Die angegebene Zeitzone ist ungültig.");
  }

  const { quiz } = await new QuizStore(client, tableName).getQuiz(principal, input.quizId);
  const snapshot = snapshotSchema.parse(structuredClone(quiz));
  const createdAt = Date.now();
  if (input.expiresAt <= createdAt) throw new Error("Das Ende muss in der Zukunft liegen.");
  const publicationId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hash(token);
  const retentionAt = input.expiresAt + retentionDays * 86_400_000;
  if (!Number.isSafeInteger(retentionAt)) throw new Error("Ungültiger Aufbewahrungszeitpunkt.");
  const ttl = Math.ceil(retentionAt / 1000);
  // Code, Runde, Eigentümerindex, Idempotenzeintrag und Tokenzeiger entstehen in einer Transaktion:
  // keine halb veröffentlichte Runde ohne nutzbaren Zugang und kein reservierter Code ohne Runde.
  return reserveJoinCode(client, tableName, createdAt, async (joinCode) => {
    const publication: Publication = {
      publicationId, ownerId, quizId: input.quizId, title: snapshot.title, snapshot,
      status: "ACTIVE", tokenHash, joinCode, createdAt, expiresAt: input.expiresAt, timeZone: input.timeZone,
      retentionAt, retentionDays, maxParticipants, startedCount: 0, statsVersion: 1, completedCount: 0,
      scoringVersion: ASYNC_SPEED_V1.version,
      scoring: { basePoints: ASYNC_SPEED_V1.basePoints, maxBonusPoints: ASYNC_SPEED_V1.maxBonusPoints,
        bonusWindowMs: ASYNC_SPEED_V1.bonusWindowMs },
    };
    const idempotency = { ...requestKey, publicationId, token, joinCode, expiresAt: input.expiresAt, timeZone: input.timeZone,
      retentionAt, retentionDays, maxParticipants, requestHash, ttl };
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: asyncJoinCodeItem(joinCode, publicationId, createdAt),
        ConditionExpression: JOIN_CODE_FREE_CONDITION, ExpressionAttributeValues: { ":now": createdAt } } },
      { Put: { TableName: tableName, Item: { ...publicationKey(publicationId), ...publication, ttl },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
      { Put: { TableName: tableName, Item: { pk: ownerPk, sk: `ASYNC#${String(createdAt).padStart(16, "0")}#${publicationId}`,
        publicationId, createdAt, token, retentionAt, ttl },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
      { Put: { TableName: tableName, Item: idempotency,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
      { Put: { TableName: tableName, Item: { pk: `ASYNC_TOKEN#${tokenHash}`, sk: "META", publicationId, ttl },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
    ] })));
    return { publicationId, token, joinCode, expiresAt: input.expiresAt, timeZone: input.timeZone, retentionDays, maxParticipants };
  }, replay, joinCodeCandidates);
}

/** Dauerhafte Codereservierung einer Quizrunde: bewusst ohne `ttl`, `expiresAt` und Teilnehmerdaten. */
function asyncJoinCodeItem(joinCode: string, publicationId: string, createdAt: number) {
  return { ...joinCodeKey(joinCode), publicationId, kind: "ASYNC", createdAt };
}

/**
 * Vergibt einer bereits veröffentlichten Runde ohne Quiz-Code einmalig einen stabilen Code.
 * Parallele Aufrufe (z. B. zwei Admin-Tabs) sehen über die Bedingung `attribute_not_exists(joinCode)` denselben Code.
 */
async function ensureJoinCodeFor(
  client: DynamoDBDocumentClient, tableName: string, publicationId: string, ownerId: string, now: number,
  joinCodeCandidates?: () => string,
): Promise<string> {
  const publication = await getPublication(client, tableName, publicationId, now);
  if (publication.ownerId !== ownerId) throw new Error("Veröffentlichung gehört nicht zu diesem Konto.");
  if (publication.joinCode) return publication.joinCode;
  const confirmed = async () => {
    const current = await getPublication(client, tableName, publicationId, Date.now());
    return current.joinCode;
  };
  return reserveJoinCode(client, tableName, now, async (joinCode) => {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: asyncJoinCodeItem(joinCode, publicationId, Date.now()),
        ConditionExpression: JOIN_CODE_FREE_CONDITION, ExpressionAttributeValues: { ":now": now } } },
      { Update: { TableName: tableName, Key: publicationKey(publicationId),
        UpdateExpression: "SET joinCode = :code",
        ConditionExpression: "attribute_exists(pk) AND ownerId = :owner AND attribute_not_exists(joinCode)",
        ExpressionAttributeValues: { ":code": joinCode, ":owner": ownerId } } },
    ] })));
    return joinCode;
  }, confirmed, joinCodeCandidates);
}

export async function ensureAsyncJoinCode(
  client: DynamoDBDocumentClient, tableName: string, raw: unknown, principal: unknown, now: number,
  joinCodeCandidates?: () => string,
): Promise<{ publicationId: string; joinCode: string }> {
  const ownerId = requireQuizmaster(principal);
  const input = z.object({ publicationId: uuidSchema }).strict().parse(raw);
  assertTime(now);
  const joinCode = await ensureJoinCodeFor(client, tableName, input.publicationId, ownerId, now, joinCodeCandidates);
  return { publicationId: input.publicationId, joinCode };
}

const unknownReference = "Diese Quizrunde gibt es nicht oder sie ist nicht mehr verfügbar.";

/**
 * Teilnahmezugang über alten langen Link (43-Zeichen-Token) oder Quiz-Code. Beide Formen sind disjunkt und lösen auf
 * dieselbe Veröffentlichung auf; der Versuch hängt allein an Veröffentlichung und Gastidentität, nicht am Zugangsweg.
 */
async function resolveToken(
  client: DynamoDBDocumentClient, tableName: string, rawReference: unknown, now: number,
): Promise<Publication> {
  if (typeof rawReference === "string" && tokenSchema.safeParse(rawReference).success) {
    const tokenHash = hash(rawReference);
    const pointer = await client.send(new GetCommand({
      TableName: tableName, Key: { pk: `ASYNC_TOKEN#${tokenHash}`, sk: "META" }, ConsistentRead: true,
    }));
    const publicationId = z.string().uuid().safeParse(pointer.Item?.publicationId);
    if (!publicationId.success) throw new Error("Der Teilnahmelink ist ungültig oder nicht mehr verfügbar.");
    const publication = await getPublication(client, tableName, publicationId.data, now);
    if (publication.tokenHash !== tokenHash) throw new Error("Der Teilnahmelink ist ungültig oder nicht mehr verfügbar.");
    return publication;
  }
  if (!isJoinCodeLike(rawReference)) throw new Error("Der Teilnahmelink ist ungültig oder nicht mehr verfügbar.");
  const code = normalizeJoinCode(rawReference);
  const pointer = await client.send(new GetCommand({ TableName: tableName, Key: joinCodeKey(code), ConsistentRead: true }));
  const publicationId = z.string().uuid().safeParse(pointer.Item?.publicationId);
  if (!publicationId.success) throw new Error(unknownReference);
  const publication = await getPublication(client, tableName, publicationId.data, now).catch((error: unknown) => {
    if (!(error instanceof PublicationUnavailableError)) throw error;
    throw new Error(unknownReference);
  });
  if (publication.joinCode !== code) throw new Error(unknownReference);
  return publication;
}

/**
 * Gemeinsame Beitrittsseite: ordnet einen Code eindeutig einem Live-Quiz oder einer Quizrunde zu.
 * Liefert nur den Modus – keine internen IDs; ein Versuch oder Live-Beitritt entsteht hier nie.
 */
export async function resolveJoinCode(
  client: DynamoDBDocumentClient, tableName: string, raw: unknown, now: number,
): Promise<{ mode: "LIVE" | "ASYNC"; joinCode: string }> {
  assertTime(now);
  const code = normalizeJoinCode(raw);
  const pointer = await client.send(new GetCommand({ TableName: tableName, Key: joinCodeKey(code), ConsistentRead: true }));
  const item = pointer.Item;
  if (item && typeof item.publicationId === "string") {
    await resolveToken(client, tableName, code, now);
    return { mode: "ASYNC", joinCode: code };
  }
  if (item && typeof item.sessionId === "string" && typeof item.expiresAt === "number" && item.expiresAt > now) {
    return { mode: "LIVE", joinCode: code };
  }
  throw new Error("Diesen Quiz-Code gibt es nicht. Bitte prüfe die Ziffern.");
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
): Promise<AnswerRecord[]> {
  const result = await client.send(new QueryCommand({
    TableName: tableName, ConsistentRead: true,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `ASYNC#${publicationId}`, ":prefix": `ANSWER#${identity}#` },
  }));
  return (result.Items ?? []).map((item) => answerRecordSchema.parse(item))
    .sort((left, right) => left.questionIndex - right.questionIndex);
}

function correctChoiceIdOf(publication: Publication, questionIndex: number): string {
  return `a${publication.snapshot.questions[questionIndex].answers.findIndex((choice) => choice.correct)}`;
}

/** Punkte einer gespeicherten Antwort gemäß der Wertungsregel ihrer Veröffentlichung (keine Neuberechnung bei V1). */
function answerScore(publication: Publication, answer: AnswerRecord) {
  const correct = answer.choiceId === correctChoiceIdOf(publication, answer.questionIndex);
  if (!isSpeedScoring(publication)) {
    return { correct, points: correct ? 1 : 0, basePoints: correct ? 1 : 0, bonusPoints: 0, elapsedMs: null };
  }
  return { correct, points: answer.points ?? 0, basePoints: answer.basePoints ?? 0, bonusPoints: answer.bonusPoints ?? 0,
    elapsedMs: answer.elapsedMs ?? null };
}

function guestState(publication: Publication, attempt: Attempt, answers: AnswerRecord[], now: number) {
  const roundStatus = statusOf(publication, now);
  const complete = attempt.answeredCount === publication.snapshot.questions.length;
  const nextIndex = complete ? -1 : attempt.answeredCount;
  const question = roundStatus === "ACTIVE" && nextIndex >= 0 ? releasedQuestion(publication, attempt, nextIndex) : null;
  const resultAvailable = roundStatus !== "ACTIVE";
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionIndex, answer]));
  const hidden = { points: null, basePoints: null, bonusPoints: null, elapsedMs: null };
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
      const correctChoiceId = correctChoiceIdOf(publication, answer.questionIndex);
      const selectedChoice = question.answers[Number(answer.choiceId.slice(1))];
      const correctChoice = question.answers[Number(correctChoiceId.slice(1))];
      const { correct: _correct, ...score } = answerScore(publication, answer);
      return {
        questionIndex: answer.questionIndex, choiceId: answer.choiceId, acceptedAt: answer.acceptedAt,
        correct: resultAvailable ? answer.choiceId === correctChoiceId : null,
        correctChoiceId: resultAvailable ? correctChoiceId : null,
        explanation: resultAvailable ? question.explanation : null,
        questionText: resultAvailable ? question.text : null,
        selectedText: resultAvailable ? selectedChoice.text : null,
        correctText: resultAvailable ? correctChoice.text : null,
        // Vor Quizende würde schon der Punktwert die Richtigkeit verraten.
        ...(resultAvailable ? score : hidden),
      };
    }),
    question,
    points: resultAvailable ? answers.reduce((sum, answer) => sum + answerScore(publication, answer).points, 0) : null,
    results: resultAvailable ? publication.snapshot.questions.map((resultQuestion, questionIndex) => {
      const answer = answerByQuestion.get(questionIndex);
      const correctIndex = resultQuestion.answers.findIndex((choice) => choice.correct);
      const selectedIndex = answer ? Number(answer.choiceId.slice(1)) : -1;
      const score = answer ? answerScore(publication, answer)
        : { points: 0, basePoints: 0, bonusPoints: 0, elapsedMs: null };
      return {
        questionIndex,
        questionText: resultQuestion.text,
        answered: Boolean(answer),
        selectedText: answer ? resultQuestion.answers[selectedIndex].text : null,
        correctText: resultQuestion.answers[correctIndex].text,
        correct: answer ? selectedIndex === correctIndex : null,
        explanation: resultQuestion.explanation,
        acceptedAt: answer?.acceptedAt ?? null,
        points: score.points, basePoints: score.basePoints, bonusPoints: score.bonusPoints, elapsedMs: score.elapsedMs,
      };
    }) : [],
  };
}

/**
 * ASYNC_SPEED_V1: Öffnet die nächste unbeantwortete Frage und persistiert ihren Startzeitpunkt.
 * Setzt ihn nur, wenn er für diese Frage noch fehlt – zweiter Tab oder erneutes Öffnen setzen ihn nie zurück.
 */
async function ensureQuestionStart(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, attempt: Attempt,
): Promise<Attempt> {
  const questionIndex = attempt.answeredCount;
  if (!isSpeedScoring(publication) || attempt.status !== "IN_PROGRESS" ||
      questionIndex >= publication.snapshot.questions.length || questionStartOf(attempt, questionIndex) !== null) {
    return attempt;
  }
  const startedAt = Date.now();
  if (statusOf(publication, startedAt) !== "ACTIVE") return attempt;
  const key = { pk: `ASYNC#${publication.publicationId}`, sk: `ATTEMPT#${attempt.identityHash}` };
  try {
    await client.send(new UpdateCommand({
      TableName: tableName, Key: key,
      UpdateExpression: "SET currentQuestionIndex = :index, currentQuestionStartedAt = :startedAt",
      ConditionExpression: "#status = :progress AND answeredCount = :index AND " +
        "(attribute_not_exists(currentQuestionIndex) OR currentQuestionIndex <> :index)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":index": questionIndex, ":startedAt": startedAt, ":progress": "IN_PROGRESS" },
    }));
    return { ...attempt, currentQuestionIndex: questionIndex, currentQuestionStartedAt: startedAt };
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const latest = await client.send(new GetCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    return latest.Item ? attemptSchema.parse(latest.Item) : attempt;
  }
}

/**
 * Startet den eigenen Versuch bzw. öffnet nach einer Pause die nächste Frage („Weiter“).
 * Nur dieser ausdrückliche Schritt startet bei ASYNC_SPEED_V1 den Fragetimer – nie Linkaufruf, Refresh oder Antwort.
 */
export async function startAsyncQuiz(
  client: DynamoDBDocumentClient, tableName: string, token: unknown, identityId: string, now: number,
) {
  assertTime(now);
  const publication = await resolveToken(client, tableName, token, now);
  const identity = identityHash(identityId);
  let attempt = await getAttempt(client, tableName, publication, identityId);
  if (!attempt) {
    if (statusOf(publication, now) !== "ACTIVE") throw new Error("Diese Quizrunde ist beendet. Ein neuer Versuch ist nicht mehr möglich.");
    const pk = `ASYNC#${publication.publicationId}`;
    for (let profileAttempt = 0; profileAttempt < maxStartAttempts; profileAttempt++) {
      const avatar = chooseAvatarSlot(await reservedAvatarSlots(client, tableName, pk));
      const label = avatarLabels.get(avatar.id);
      if (!label) throw new Error("Avatar fehlt im lokalen Katalog.");
      const baseName = displayNameFor(label);
      const displayName = profileAttempt === 0 ? baseName : `${baseName} ${randomInt(10, 1000)}`;
      const startedAt = Date.now();
      if (startedAt >= publication.expiresAt) throw new Error("Diese Quizrunde ist beendet. Ein neuer Versuch ist nicht mehr möglich.");
      const item: Attempt = {
        identityHash: identity, displayName, avatarId: avatar.id, startedAt, answeredCount: 0, status: "IN_PROGRESS",
        // Der tatsächliche Quizstart (nicht der bloße Linkaufruf) gibt Frage 1 frei und startet ihren Bonus-Timer.
        ...(isSpeedScoring(publication) ? { currentQuestionIndex: 0, currentQuestionStartedAt: startedAt } : {}),
      };
      const ttl = Math.ceil(publication.retentionAt / 1000);
      try {
        await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
          { Put: { TableName: tableName,
            Item: { pk, sk: `ATTEMPT#${identity}`, ...item, ttl },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
          { Put: { TableName: tableName, Item: { pk, sk: `NAME#${displayName}`, identity, ttl },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
          { Update: { TableName: tableName, Key: publicationKey(publication.publicationId),
            UpdateExpression: "ADD startedCount :one",
            ConditionExpression: "#status = :active AND expiresAt > :now AND startedCount < #maxParticipants",
            ExpressionAttributeNames: { "#status": "status", "#maxParticipants": "maxParticipants" },
            ExpressionAttributeValues: { ":one": 1, ":active": "ACTIVE", ":now": startedAt } } },
          { Put: { TableName: tableName, Item: { pk, sk: avatar.key, identity, ttl },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
        ] })));
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
        logger.warn("asyncStart.conflict", { publicationId: publication.publicationId, attempt: profileAttempt });
        await backoffWithJitter(profileAttempt);
      }
    }
    if (!attempt) throw new Error("Es konnte kein eindeutiger Spielname vergeben werden.");
  }
  attempt = await ensureQuestionStart(client, tableName, publication, attempt);
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

/**
 * Antwortbestätigung inklusive des danach bestätigten Fortschritts. Bei ASYNC_SPEED_V1 ist die Folgefrage noch
 * nicht geöffnet (Pause zwischen den Fragen); sie wird erst über startAsyncQuiz freigegeben.
 */
function answerReceipt(publication: Publication, attempt: Attempt, answeredQuestionIndex: number, acceptedAt: number) {
  const serverTime = Date.now();
  const roundStatus = statusOf(publication, serverTime);
  const questionCount = publication.snapshot.questions.length;
  const complete = attempt.answeredCount >= questionCount;
  const nextIndex = complete ? -1 : attempt.answeredCount;
  const question = nextIndex >= 0 && roundStatus === "ACTIVE" && attempt.status === "IN_PROGRESS"
    ? releasedQuestion(publication, attempt, nextIndex) : null;
  return {
    acceptedAt, answeredCount: attempt.answeredCount, questionIndex: answeredQuestionIndex,
    attemptStatus: complete ? "COMPLETED" : roundStatus === "ACTIVE" ? "IN_PROGRESS" : "EXPIRED_PARTIAL",
    status: roundStatus, nextQuestionIndex: nextIndex, question, serverTime,
  };
}

async function confirmedReceipt(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, attemptKey: { pk: string; sk: string },
  answeredQuestionIndex: number, acceptedAt: number,
) {
  const latest = await client.send(new GetCommand({ TableName: tableName, Key: attemptKey, ConsistentRead: true }));
  if (!latest.Item) throw new Error("Kein eigener Quizversuch gefunden.");
  return answerReceipt(publication, attemptSchema.parse(latest.Item), answeredQuestionIndex, acceptedAt);
}

export async function submitAsyncAnswer(
  client: DynamoDBDocumentClient, tableName: string, raw: unknown, identityId: string, now: number,
) {
  const input = z.object({
    token: participationRefSchema, questionIndex: z.number().int().nonnegative().max(99),
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
    // Idempotenter Retry: gespeicherter Annahmezeitpunkt und gespeicherte Punkte bleiben unverändert.
    return answerReceipt(publication, attempt, input.questionIndex, saved.acceptedAt);
  }
  if (statusOf(publication, now) !== "ACTIVE") throw new Error("Die Quizfrist ist abgelaufen. Es werden keine neuen Antworten angenommen.");
  if (input.questionIndex !== attempt.answeredCount) throw new Error("Der Quizfortschritt hat sich geändert. Bitte lade den bestätigten Stand neu.");
  const speed = isSpeedScoring(publication);
  const questionStartedAt = questionStartOf(attempt, input.questionIndex);
  // Ohne gespeicherten Fragebeginn (Frage nie geöffnet) wird keine Antwortzeit erfunden.
  if (speed && questionStartedAt === null) {
    throw new Error("Der Quizfortschritt hat sich geändert. Bitte lade den bestätigten Stand neu.");
  }
  const acceptedAt = Date.now();
  const completed = input.questionIndex === answers.length - 1;
  const correct = input.choiceId === `a${question.answers.findIndex((choice) => choice.correct)}`;
  const score = speed && questionStartedAt !== null
    ? scoreAsyncSpeedAnswer(correct, questionStartedAt, acceptedAt, scoringRuleOf(publication)) : null;
  const answer = { ...answerKey, questionIndex: input.questionIndex, choiceId: input.choiceId, acceptedAt,
    ...(score ? { questionStartedAt, elapsedMs: score.elapsedMs, basePoints: score.basePoints,
      bonusPoints: score.bonusPoints, points: score.points } : {}),
    ttl: Math.ceil(publication.retentionAt / 1000) };
  // Die Folgefrage bleibt bis zum ausdrücklichen „Weiter“ geschlossen; ihr Timer startet erst dann.
  const setParts = completed ? ["#status = :completed", "completedAt = :now"] : ["#status = :progress"];
  try {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Update: { TableName: tableName, Key: attemptKey,
        UpdateExpression: `SET ${setParts.join(", ")} ADD answeredCount :one, points :points`,
        ConditionExpression: "#status = :progress AND answeredCount = :index" +
          (speed ? " AND currentQuestionIndex = :index AND currentQuestionStartedAt = :questionStart" : ""),
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":progress": "IN_PROGRESS", ":one": 1, ":index": input.questionIndex,
          ":points": score ? score.points : correct ? 1 : 0,
          ...(completed ? { ":completed": "COMPLETED", ":now": acceptedAt } : {}),
          ...(speed ? { ":questionStart": questionStartedAt } : {}),
        } } },
      // Aggregierte Antwortverteilung und Abschlusszähler; Async-Runden haben geringe Schreibraten je Veröffentlichung.
      { Update: { TableName: tableName, Key: publicationKey(publication.publicationId),
        UpdateExpression: completed ? "ADD #stat :one, completedCount :one" : "ADD #stat :one",
        ConditionExpression: "#status = :active AND expiresAt > :now AND retentionAt > :now",
        ExpressionAttributeNames: { "#status": "status", "#stat": statAttribute(input.questionIndex, input.choiceId) },
        ExpressionAttributeValues: { ":active": "ACTIVE", ":now": acceptedAt, ":one": 1 } } },
      { Put: { TableName: tableName, Item: answer,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
    ] })));
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    const retry = await client.send(new GetCommand({ TableName: tableName, Key: answerKey, ConsistentRead: true }));
    if (retry.Item) {
      const saved = answerRecordSchema.parse(retry.Item);
      if (saved.choiceId === input.choiceId) {
        return confirmedReceipt(client, tableName, publication, attemptKey, input.questionIndex, saved.acceptedAt);
      }
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
  const confirmed: Attempt = {
    ...attempt, answeredCount: input.questionIndex + 1, status: completed ? "COMPLETED" : "IN_PROGRESS",
  };
  return answerReceipt(publication, confirmed, input.questionIndex, acceptedAt);
}

async function queryAll(
  client: DynamoDBDocumentClient, tableName: string, pk: string, prefix: string,
  projection?: string, names?: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await client.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
      ...(projection ? { ProjectionExpression: projection } : {}),
      ...(names ? { ExpressionAttributeNames: names } : {}),
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

async function completedCountOf(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, attempts?: Attempt[],
): Promise<number> {
  if (attempts) return attempts.filter((attempt) => attempt.status === "COMPLETED").length;
  if (publication.statsVersion === 1) return publication.completedCount ?? 0;
  // Ältere Veröffentlichungen ohne Zähler: einmalige, schlanke Zählung über die Versuche.
  const legacy = await queryAll(client, tableName, `ASYNC#${publication.publicationId}`, "ATTEMPT#", "#status",
    { "#status": "status" });
  return legacy.filter((item) => item.status === "COMPLETED").length;
}

async function summaries(
  client: DynamoDBDocumentClient, tableName: string, publication: Publication, token: string, now: number,
  attempts?: Attempt[],
) {
  const complete = await completedCountOf(client, tableName, publication, attempts);
  const participantCount = attempts?.length ?? publication.startedCount;
  const status = effectiveStatus(publication, now);
  return {
    publicationId: publication.publicationId, quizId: publication.quizId, title: publication.title, token,
    joinCode: publication.joinCode ?? null,
    createdAt: publication.createdAt, expiresAt: publication.expiresAt, timeZone: publication.timeZone,
    status, retentionAt: publication.retentionAt,
    endedAt: publication.endedAt ?? (status === "EXPIRED" ? publication.expiresAt : null),
    maxParticipants: publication.maxParticipants,
    participantCount,
    completedCount: complete, partialCount: Math.max(0, participantCount - complete),
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
  const candidates = unique.flatMap((ownerItem) => {
    if (typeof ownerItem.retentionAt === "number" && ownerItem.retentionAt <= now) return [];
    const publicationId = uuidSchema.safeParse(ownerItem.publicationId);
    const token = tokenSchema.safeParse(ownerItem.token);
    return publicationId.success && token.success ? [{ publicationId: publicationId.data, token: token.data }] : [];
  });
  // TTL deletion is asynchronous and unordered: skip index rows whose publication is already gone or past retention.
  // Aufbewahrungsfristen werden ausschließlich in `endAsyncPublication` synchronisiert.
  const stored = await batchGetAll(client, tableName, candidates.map(({ publicationId }) => publicationKey(publicationId)));
  const result = [];
  for (const candidate of candidates) {
    const item = stored.get(`ASYNC#${candidate.publicationId}#META`);
    const parsed = item ? publicationSchema.safeParse(item) : null;
    if (!parsed?.success) continue;
    const publication = asPublication(item);
    if (publication.ownerId !== ownerId || publication.retentionAt <= now) continue;
    const current = await ensureParticipantLimit(client, tableName, publication);
    result.push(await summaries(client, tableName, current, candidate.token, now));
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
  const input = z.object({ publicationId: uuidSchema, cursor: z.string().regex(/^\d+$/).nullish() }).strict().parse(raw);
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
  const attempts = (await queryAll(client, tableName, `ASYNC#${input.publicationId}`, "ATTEMPT#"))
    .map((item) => attemptSchema.parse(item));
  const questionCount = publication.snapshot.questions.length;
  const aggregated = publication.statsVersion === 1;
  // Ältere Veröffentlichungen ohne Aggregate: alle Antworten einmalig laden (Rückwärtskompatibilität).
  const legacyAnswers = new Map<string, AnswerRecord[]>();
  if (!aggregated) {
    for (const rawAnswer of await queryAll(client, tableName, `ASYNC#${input.publicationId}`, "ANSWER#")) {
      const match = /^ANSWER#([a-f0-9]{64})#/.exec(String(rawAnswer.sk));
      if (!match) throw new Error("Ungültiger gespeicherter Antwortdatensatz.");
      const list = legacyAnswers.get(match[1]) ?? [];
      list.push(answerRecordSchema.parse(rawAnswer));
      legacyAnswers.set(match[1], list);
    }
  }
  const isCorrect = (answer: AnswerRecord) => answer.choiceId ===
    `a${publication.snapshot.questions[answer.questionIndex].answers.findIndex((choice) => choice.correct)}`;
  if (aggregated) {
    for (const question of answers) {
      for (const option of question.options) {
        option.count = publication.optionCounts?.get(statAttribute(question.questionIndex, option.id)) ?? 0;
        question.answeredCount += option.count;
      }
    }
  } else {
    for (const list of legacyAnswers.values()) {
      for (const answer of list) {
        answers[answer.questionIndex].answeredCount++;
        const option = answers[answer.questionIndex].options.find((item) => item.id === answer.choiceId);
        if (option) option.count++;
      }
    }
  }
  const players = attempts.map((attempt) => {
    const legacy = legacyAnswers.get(attempt.identityHash) ?? [];
    const answeredCount = aggregated ? attempt.answeredCount : legacy.length;
    const complete = attempt.status === "COMPLETED" || answeredCount === questionCount;
    return {
      identityHash: attempt.identityHash,
      attemptId: attemptIdFor(publication.publicationId, attempt.identityHash),
      displayName: attempt.displayName, avatarId: attempt.avatarId, startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? (complete && !aggregated ? legacy.at(-1)?.acceptedAt ?? null : null),
      answeredCount, questionCount,
      status: complete ? "COMPLETED" : statusOf(publication, now) === "ACTIVE" ? "IN_PROGRESS" : "EXPIRED_PARTIAL",
      points: aggregated ? attempt.points ?? 0 : legacy.filter(isCorrect).length,
      rank: 0,
    };
  });
  // Gleichstand: alphabetisch nach Spielname, danach stabile Versuchskennung (siehe README „Quiz zum Mitmachen“).
  players.sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName) ||
    left.attemptId.localeCompare(right.attemptId));
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
  const summary = await summaries(client, tableName, publication, "", resultTime, attempts);
  const participantPage = await mapWithConcurrency(players.slice(offset, offset + pageSize), 10, async (player) => {
    const list = aggregated
      ? await listAttemptAnswers(client, tableName, publication.publicationId, player.identityHash)
      : (legacyAnswers.get(player.identityHash) ?? []).sort((left, right) => left.questionIndex - right.questionIndex);
    const { identityHash: _identity, ...visible } = player;
    return { ...visible, answers: list.map((answer) => {
      const { correct: _correct, ...score } = answerScore(publication, answer);
      return { questionIndex: answer.questionIndex, choiceId: answer.choiceId, acceptedAt: answer.acceptedAt,
        correct: isCorrect(answer), ...score };
    }) };
  });
  // Globale Top 5 unabhängig von der angeforderten Seite (Einzelantworten bleiben den Teilnehmerseiten vorbehalten).
  const leaders = players.slice(0, 5).map(({ identityHash: _identity, ...visible }) => ({ ...visible, answers: [] }));
  return {
    ...summary, ...scoringInfo(publication), token: undefined, updatedAt: resultTime,
    isFinal: statusOf(publication, resultTime) !== "ACTIVE",
    questions: answers, participants: participantPage, leaders, totalParticipants: players.length,
    nextCursor: offset + participantPage.length < players.length ? String(offset + participantPage.length) : null,
  };
}
