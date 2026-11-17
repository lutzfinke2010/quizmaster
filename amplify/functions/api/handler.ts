import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { QuizStore } from "../../../src/server/quizStore";
import { createSession } from "../../../src/server/createSession";
import { joinSession, getMyParticipation, deleteMyParticipation } from "../../../src/server/participation";
import { DynamoAnswerStore, submitAnswer } from "../../../src/server/submitAnswer";
import { getAdminGameState, getGameState, getMyAnswer, getMyResult, getPresentationState } from "../../../src/server/gameState";
import { startQuestion } from "../../../src/server/startQuestion";
import { closeQuestion } from "../../../src/server/controlQuestion";
import { controlSession } from "../../../src/server/controlSession";
import { finalizeQuestion } from "../../../src/server/finalizeQuestion";
import { enforceRateLimit } from "../../../src/server/rateLimit";
import { listSessions } from "../../../src/server/listSessions";
import { guestIdentity, quizmasterIdentity } from "../../../src/server/appsyncIdentity";
import {
  endAsyncPublication, getAsyncPublicInfo, getAsyncPublicationResults, getMyAsyncState,
  listAsyncPublications, publishAsyncQuiz, startAsyncQuiz, submitAsyncAnswer,
} from "../../../src/server/asyncQuiz";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const quizmaster = quizmasterIdentity;
const guest = (identity: unknown) => guestIdentity(identity, environment("IDENTITY_POOL_ID"));

const eventSchema = z.object({
  fieldName: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
  identity: z.unknown(),
});

export async function handler(raw: unknown): Promise<unknown> {
  const now = Date.now();
  const event = eventSchema.parse(raw);
  if (Buffer.byteLength(JSON.stringify(event.arguments), "utf8") > 350 * 1024) throw new Error("Anfrage ist zu groß.");
  const tableName = environment("TABLE_NAME");
  const args = event.arguments;
  const quizStore = new QuizStore(client, tableName);
  switch (event.fieldName) {
    case "createQuiz": return quizStore.createQuiz(quizmaster(event.identity), args.quiz, now);
    case "updateQuiz": return quizStore.updateQuiz(quizmaster(event.identity), args.quizId,
      z.number().int().parse(args.expectedVersion), args.quiz, now);
    case "deleteQuiz":
      await quizStore.deleteQuiz(quizmaster(event.identity), args.quizId, z.number().int().parse(args.expectedVersion));
      return true;
    case "duplicateQuiz": return quizStore.duplicateQuiz(quizmaster(event.identity), args.quizId, now);
    case "listQuizzes": return quizStore.listQuizzes(quizmaster(event.identity));
    case "getQuiz": return quizStore.getQuiz(quizmaster(event.identity), args.quizId);
    case "listSessions": return listSessions(client, tableName, quizmaster(event.identity), now);
    case "createSession": return createSession(client, tableName, { quizId: args.quizId }, quizmaster(event.identity), {
      maxParticipants: z.coerce.number().int().min(1).max(1000).parse(process.env.MAX_PARTICIPANTS ?? "100"),
      retentionDays: z.coerce.number().int().min(1).max(365).parse(process.env.RETENTION_DAYS ?? "7"),
    }, now);
    case "listSessionQuestions": {
      const state = await getAdminGameState(client, tableName, args.sessionId, quizmaster(event.identity), now);
      const questions: Array<{ questionId: string; index: number; text: string }> = [];
      let cursor: Record<string, unknown> | undefined;
      do {
        const page = await client.send(new QueryCommand({
          TableName: tableName, ConsistentRead: true,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":pk": `SESSION#${state.sessionId}`, ":prefix": "QUESTION#" },
          ExclusiveStartKey: cursor,
        }));
        questions.push(...(page.Items ?? []).map((item) =>
          z.object({ questionId: z.string(), index: z.number().int(), text: z.string() }).parse(item)));
        cursor = page.LastEvaluatedKey;
      } while (cursor);
      return questions.sort((a, b) => a.index - b.index);
    }
    case "getAdminGameState": return getAdminGameState(client, tableName, args.sessionId, quizmaster(event.identity), now);
    case "startQuestion":
    case "nextQuestion": return startQuestion(client, tableName, args, quizmaster(event.identity), now);
    case "closeQuestion": {
      const principal = quizmaster(event.identity);
      const sessionId = z.string().parse(args.sessionId);
      const questionId = z.string().parse(args.questionId);
      const closed = await closeQuestion(client, tableName, args, principal, now);
      await finalizeQuestion(client, tableName, { sessionId, questionId, timerId: closed.timerId }, Date.now());
      const current = await getAdminGameState(client, tableName, sessionId, principal, Date.now());
      return { version: current.version };
    }
    case "showLeaderboard":
    case "finishSession":
    case "cancelSession": return controlSession(client, tableName, args, quizmaster(event.identity), now, event.fieldName);
    case "joinSession": {
      const identityId = guest(event.identity);
      await enforceRateLimit(client, tableName, identityId, "join", now);
      return joinSession(client, tableName, args.joinCode, identityId, now);
    }
    case "getMyParticipation": return getMyParticipation(client, tableName, args.sessionId, guest(event.identity), now);
    case "deleteMyParticipation": {
      const identityId = guest(event.identity);
      await enforceRateLimit(client, tableName, identityId, "join", now);
      return deleteMyParticipation(client, tableName, args.sessionId, identityId, now);
    }
    case "submitAnswer": {
      const identityId = guest(event.identity);
      await enforceRateLimit(client, tableName, identityId, "answer", now);
      return submitAnswer(new DynamoAnswerStore(client, tableName), args, identityId, now);
    }
    case "getGameState": return getGameState(client, tableName, args.sessionId, guest(event.identity), now);
    case "getMyResult": return getMyResult(client, tableName, args.sessionId, guest(event.identity), now);
    case "getMyAnswer": return getMyAnswer(client, tableName, args.sessionId, guest(event.identity), now);
    case "getLeaderboard": {
      const state = await getGameState(client, tableName, args.sessionId, guest(event.identity), now);
      if (!["LEADERBOARD", "FINISHED"].includes(state.status)) throw new Error("Die Rangliste ist noch nicht freigegeben.");
      return state.leaderboard;
    }
    case "getPresentationState":
      guest(event.identity);
      return getPresentationState(client, tableName, args.presentationToken, now);
    case "publishAsyncQuiz":
      return publishAsyncQuiz(client, tableName, args, quizmaster(event.identity),
        z.coerce.number().int().min(1).max(365).parse(process.env.ASYNC_RETENTION_DAYS ?? "30"),
        z.coerce.number().int().min(1).max(1000).parse(process.env.MAX_PARTICIPANTS ?? "100"), Date.now());
    case "listAsyncPublications":
      return listAsyncPublications(client, tableName, quizmaster(event.identity), Date.now());
    case "endAsyncPublication":
      return endAsyncPublication(client, tableName, args, quizmaster(event.identity), Date.now());
    case "getAsyncPublicationResults":
      return getAsyncPublicationResults(client, tableName, args, quizmaster(event.identity), Date.now());
    case "getAsyncPublicInfo":
      guest(event.identity);
      return getAsyncPublicInfo(client, tableName, args.token, Date.now());
    case "startAsyncQuiz": {
      const identityId = guest(event.identity);
      const currentTime = Date.now();
      await enforceRateLimit(client, tableName, identityId, "join", currentTime);
      return startAsyncQuiz(client, tableName, args.token, identityId, Date.now());
    }
    case "getMyAsyncState":
      return getMyAsyncState(client, tableName, args.token, guest(event.identity), Date.now());
    case "submitAsyncAnswer": {
      const identityId = guest(event.identity);
      await enforceRateLimit(client, tableName, identityId, "answer", Date.now());
      return submitAsyncAnswer(client, tableName, args, identityId, Date.now());
    }
    case "publishGameEvent": {
      if (!event.identity || typeof event.identity !== "object" || !("userArn" in event.identity) ||
          ("cognitoIdentityId" in event.identity && event.identity.cognitoIdentityId)) {
        throw new Error("Keine Berechtigung zur Veröffentlichung.");
      }
      return z.object({
        sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        version: z.number().int().min(0).max(2_147_483_647),
      }).strict().parse(args);
    }
    default: throw new Error("Unbekannte Operation.");
  }
}
