import { Amplify } from "aws-amplify";
import { generateClient, type GraphQLQuery, type GraphQLSubscription } from "aws-amplify/api";
import {
  CognitoAWSCredentialsAndIdentityIdProvider, DefaultIdentityIdStore, cognitoUserPoolsTokenProvider,
} from "aws-amplify/auth/cognito";
import { z } from "zod";
import { quizSchema } from "./domain/quiz";
import { createExpiringIdentityStorage } from "./guestIdentityStorage";

export const client = generateClient();
let guestIdentityStorage: ReturnType<typeof createExpiringIdentityStorage> | undefined;
const outputsSchema = z.object({
  version: z.string(),
  auth: z.object({ aws_region: z.string(), user_pool_id: z.string(), user_pool_client_id: z.string(),
    identity_pool_id: z.string(), unauthenticated_identities_enabled: z.boolean() }).passthrough(),
  data: z.object({ url: z.string().url(), aws_region: z.string(), default_authorization_type: z.string(),
    authorization_types: z.array(z.string()) }).passthrough(),
}).passthrough();

export async function configureCloud(): Promise<boolean> {
  const response = await fetch("/amplify_outputs.json", { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return false;
  const outputs = outputsSchema.parse(await response.json());
  let guestCredentialsProvider: CognitoAWSCredentialsAndIdentityIdProvider | undefined;
  guestIdentityStorage = createExpiringIdentityStorage(undefined, Date.now, undefined,
    () => guestCredentialsProvider?.clearCredentials());
  guestCredentialsProvider = new CognitoAWSCredentialsAndIdentityIdProvider(new DefaultIdentityIdStore(guestIdentityStorage));
  Amplify.configure(outputs, {
    Auth: {
      tokenProvider: cognitoUserPoolsTokenProvider,
      credentialsProvider: guestCredentialsProvider,
    },
  });
  const auth = Amplify.getConfig().Auth;
  if (auth) cognitoUserPoolsTokenProvider.setAuthConfig(auth);
  return true;
}

const quizRecord = z.object({ quizId: z.string(), version: z.number(), updatedAt: z.number(), quiz: quizSchema });
const quizSummary = z.object({ quizId: z.string(), version: z.number(), updatedAt: z.number(), title: z.string(),
  description: z.string(), questionCount: z.number() });
const quizSummaryPage = z.object({ items: z.array(quizSummary), nextCursor: z.string().nullish() });
const sessionSummary = z.object({ sessionId: z.string(), title: z.string(), status: z.string(),
  joinCode: z.string(), presentationToken: z.string(), createdAt: z.number() });
const participation = z.object({ sessionId: z.string(), participantId: z.string(), displayName: z.string(),
  avatarId: z.string(), joinedAt: z.number() });
const player = z.object({ participantId: z.string(), displayName: z.string(), avatarId: z.string() });
const gamificationFields = {
  streak: z.number().nullish(), maxStreak: z.number().nullish(), badges: z.array(z.string()).nullish(),
};
const rankedPlayer = player.extend({ points: z.number(), correctAnswers: z.number(), correctElapsedMs: z.number(), rank: z.number(),
  previousRank: z.number(), rankChange: z.number(), previousPoints: z.number().nullish(), ...gamificationFields });
const myResult = z.object({ questionId: z.string(), answered: z.boolean(), correct: z.boolean(),
  points: z.number(), totalPoints: z.number(), elapsedMs: z.number().nullish(),
  streakBonusPoints: z.number().nullish(), ...gamificationFields });
export type MyResult = z.infer<typeof myResult>;
const asyncScoreFields = {
  points: z.number().nullish(), basePoints: z.number().nullish(), bonusPoints: z.number().nullish(),
  elapsedMs: z.number().nullish(),
  streakBonusPoints: z.number().nullish(), streak: z.number().nullish(), maxStreak: z.number().nullish(),
};
const asyncScoringInfo = {
  scoringVersion: z.string().nullish(), basePoints: z.number().nullish(), maxBonusPoints: z.number().nullish(),
  bonusWindowMs: z.number().nullish(),
  streakBonusEnabled: z.boolean().nullish(), immediateReveal: z.boolean().nullish(),
};
const asyncPublicInfo = z.object({
  title: z.string(), description: z.string(), questionCount: z.number(), expiresAt: z.number(),
  timeZone: z.string(), status: z.string(), retentionAt: z.number(), endedAt: z.number().nullable().optional(),
  maxParticipants: z.number(), serverTime: z.number().nullable().optional(),
  joinCode: z.string().nullish(),
  ...asyncScoringInfo,
});
const asyncGuestAnswer = z.object({
  questionIndex: z.number(), choiceId: z.string(), acceptedAt: z.number(),
  correct: z.boolean().nullable().optional(), correctChoiceId: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(), questionText: z.string().nullable().optional(),
  selectedText: z.string().nullable().optional(), correctText: z.string().nullable().optional(),
  ...asyncScoreFields,
});
const asyncQuestion = z.object({
  questionIndex: z.number(), text: z.string(),
  answers: z.array(z.object({ id: z.string(), text: z.string() })),
  startedAt: z.number().nullish(),
});
const asyncOwnQuestionResult = z.object({
  questionIndex: z.number(), questionText: z.string(), answered: z.boolean(),
  selectedText: z.string().nullable().optional(), correctText: z.string().nullable().optional(),
  correct: z.boolean().nullable().optional(), explanation: z.string().nullable().optional(),
  acceptedAt: z.number().nullable().optional(),
  ...asyncScoreFields,
});
const asyncGuestState = asyncPublicInfo.extend({
  displayName: z.string(), avatarId: z.string(), startedAt: z.number(), answeredCount: z.number(),
  attemptStatus: z.string(), nextQuestionIndex: z.number(), answers: z.array(asyncGuestAnswer),
  question: asyncQuestion.nullable().optional(), points: z.number().nullable().optional(),
  results: z.array(asyncOwnQuestionResult),
  ...gamificationFields, rank: z.number().nullish(),
});
const asyncAnswerReceipt = z.object({
  acceptedAt: z.number(), answeredCount: z.number(), questionIndex: z.number().nullish(),
  attemptStatus: z.string().nullish(), status: z.string().nullish(), nextQuestionIndex: z.number().nullish(),
  question: asyncQuestion.nullish(), serverTime: z.number().nullish(),
  state: asyncGuestState.nullish(),
});
const asyncPublicationSummary = z.object({
  publicationId: z.string(), quizId: z.string(), title: z.string(), token: z.string(), joinCode: z.string().nullish(),
  createdAt: z.number(), expiresAt: z.number(), timeZone: z.string(), status: z.string(),
  retentionAt: z.number(), endedAt: z.number().nullable().optional(),
  participantCount: z.number(), maxParticipants: z.number(), completedCount: z.number(), partialCount: z.number(),
});
const asyncPlayerAnswer = z.object({
  questionIndex: z.number(), choiceId: z.string(), acceptedAt: z.number(), correct: z.boolean(),
  ...asyncScoreFields,
});
const asyncParticipantResult = z.object({
  attemptId: z.string(), displayName: z.string(), avatarId: z.string(), startedAt: z.number(), completedAt: z.number().nullable().optional(),
  answeredCount: z.number(), questionCount: z.number(), status: z.string(), points: z.number(), rank: z.number(),
  answers: z.array(asyncPlayerAnswer),
  ...gamificationFields,
});
const asyncStandingParticipant = asyncParticipantResult.omit({ answers: true }).extend({
  previousRank: z.number().optional(), rankChange: z.number().optional(), previousPoints: z.number().optional(),
});
const asyncQuestionResult = z.object({
  questionIndex: z.number(), text: z.string(), correctChoiceId: z.string(), explanation: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string(), correct: z.boolean(), count: z.number() })),
  answeredCount: z.number(),
});
const asyncResults = z.object({
  publicationId: z.string(), quizId: z.string(), title: z.string(), createdAt: z.number(), expiresAt: z.number(),
  timeZone: z.string(), status: z.string(), retentionAt: z.number(), participantCount: z.number(), maxParticipants: z.number(),
  endedAt: z.number().nullable().optional(),
  completedCount: z.number(), partialCount: z.number(), isFinal: z.boolean(), updatedAt: z.number(),
  questions: z.array(asyncQuestionResult), participants: z.array(asyncParticipantResult),
  nextCursor: z.string().nullable().optional(),
  leaders: z.array(asyncParticipantResult).nullish(), totalParticipants: z.number().nullish(),
  ...asyncScoringInfo,
});
const asyncStandings = asyncResults.omit({ participants: true, nextCursor: true, leaders: true }).extend({
  participants: z.array(asyncStandingParticipant), totalParticipants: z.number(),
});
const asyncPublishReceipt = z.object({
  publicationId: z.string(), token: z.string(), joinCode: z.string(), expiresAt: z.number(), timeZone: z.string(),
  retentionDays: z.number(), maxParticipants: z.number(),
});
const joinCodeResolution = z.object({ mode: z.enum(["LIVE", "ASYNC"]), joinCode: z.string() });
export type AsyncPublicInfo = z.infer<typeof asyncPublicInfo>;
export type AsyncGuestState = z.infer<typeof asyncGuestState>;
export type AsyncPublicationSummary = z.infer<typeof asyncPublicationSummary>;
export type AsyncPublicationResults = z.infer<typeof asyncResults>;
export type AsyncParticipantResult = z.infer<typeof asyncParticipantResult>;
export type AsyncStandings = z.infer<typeof asyncStandings>;
export type AsyncStandingParticipant = z.infer<typeof asyncStandingParticipant>;
export type AsyncQuestion = z.infer<typeof asyncQuestion>;
export type AsyncAnswerReceipt = z.infer<typeof asyncAnswerReceipt>;
const asyncScoreSelection = "points basePoints bonusPoints elapsedMs streakBonusPoints streak maxStreak";
const asyncStandingParticipantSelection = "attemptId displayName avatarId startedAt completedAt answeredCount questionCount status points rank streak maxStreak badges";
const asyncParticipantSelection = `${asyncStandingParticipantSelection} answers { questionIndex choiceId acceptedAt correct ${asyncScoreSelection} }`;
const asyncQuestionSelection = "question { questionIndex text startedAt answers { id text } }";
const asyncGuestStateSelection = `title description questionCount expiresAt
  timeZone status retentionAt endedAt maxParticipants serverTime displayName avatarId startedAt answeredCount attemptStatus nextQuestionIndex points
  scoringVersion basePoints maxBonusPoints bonusWindowMs streakBonusEnabled immediateReveal streak maxStreak badges rank
  answers { questionIndex choiceId acceptedAt correct correctChoiceId explanation questionText selectedText correctText ${asyncScoreSelection} }
  results { questionIndex questionText answered selectedText correctText correct explanation acceptedAt ${asyncScoreSelection} }
  ${asyncQuestionSelection}`;
export const gameStateSchema = z.object({
  sessionId: z.string(), status: z.string(), version: z.number(), title: z.string(), questionId: z.string().nullish(),
  joinCode: z.string().nullish(),
  streakBonusEnabled: z.boolean().nullish(),
  questionIndex: z.number(), questionCount: z.number(), participantCount: z.number(), opensAt: z.number().nullish(),
  closesAt: z.number().nullish(), answerCount: z.number(), eligibleParticipantCount: z.number(), serverTime: z.number(),
  question: z.object({ text: z.string(), answers: z.array(z.object({ id: z.string(), text: z.string() })) }).nullish(),
  reveal: z.object({ correctChoiceId: z.string(), explanation: z.string(),
    distribution: z.array(z.object({ choiceId: z.string(), count: z.number() })) }).nullish(),
  participants: z.array(player), leaderboard: z.array(rankedPlayer),
});
export type GameState = z.infer<typeof gameStateSchema>;
export type Participation = z.infer<typeof participation>;
export type SessionSummary = z.infer<typeof sessionSummary>;
export type QuizRecord = z.infer<typeof quizRecord>;
export type QuizSummary = z.infer<typeof quizSummary>;
const gameEvent = z.object({ sessionId: z.string(), version: z.number(),
  participantCount: z.number().nullish(), answerCount: z.number().nullish() });
export type GameEvent = z.infer<typeof gameEvent>;

const quizFields = "quizId version updatedAt quiz { title description questions { text durationSeconds explanation answers { text correct } } }";
const participationFields = "sessionId participantId displayName avatarId joinedAt";
const stateFields = `sessionId status version title joinCode streakBonusEnabled questionId questionIndex questionCount participantCount opensAt closesAt
  answerCount eligibleParticipantCount serverTime question { text answers { id text } }
  reveal { correctChoiceId explanation distribution { choiceId count } }
  participants { participantId displayName avatarId }
  leaderboard { participantId displayName avatarId points correctAnswers correctElapsedMs rank previousRank rankChange previousPoints streak maxStreak badges }`;

type AuthMode = "userPool" | "identityPool";
async function operation<T>(query: string, field: string, variables: Record<string, unknown>, authMode: AuthMode, schema: z.ZodType<T>): Promise<T> {
  const response = await client.graphql<GraphQLQuery<Record<string, unknown>>>({ query, variables, authMode });
  if (response.errors?.length) throw new Error(response.errors.map((error) => error.message).join("; "));
  return schema.parse(response.data?.[field]);
}

export const cloud = {
  listQuizzes: async () => {
    const items: QuizSummary[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await operation("query ListQuizzes($cursor: String) { listQuizzes(cursor: $cursor) { items { quizId version updatedAt title description questionCount } nextCursor } }",
        "listQuizzes", { cursor }, "userPool", quizSummaryPage);
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  },
  getQuiz: (quizId: string) => operation(`query GetQuiz($quizId: ID!) { getQuiz(quizId: $quizId) { ${quizFields} } }`,
    "getQuiz", { quizId }, "userPool", quizRecord),
  createQuiz: (quiz: z.infer<typeof quizSchema>) => operation(`mutation CreateQuiz($quiz: QuizInput!) { createQuiz(quiz: $quiz) { ${quizFields} } }`,
    "createQuiz", { quiz }, "userPool", quizRecord),
  updateQuiz: (quizId: string, expectedVersion: number, quiz: z.infer<typeof quizSchema>) =>
    operation(`mutation UpdateQuiz($quizId: ID!, $expectedVersion: Int!, $quiz: QuizInput!) { updateQuiz(quizId: $quizId, expectedVersion: $expectedVersion, quiz: $quiz) { ${quizFields} } }`,
      "updateQuiz", { quizId, expectedVersion, quiz }, "userPool", quizRecord),
  duplicateQuiz: (quizId: string) => operation(`mutation DuplicateQuiz($quizId: ID!) { duplicateQuiz(quizId: $quizId) { ${quizFields} } }`,
    "duplicateQuiz", { quizId }, "userPool", quizRecord),
  deleteQuiz: (quizId: string, expectedVersion: number) =>
    operation("mutation DeleteQuiz($quizId: ID!, $expectedVersion: Int!) { deleteQuiz(quizId: $quizId, expectedVersion: $expectedVersion) }",
      "deleteQuiz", { quizId, expectedVersion }, "userPool", z.boolean()),
  listSessions: () => operation("query { listSessions { sessionId title status joinCode presentationToken createdAt } }",
    "listSessions", {}, "userPool", z.array(sessionSummary)),
  getSession: (sessionId: string) => operation("query GetSession($sessionId: ID!) { getSession(sessionId: $sessionId) { sessionId title status joinCode presentationToken createdAt } }",
    "getSession", { sessionId }, "userPool", sessionSummary),
  createSession: (quizId: string, streakBonusEnabled = false) => operation("mutation CreateSession($quizId: ID!, $streakBonusEnabled: Boolean!) { createSession(quizId: $quizId, streakBonusEnabled: $streakBonusEnabled) { sessionId joinCode presentationToken } }",
    "createSession", { quizId, streakBonusEnabled }, "userPool", z.object({ sessionId: z.string(), joinCode: z.string(), presentationToken: z.string() })),
  questions: (sessionId: string) => operation("query Questions($sessionId: ID!) { listSessionQuestions(sessionId: $sessionId) { questionId index text } }",
    "listSessionQuestions", { sessionId }, "userPool", z.array(z.object({ questionId: z.string(), index: z.number(), text: z.string() }))),
  join: (joinCode: string) => operation(`mutation Join($joinCode: String!) { joinSession(joinCode: $joinCode) { ${participationFields} } }`,
    "joinSession", { joinCode }, "identityPool", participation),
  deleteMyParticipation: (sessionId: string) => operation("mutation DeleteMyParticipation($sessionId: ID!) { deleteMyParticipation(sessionId: $sessionId) }",
    "deleteMyParticipation", { sessionId }, "identityPool", z.boolean()),
  myParticipation: (sessionId: string) => operation(`query Participation($sessionId: ID!) { getMyParticipation(sessionId: $sessionId) { ${participationFields} } }`,
    "getMyParticipation", { sessionId }, "identityPool", participation),
  gameState: (sessionId: string, mode: "admin" | "guest") => {
    const field = mode === "admin" ? "getAdminGameState" : "getGameState";
    return operation(`query State($sessionId: ID!) { ${field}(sessionId: $sessionId) { ${stateFields} } }`,
      field, { sessionId }, mode === "admin" ? "userPool" : "identityPool", gameStateSchema);
  },
  presentation: (presentationToken: string) => operation(`query Presentation($presentationToken: String!) { getPresentationState(presentationToken: $presentationToken) { ${stateFields} } }`,
    "getPresentationState", { presentationToken }, "identityPool", gameStateSchema),
  result: (sessionId: string) => operation("query Result($sessionId: ID!) { getMyResult(sessionId: $sessionId) { questionId answered correct points totalPoints elapsedMs streakBonusPoints streak maxStreak badges } }",
    "getMyResult", { sessionId }, "identityPool", myResult),
  myAnswer: (sessionId: string) => operation("query MyAnswer($sessionId: ID!) { getMyAnswer(sessionId: $sessionId) { questionId choiceId } }",
    "getMyAnswer", { sessionId }, "identityPool", z.object({ questionId: z.string().nullish(), choiceId: z.string().nullish() })),
  answer: (sessionId: string, questionId: string, choiceId: string) =>
    operation("mutation Answer($sessionId: ID!, $questionId: ID!, $choiceId: ID!) { submitAnswer(sessionId: $sessionId, questionId: $questionId, choiceId: $choiceId) { acceptedAt } }",
      "submitAnswer", { sessionId, questionId, choiceId }, "identityPool", z.object({ acceptedAt: z.number() })),
  control: (action: "startQuestion" | "nextQuestion" | "closeQuestion", sessionId: string, questionId: string, expectedVersion: number) =>
    operation(`mutation Control($sessionId: ID!, $questionId: ID!, $expectedVersion: Int!) { ${action}(sessionId: $sessionId, questionId: $questionId, expectedVersion: $expectedVersion) { version } }`,
      action, { sessionId, questionId, expectedVersion }, "userPool", z.object({ version: z.number() })),
  transition: (action: "showLeaderboard" | "finishSession" | "cancelSession", sessionId: string, expectedVersion: number) =>
    operation(`mutation Transition($sessionId: ID!, $expectedVersion: Int!) { ${action}(sessionId: $sessionId, expectedVersion: $expectedVersion) { version } }`,
      action, { sessionId, expectedVersion }, "userPool", z.object({ version: z.number() })),
  subscribe: (sessionId: string, mode: "admin" | "guest", presentationToken: string | null, onEvent: (event: GameEvent) => void, onError: (error: unknown) => void) =>
    client.graphql<GraphQLSubscription<{ onGameChange: GameEvent }>>({
      query: "subscription GameChange($sessionId: ID!, $presentationToken: String) { onGameChange(sessionId: $sessionId, presentationToken: $presentationToken) { sessionId version participantCount answerCount } }",
      variables: { sessionId, presentationToken }, authMode: mode === "admin" ? "userPool" : "identityPool",
    }).subscribe({
      next: (event) => {
        const parsed = z.object({ onGameChange: gameEvent }).safeParse(event.data);
        if (parsed.success && parsed.data.onGameChange.sessionId === sessionId) onEvent(parsed.data.onGameChange);
        else onError(new Error("Ungültiges Echtzeitereignis."));
      },
      error: onError,
    }),
  asyncPublicInfo: (token: string) => operation(
    `query AsyncInfo($token: String!) { getAsyncPublicInfo(token: $token) { title description questionCount expiresAt timeZone status retentionAt endedAt maxParticipants serverTime joinCode
      scoringVersion basePoints maxBonusPoints bonusWindowMs streakBonusEnabled immediateReveal } }`,
    "getAsyncPublicInfo", { token }, "identityPool", asyncPublicInfo),
  publishAsyncQuiz: (quizId: string, requestId: string, expiresAt: number, timeZone: string, streakBonusEnabled = false, immediateReveal = true) => operation(
    "mutation PublishAsync($quizId: ID!, $requestId: ID!, $expiresAt: Float!, $timeZone: String!, $streakBonusEnabled: Boolean!, $immediateReveal: Boolean!) { publishAsyncQuiz(quizId: $quizId, requestId: $requestId, expiresAt: $expiresAt, timeZone: $timeZone, streakBonusEnabled: $streakBonusEnabled, immediateReveal: $immediateReveal) { publicationId token joinCode expiresAt timeZone retentionDays maxParticipants } }",
    "publishAsyncQuiz", { quizId, requestId, expiresAt, timeZone, streakBonusEnabled, immediateReveal }, "userPool", asyncPublishReceipt),
  listAsyncPublications: () => operation(
    `query { listAsyncPublications { publicationId quizId title token joinCode createdAt expiresAt timeZone status
      retentionAt endedAt participantCount maxParticipants completedCount partialCount } }`,
    "listAsyncPublications", {}, "userPool", z.array(asyncPublicationSummary)),
  ensureAsyncJoinCode: (publicationId: string) => operation(
    "mutation EnsureJoinCode($publicationId: ID!) { ensureAsyncJoinCode(publicationId: $publicationId) { publicationId joinCode } }",
    "ensureAsyncJoinCode", { publicationId }, "userPool", z.object({ publicationId: z.string(), joinCode: z.string() })),
  resolveJoinCode: (joinCode: string) => operation(
    "query ResolveJoinCode($joinCode: String!) { resolveJoinCode(joinCode: $joinCode) { mode joinCode } }",
    "resolveJoinCode", { joinCode }, "identityPool", joinCodeResolution),
  endAsyncPublication: (publicationId: string) => operation(
    "mutation EndAsync($publicationId: ID!) { endAsyncPublication(publicationId: $publicationId) { status endedAt } }",
    "endAsyncPublication", { publicationId }, "userPool", z.object({ status: z.string(), endedAt: z.number() })),
  asyncPublicationResults: (publicationId: string, cursor?: string) => operation(
    `query AsyncResults($publicationId: ID!, $cursor: String) { getAsyncPublicationResults(publicationId: $publicationId, cursor: $cursor) {
      publicationId quizId title createdAt expiresAt timeZone status retentionAt endedAt participantCount maxParticipants completedCount
      partialCount isFinal updatedAt questions { questionIndex text correctChoiceId explanation answeredCount
        options { id text correct count } } participants { ${asyncParticipantSelection} } nextCursor
      leaders { ${asyncParticipantSelection} } totalParticipants scoringVersion basePoints maxBonusPoints bonusWindowMs streakBonusEnabled immediateReveal } }`,
    "getAsyncPublicationResults", { publicationId, cursor }, "userPool", asyncResults),
  asyncStandings: (publicationId: string) => operation(
    `query AsyncStandings($publicationId: ID!) { getAsyncStandings(publicationId: $publicationId) {
      publicationId quizId title createdAt expiresAt timeZone status retentionAt endedAt participantCount maxParticipants completedCount
      partialCount isFinal updatedAt questions { questionIndex text correctChoiceId explanation answeredCount
        options { id text correct count } } participants { ${asyncStandingParticipantSelection} }
      totalParticipants scoringVersion basePoints maxBonusPoints bonusWindowMs streakBonusEnabled immediateReveal } }`,
    "getAsyncStandings", { publicationId }, "userPool", asyncStandings),
  startAsyncQuiz: (token: string) => operation(
    `mutation StartAsync($token: String!) { startAsyncQuiz(token: $token) { ${asyncGuestStateSelection} } }`,
    "startAsyncQuiz", { token }, "identityPool", asyncGuestState),
  myAsyncState: (token: string) => operation(
    `query MyAsyncState($token: String!) { getMyAsyncState(token: $token) { ${asyncGuestStateSelection} } }`,
    "getMyAsyncState", { token }, "identityPool", asyncGuestState.nullable()),
  extendGuestIdentityUntil: (expiry: number) => {
    if (!guestIdentityStorage) throw new Error("Die Gastidentität ist nicht konfiguriert.");
    return guestIdentityStorage.extendIdentityUntil(expiry);
  },
  submitAsyncAnswer: (token: string, questionIndex: number, choiceId: string) => operation(
    `mutation SubmitAsync($token: String!, $questionIndex: Int!, $choiceId: ID!) {
      submitAsyncAnswer(token: $token, questionIndex: $questionIndex, choiceId: $choiceId) {
        acceptedAt answeredCount questionIndex attemptStatus status nextQuestionIndex serverTime ${asyncQuestionSelection}
        state { ${asyncGuestStateSelection} } } }`,
    "submitAsyncAnswer", { token, questionIndex, choiceId }, "identityPool", asyncAnswerReceipt),
};
