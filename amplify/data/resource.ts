import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { gameApi } from "../functions/api/resource";
import { subscriptionAuth } from "../functions/events/resource";

const gamificationFields = () => ({
  streak: a.integer(), maxStreak: a.integer(), badges: a.string().array(),
});
const roundOptions = () => ({
  streakBonusEnabled: a.boolean(), immediateReveal: a.boolean(),
});
const streakScoreFields = () => ({
  streakBonusPoints: a.integer(), streak: a.integer(), maxStreak: a.integer(),
});

const schema = a.schema({
  Answer: a.customType({ text: a.string().required(), correct: a.boolean().required() }),
  Question: a.customType({
    text: a.string().required(), durationSeconds: a.integer().required(), explanation: a.string().required(),
    answers: a.ref("Answer").array().required(),
  }),
  Quiz: a.customType({
    title: a.string().required(), description: a.string().required(), questions: a.ref("Question").array().required(),
  }),
  QuizRecord: a.customType({
    quizId: a.id().required(), version: a.integer().required(), updatedAt: a.float().required(), quiz: a.ref("Quiz").required(),
  }),
  QuizSummary: a.customType({
    quizId: a.id().required(), version: a.integer().required(), updatedAt: a.float().required(),
    title: a.string().required(), description: a.string().required(), questionCount: a.integer().required(),
  }),
  QuizGenerationRequest: a.customType({
    title: a.string().required(), topic: a.string().required(), questionCount: a.integer().required(),
    answerCount: a.integer().required(), difficulty: a.string().required(), audience: a.string().required(),
    language: a.string().required(), durationSeconds: a.integer().required(), includeExplanations: a.boolean().required(),
    tone: a.string().required(), notes: a.string().required(),
  }),
  QuizGenerationJob: a.customType({
    jobId: a.id().required(), status: a.string().required(), createdAt: a.float().required(), quiz: a.ref("Quiz"), error: a.string(),
  }),
  QuizSummaryPage: a.customType({ items: a.ref("QuizSummary").array().required(), nextCursor: a.string() }),
  SessionCreated: a.customType({ sessionId: a.id().required(), joinCode: a.string().required(), presentationToken: a.string().required() }),
  SessionSummary: a.customType({
    sessionId: a.id().required(), title: a.string().required(), status: a.string().required(),
    joinCode: a.string().required(), presentationToken: a.string().required(), createdAt: a.float().required(),
  }),
  Participation: a.customType({
    sessionId: a.id().required(), participantId: a.id().required(), displayName: a.string().required(),
    avatarId: a.string().required(), joinedAt: a.float().required(),
  }),
  PublicAnswer: a.customType({ id: a.id().required(), text: a.string().required() }),
  PublicQuestion: a.customType({ text: a.string().required(), answers: a.ref("PublicAnswer").array().required() }),
  Distribution: a.customType({ choiceId: a.id().required(), count: a.integer().required() }),
  Reveal: a.customType({
    correctChoiceId: a.id().required(), explanation: a.string().required(), distribution: a.ref("Distribution").array().required(),
  }),
  Player: a.customType({ participantId: a.id().required(), displayName: a.string().required(), avatarId: a.string().required() }),
  RankedPlayer: a.customType({
    ...gamificationFields(),
    participantId: a.id().required(), displayName: a.string().required(), avatarId: a.string().required(),
    points: a.integer().required(), correctAnswers: a.integer().required(), correctElapsedMs: a.float().required(), rank: a.integer().required(),
    previousRank: a.integer().required(), rankChange: a.integer().required(),
    previousPoints: a.integer(),
  }),
  GameState: a.customType({
    streakBonusEnabled: a.boolean(),
    sessionId: a.id().required(), status: a.string().required(), version: a.integer().required(), title: a.string().required(),
    joinCode: a.string(),
    questionId: a.id(), questionIndex: a.integer().required(), questionCount: a.integer().required(), participantCount: a.integer().required(),
    opensAt: a.float(), closesAt: a.float(), answerCount: a.integer().required(), eligibleParticipantCount: a.integer().required(),
    serverTime: a.float().required(), question: a.ref("PublicQuestion"), reveal: a.ref("Reveal"),
    participants: a.ref("Player").array().required(), leaderboard: a.ref("RankedPlayer").array().required(),
  }),
  QuestionReference: a.customType({ questionId: a.id().required(), index: a.integer().required(), text: a.string().required() }),
  AnswerReceipt: a.customType({ acceptedAt: a.float().required() }),
  QuestionStart: a.customType({ timerId: a.id().required(), opensAt: a.float().required(), closesAt: a.float().required(), version: a.integer().required() }),
  Version: a.customType({ version: a.integer().required() }),
  MyResult: a.customType({
    ...gamificationFields(), streakBonusPoints: a.integer(),
    questionId: a.id().required(), answered: a.boolean().required(), correct: a.boolean().required(),
    points: a.integer().required(), totalPoints: a.integer().required(), elapsedMs: a.float(),
  }),
  MyAnswer: a.customType({ questionId: a.id(), choiceId: a.id() }),
  GameEvent: a.customType({
    sessionId: a.id().required(), version: a.integer().required(), participantCount: a.integer(), answerCount: a.integer(),
  }),
  AsyncPublicInfo: a.customType({
    ...roundOptions(),
    title: a.string().required(), description: a.string().required(), questionCount: a.integer().required(),
    expiresAt: a.float().required(), timeZone: a.string().required(), status: a.string().required(),
    retentionAt: a.float().required(), endedAt: a.float(), maxParticipants: a.integer().required(),
    joinCode: a.string(), serverTime: a.float().required(),
    scoringVersion: a.string().required(), basePoints: a.integer().required(), maxBonusPoints: a.integer().required(),
    bonusWindowMs: a.integer().required(),
  }),
  AsyncPublishReceipt: a.customType({
    publicationId: a.id().required(), token: a.string().required(), joinCode: a.string().required(),
    expiresAt: a.float().required(), timeZone: a.string().required(), retentionDays: a.integer().required(),
    maxParticipants: a.integer().required(),
  }),
  AsyncJoinCode: a.customType({ publicationId: a.id().required(), joinCode: a.string().required() }),
  JoinCodeResolution: a.customType({ mode: a.string().required(), joinCode: a.string().required() }),
  AsyncEndReceipt: a.customType({ status: a.string().required(), endedAt: a.float().required() }),
  AsyncQuestion: a.customType({
    questionIndex: a.integer().required(), text: a.string().required(), answers: a.ref("PublicAnswer").array().required(),
    startedAt: a.float(),
  }),
  AsyncGuestAnswer: a.customType({
    ...streakScoreFields(),
    questionIndex: a.integer().required(), choiceId: a.id().required(), acceptedAt: a.float().required(),
    correct: a.boolean(), correctChoiceId: a.id(), explanation: a.string(),
    questionText: a.string(), selectedText: a.string(), correctText: a.string(),
    points: a.integer(), basePoints: a.integer(), bonusPoints: a.integer(), elapsedMs: a.float(),
  }),
  AsyncOwnQuestionResult: a.customType({
    ...streakScoreFields(),
    questionIndex: a.integer().required(), questionText: a.string().required(), answered: a.boolean().required(),
    selectedText: a.string(), correctText: a.string(), correct: a.boolean(), explanation: a.string(),
    acceptedAt: a.float(),
    points: a.integer(), basePoints: a.integer(), bonusPoints: a.integer(), elapsedMs: a.float(),
  }),
  AsyncGuestState: a.customType({
    ...roundOptions(), ...gamificationFields(), rank: a.integer(),
    title: a.string().required(), description: a.string().required(), questionCount: a.integer().required(),
    expiresAt: a.float().required(), timeZone: a.string().required(), status: a.string().required(),
    retentionAt: a.float().required(), endedAt: a.float(), maxParticipants: a.integer().required(),
    joinCode: a.string(), serverTime: a.float().required(),
    displayName: a.string().required(), avatarId: a.string().required(),
    startedAt: a.float().required(), answeredCount: a.integer().required(), attemptStatus: a.string().required(),
    nextQuestionIndex: a.integer().required(), answers: a.ref("AsyncGuestAnswer").array().required(),
    question: a.ref("AsyncQuestion"), points: a.integer(),
    results: a.ref("AsyncOwnQuestionResult").array().required(),
    scoringVersion: a.string().required(), basePoints: a.integer().required(), maxBonusPoints: a.integer().required(),
    bonusWindowMs: a.integer().required(),
  }),
  AsyncAnswerReceipt: a.customType({
    state: a.ref("AsyncGuestState"),
    acceptedAt: a.float().required(), answeredCount: a.integer().required(), questionIndex: a.integer().required(),
    attemptStatus: a.string().required(), status: a.string().required(), nextQuestionIndex: a.integer().required(),
    question: a.ref("AsyncQuestion"), serverTime: a.float().required(),
  }),
  AsyncPublicationSummary: a.customType({
    publicationId: a.id().required(), quizId: a.id().required(), title: a.string().required(), token: a.string().required(),
    joinCode: a.string(), createdAt: a.float().required(), expiresAt: a.float().required(), timeZone: a.string().required(),
    status: a.string().required(), retentionAt: a.float().required(), endedAt: a.float(),
    participantCount: a.integer().required(), maxParticipants: a.integer().required(),
    completedCount: a.integer().required(), partialCount: a.integer().required(),
  }),
  AsyncPlayerAnswer: a.customType({
    ...streakScoreFields(),
    questionIndex: a.integer().required(), choiceId: a.id().required(), acceptedAt: a.float().required(),
    correct: a.boolean().required(),
    points: a.integer().required(), basePoints: a.integer().required(), bonusPoints: a.integer().required(), elapsedMs: a.float(),
  }),
  AsyncParticipantResult: a.customType({
    ...gamificationFields(),
    attemptId: a.id().required(), displayName: a.string().required(), avatarId: a.string().required(), startedAt: a.float().required(),
    completedAt: a.float(), answeredCount: a.integer().required(), questionCount: a.integer().required(),
    status: a.string().required(), points: a.integer().required(), rank: a.integer().required(),
    answers: a.ref("AsyncPlayerAnswer").array().required(),
  }),
  AsyncStandingParticipant: a.customType({
    ...gamificationFields(),
    attemptId: a.id().required(), displayName: a.string().required(), avatarId: a.string().required(), startedAt: a.float().required(),
    completedAt: a.float(), answeredCount: a.integer().required(), questionCount: a.integer().required(),
    status: a.string().required(), points: a.integer().required(), rank: a.integer().required(),
  }),
  AsyncOptionResult: a.customType({
    id: a.id().required(), text: a.string().required(), correct: a.boolean().required(), count: a.integer().required(),
  }),
  AsyncQuestionResult: a.customType({
    questionIndex: a.integer().required(), text: a.string().required(), correctChoiceId: a.id().required(),
    explanation: a.string().required(), options: a.ref("AsyncOptionResult").array().required(),
    answeredCount: a.integer().required(),
  }),
  AsyncPublicationResults: a.customType({
    ...roundOptions(),
    publicationId: a.id().required(), quizId: a.id().required(), title: a.string().required(),
    createdAt: a.float().required(), expiresAt: a.float().required(), timeZone: a.string().required(),
    status: a.string().required(), retentionAt: a.float().required(), endedAt: a.float(),
    participantCount: a.integer().required(), maxParticipants: a.integer().required(),
    completedCount: a.integer().required(), partialCount: a.integer().required(), isFinal: a.boolean().required(),
    updatedAt: a.float().required(), questions: a.ref("AsyncQuestionResult").array().required(),
    participants: a.ref("AsyncParticipantResult").array().required(), nextCursor: a.string(),
    leaders: a.ref("AsyncParticipantResult").array().required(), totalParticipants: a.integer().required(),
    scoringVersion: a.string().required(), basePoints: a.integer().required(), maxBonusPoints: a.integer().required(),
    bonusWindowMs: a.integer().required(),
  }),
  AsyncStandings: a.customType({
    ...roundOptions(),
    publicationId: a.id().required(), quizId: a.id().required(), title: a.string().required(),
    createdAt: a.float().required(), expiresAt: a.float().required(), timeZone: a.string().required(),
    status: a.string().required(), retentionAt: a.float().required(), endedAt: a.float(),
    participantCount: a.integer().required(), maxParticipants: a.integer().required(),
    completedCount: a.integer().required(), partialCount: a.integer().required(), isFinal: a.boolean().required(),
    updatedAt: a.float().required(), questions: a.ref("AsyncQuestionResult").array().required(),
    participants: a.ref("AsyncStandingParticipant").array().required(), totalParticipants: a.integer().required(),
    scoringVersion: a.string().required(), basePoints: a.integer().required(), maxBonusPoints: a.integer().required(),
    bonusWindowMs: a.integer().required(),
  }),

  createQuiz: a.mutation().arguments({ quiz: a.ref("Quiz").required() }).returns(a.ref("QuizRecord"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  updateQuiz: a.mutation().arguments({ quizId: a.id().required(), expectedVersion: a.integer().required(), quiz: a.ref("Quiz").required() })
    .returns(a.ref("QuizRecord")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  deleteQuiz: a.mutation().arguments({ quizId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.boolean()).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  duplicateQuiz: a.mutation().arguments({ quizId: a.id().required() }).returns(a.ref("QuizRecord"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  startQuizGeneration: a.mutation().arguments({ request: a.ref("QuizGenerationRequest").required() })
    .returns(a.ref("QuizGenerationJob")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getQuizGeneration: a.query().arguments({ jobId: a.id().required() }).returns(a.ref("QuizGenerationJob"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  listQuizzes: a.query().arguments({ cursor: a.string() }).returns(a.ref("QuizSummaryPage"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getQuiz: a.query().arguments({ quizId: a.id().required() }).returns(a.ref("QuizRecord"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  listSessions: a.query().returns(a.ref("SessionSummary").array())
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getSession: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("SessionSummary"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  createSession: a.mutation().arguments({ quizId: a.id().required(), streakBonusEnabled: a.boolean() }).returns(a.ref("SessionCreated"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  listSessionQuestions: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("QuestionReference").array())
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getAdminGameState: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("GameState"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  startQuestion: a.mutation().arguments({ sessionId: a.id().required(), questionId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.ref("QuestionStart")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  nextQuestion: a.mutation().arguments({ sessionId: a.id().required(), questionId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.ref("QuestionStart")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  closeQuestion: a.mutation().arguments({ sessionId: a.id().required(), questionId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.ref("Version")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  showLeaderboard: a.mutation().arguments({ sessionId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.ref("Version")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  finishSession: a.mutation().arguments({ sessionId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.ref("Version")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  cancelSession: a.mutation().arguments({ sessionId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.ref("Version")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),

  joinSession: a.mutation().arguments({ joinCode: a.string().required() }).returns(a.ref("Participation"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getMyParticipation: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("Participation"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  deleteMyParticipation: a.mutation().arguments({ sessionId: a.id().required() }).returns(a.boolean().required())
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  submitAnswer: a.mutation().arguments({ sessionId: a.id().required(), questionId: a.id().required(), choiceId: a.id().required() })
    .returns(a.ref("AnswerReceipt")).authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getGameState: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("GameState"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getMyResult: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("MyResult"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getMyAnswer: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("MyAnswer"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getLeaderboard: a.query().arguments({ sessionId: a.id().required() }).returns(a.ref("RankedPlayer").array())
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getPresentationState: a.query().arguments({ presentationToken: a.string().required() }).returns(a.ref("GameState"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  // Nur der Event-Publisher darf veröffentlichen: `allow.guest()` ist hier nötig, weil AppSync IAM-Signaturen
  // über diesen Modus autorisiert. Clients sind per expliziter IAM-Deny-Policy (backend.ts, DenyClientPublish)
  // ausgeschlossen, und der Handler prüft zusätzlich, dass die Signatur nicht aus dem Identity Pool stammt.
  publishGameEvent: a.mutation().arguments({
    sessionId: a.id().required(), version: a.integer().required(), participantCount: a.integer(), answerCount: a.integer(),
  }).returns(a.ref("GameEvent")).authorization((allow) => [allow.guest()]).handler(a.handler.function(gameApi)),
  onGameChange: a.subscription().for(a.ref("publishGameEvent"))
    .arguments({ sessionId: a.id().required(), presentationToken: a.string() })
    .handler(a.handler.function(subscriptionAuth))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool"), allow.group("Quizmasters")]),

  publishAsyncQuiz: a.mutation().arguments({
    ...roundOptions(),
    quizId: a.id().required(), requestId: a.id().required(), expiresAt: a.float().required(), timeZone: a.string().required(),
  }).returns(a.ref("AsyncPublishReceipt"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  listAsyncPublications: a.query().returns(a.ref("AsyncPublicationSummary").array())
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  ensureAsyncJoinCode: a.mutation().arguments({ publicationId: a.id().required() }).returns(a.ref("AsyncJoinCode"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  resolveJoinCode: a.query().arguments({ joinCode: a.string().required() }).returns(a.ref("JoinCodeResolution"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  endAsyncPublication: a.mutation().arguments({ publicationId: a.id().required() }).returns(a.ref("AsyncEndReceipt"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getAsyncPublicationResults: a.query().arguments({ publicationId: a.id().required(), cursor: a.string() })
    .returns(a.ref("AsyncPublicationResults"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getAsyncStandings: a.query().arguments({ publicationId: a.id().required() })
    .returns(a.ref("AsyncStandings"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getAsyncPublicInfo: a.query().arguments({ token: a.string().required() }).returns(a.ref("AsyncPublicInfo"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  startAsyncQuiz: a.mutation().arguments({ token: a.string().required() }).returns(a.ref("AsyncGuestState"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  getMyAsyncState: a.query().arguments({ token: a.string().required() }).returns(a.ref("AsyncGuestState"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
  submitAsyncAnswer: a.mutation().arguments({
    token: a.string().required(), questionIndex: a.integer().required(), choiceId: a.id().required(),
  }).returns(a.ref("AsyncAnswerReceipt"))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool")]).handler(a.handler.function(gameApi)),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: "iam" } });
