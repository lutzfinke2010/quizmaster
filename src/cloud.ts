import { Amplify } from "aws-amplify";
import { generateClient, type GraphQLQuery, type GraphQLSubscription } from "aws-amplify/api";
import {
  CognitoAWSCredentialsAndIdentityIdProvider, DefaultIdentityIdStore, cognitoUserPoolsTokenProvider,
} from "aws-amplify/auth/cognito";
import { z } from "zod";
import { quizSchema } from "./domain/quiz";
import { createExpiringIdentityStorage } from "./guestIdentityStorage";

export const client = generateClient();
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
  // Eigene Provider, damit die Gast-Kennung nach 24 Stunden verfällt; dann muss der Token-Provider manuell konfiguriert werden.
  Amplify.configure(outputs, {
    Auth: {
      tokenProvider: cognitoUserPoolsTokenProvider,
      credentialsProvider: new CognitoAWSCredentialsAndIdentityIdProvider(
        new DefaultIdentityIdStore(createExpiringIdentityStorage())),
    },
  });
  const auth = Amplify.getConfig().Auth;
  if (auth) cognitoUserPoolsTokenProvider.setAuthConfig(auth);
  return true;
}

const quizRecord = z.object({ quizId: z.string(), version: z.number(), updatedAt: z.number(), quiz: quizSchema });
const sessionSummary = z.object({ sessionId: z.string(), title: z.string(), status: z.string(),
  joinCode: z.string(), presentationToken: z.string(), createdAt: z.number() });
const participation = z.object({ sessionId: z.string(), participantId: z.string(), displayName: z.string(),
  avatarId: z.string(), joinedAt: z.number() });
const player = z.object({ participantId: z.string(), displayName: z.string(), avatarId: z.string() });
const rankedPlayer = player.extend({ points: z.number(), correctAnswers: z.number(), correctElapsedMs: z.number(), rank: z.number(),
  previousRank: z.number(), rankChange: z.number() });
const myResult = z.object({ questionId: z.string(), answered: z.boolean(), correct: z.boolean(),
  points: z.number(), totalPoints: z.number(), elapsedMs: z.number().nullish() });
export type MyResult = z.infer<typeof myResult>;
export const gameStateSchema = z.object({
  sessionId: z.string(), status: z.string(), version: z.number(), title: z.string(), questionId: z.string().nullish(),
  joinCode: z.string().nullish(),
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

const quizFields = "quizId version updatedAt quiz { title description questions { text durationSeconds explanation answers { text correct } } }";
const participationFields = "sessionId participantId displayName avatarId joinedAt";
const stateFields = `sessionId status version title joinCode questionId questionIndex questionCount participantCount opensAt closesAt
  answerCount eligibleParticipantCount serverTime question { text answers { id text } }
  reveal { correctChoiceId explanation distribution { choiceId count } }
  participants { participantId displayName avatarId }
  leaderboard { participantId displayName avatarId points correctAnswers correctElapsedMs rank previousRank rankChange }`;

type AuthMode = "userPool" | "identityPool";
async function operation<T>(query: string, field: string, variables: Record<string, unknown>, authMode: AuthMode, schema: z.ZodType<T>): Promise<T> {
  const response = await client.graphql<GraphQLQuery<Record<string, unknown>>>({ query, variables, authMode });
  if (response.errors?.length) throw new Error(response.errors.map((error) => error.message).join("; "));
  return schema.parse(response.data?.[field]);
}

export const cloud = {
  listQuizzes: () => operation(`query { listQuizzes { ${quizFields} } }`, "listQuizzes", {}, "userPool", z.array(quizRecord)),
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
  createSession: (quizId: string) => operation("mutation CreateSession($quizId: ID!) { createSession(quizId: $quizId) { sessionId joinCode presentationToken } }",
    "createSession", { quizId }, "userPool", z.object({ sessionId: z.string(), joinCode: z.string(), presentationToken: z.string() })),
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
  result: (sessionId: string) => operation("query Result($sessionId: ID!) { getMyResult(sessionId: $sessionId) { questionId answered correct points totalPoints elapsedMs } }",
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
  subscribe: (sessionId: string, mode: "admin" | "guest", presentationToken: string | null, onEvent: (version: number) => void, onError: (error: unknown) => void) =>
    client.graphql<GraphQLSubscription<{ onGameChange: { sessionId: string; version: number } }>>({
      query: "subscription GameChange($sessionId: ID!, $presentationToken: String) { onGameChange(sessionId: $sessionId, presentationToken: $presentationToken) { sessionId version } }",
      variables: { sessionId, presentationToken }, authMode: mode === "admin" ? "userPool" : "identityPool",
    }).subscribe({
      next: (event) => {
        const parsed = z.object({ onGameChange: z.object({ sessionId: z.string(), version: z.number() }) }).safeParse(event.data);
        if (parsed.success && parsed.data.onGameChange.sessionId === sessionId) onEvent(parsed.data.onGameChange.version);
        else onError(new Error("Ungültiges Echtzeitereignis."));
      },
      error: onError,
    }),
};
