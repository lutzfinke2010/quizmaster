import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { gameApi } from "../functions/api/resource";
import { subscriptionAuth } from "../functions/events/resource";

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
    participantId: a.id().required(), displayName: a.string().required(), avatarId: a.string().required(),
    points: a.integer().required(), correctAnswers: a.integer().required(), correctElapsedMs: a.float().required(), rank: a.integer().required(),
    previousRank: a.integer().required(), rankChange: a.integer().required(),
  }),
  GameState: a.customType({
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
    questionId: a.id().required(), answered: a.boolean().required(), correct: a.boolean().required(),
    points: a.integer().required(), totalPoints: a.integer().required(), elapsedMs: a.float(),
  }),
  MyAnswer: a.customType({ questionId: a.id(), choiceId: a.id() }),
  GameEvent: a.customType({ sessionId: a.id().required(), version: a.integer().required() }),

  createQuiz: a.mutation().arguments({ quiz: a.ref("Quiz").required() }).returns(a.ref("QuizRecord"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  updateQuiz: a.mutation().arguments({ quizId: a.id().required(), expectedVersion: a.integer().required(), quiz: a.ref("Quiz").required() })
    .returns(a.ref("QuizRecord")).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  deleteQuiz: a.mutation().arguments({ quizId: a.id().required(), expectedVersion: a.integer().required() })
    .returns(a.boolean()).authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  duplicateQuiz: a.mutation().arguments({ quizId: a.id().required() }).returns(a.ref("QuizRecord"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  listQuizzes: a.query().returns(a.ref("QuizRecord").array())
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  getQuiz: a.query().arguments({ quizId: a.id().required() }).returns(a.ref("QuizRecord"))
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  listSessions: a.query().returns(a.ref("SessionSummary").array())
    .authorization((allow) => [allow.group("Quizmasters")]).handler(a.handler.function(gameApi)),
  createSession: a.mutation().arguments({ quizId: a.id().required() }).returns(a.ref("SessionCreated"))
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
  publishGameEvent: a.mutation().arguments({ sessionId: a.id().required(), version: a.integer().required() })
    .returns(a.ref("GameEvent")).authorization((allow) => [allow.guest()]).handler(a.handler.function(gameApi)),
  onGameChange: a.subscription().for(a.ref("publishGameEvent"))
    .arguments({ sessionId: a.id().required(), presentationToken: a.string() })
    .handler(a.handler.function(subscriptionAuth))
    .authorization((allow) => [allow.guest(), allow.authenticated("identityPool"), allow.group("Quizmasters")]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: "iam" } });
