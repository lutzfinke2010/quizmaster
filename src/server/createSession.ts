import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  GetCommand, PutCommand, TransactWriteCommand, UpdateCommand, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { requireQuizmaster } from "./adminPrincipal";
import { QuizStore } from "./quizStore";
import { withTransactionConflictRetry } from "./transactionRetry";
import { JOIN_CODE_FREE_CONDITION, joinCodeKey, reserveJoinCode } from "./joinCode";
import { GAMIFICATION_VERSION } from "../domain/gamification";

const requestSchema = z.object({ quizId: z.string().uuid(), streakBonusEnabled: z.boolean().optional() }).strict();
const settingsSchema = z.object({
  maxParticipants: z.number().int().min(1).max(1000).default(100),
  retentionDays: z.number().int().min(1).max(365).default(7),
}).strict();

/**
 * The principal and settings are supplied by trusted server configuration.
 * PREPARING sessions are never joinable; the code reservation and metadata
 * are created atomically, before their immutable question snapshot is written.
 */
export async function createSession(
  client: DynamoDBDocumentClient, tableName: string, rawRequest: unknown,
  principal: unknown, rawSettings: unknown, now: number,
  joinCodeCandidates?: () => string,
): Promise<{ sessionId: string; joinCode: string; presentationToken: string }> {
  const request = requestSchema.parse(rawRequest);
  const settings = settingsSchema.parse(rawSettings);
  const ownerId = requireQuizmaster(principal);
  if (!Number.isSafeInteger(now) || now < 0 ||
      now > Number.MAX_SAFE_INTEGER - settings.retentionDays * 86_400_000) {
    throw new Error("Ungültige Serverzeit.");
  }
  const { quiz } = await new QuizStore(client, tableName).getQuiz(principal, request.quizId);
  const sessionId = randomUUID();
  const presentationToken = randomBytes(32).toString("base64url");
  const presentationTokenHash = createHash("sha256").update(presentationToken).digest("hex");
  const expiresAt = now + settings.retentionDays * 86_400_000;
  const ttl = Math.ceil(expiresAt / 1000);
  const pk = `SESSION#${sessionId}`;
  const metaKey = { pk, sk: "META" };
  // Gemeinsame Codevergabe mit Quizrunden: Live-Codes überschreiben nie einen Quiz-Code einer veröffentlichten Runde.
  const joinCode = await reserveJoinCode(client, tableName, now, async (candidate) => {
    await withTransactionConflictRetry(() => client.send(new TransactWriteCommand({ TransactItems: [
      { Put: {
        TableName: tableName,
        Item: { ...joinCodeKey(candidate), sessionId, expiresAt, ttl },
        ConditionExpression: JOIN_CODE_FREE_CONDITION,
        ExpressionAttributeValues: { ":now": now },
      } },
      { Put: {
        TableName: tableName,
        Item: { ...metaKey, ownerId, quizId: request.quizId, title: quiz.title, description: quiz.description,
          status: "PREPARING", version: 0, questionIndex: -1, questionCount: quiz.questions.length,
          participantCount: 0, maxParticipants: settings.maxParticipants, joinCode: candidate, createdAt: now,
          gamificationVersion: GAMIFICATION_VERSION, streakBonusEnabled: request.streakBonusEnabled ?? false,
          presentationTokenHash, expiresAt, ttl },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      } },
      { Put: {
        TableName: tableName,
        Item: { pk: `OWNER#${ownerId}`, sk: `SESSIONTOKEN#${sessionId}`, presentationToken, expiresAt, ttl },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      } },
      { Put: {
        TableName: tableName,
        Item: { pk: `PRESENT#${presentationTokenHash}`, sk: "META", sessionId, expiresAt, ttl },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      } },
    ] })));
    return candidate;
  }, undefined, joinCodeCandidates);

  try {
    for (const [index, question] of quiz.questions.entries()) {
      const questionId = randomUUID();
      const answerIds = question.answers.map((_, answerIndex) => `a${answerIndex}`);
      const item = {
        pk, sk: `QUESTION#${questionId}`, questionId, index, text: question.text,
        durationSeconds: question.durationSeconds, answerIds,
        answers: question.answers.map((answer, answerIndex) => ({ id: answerIds[answerIndex], text: answer.text })),
        correctChoiceId: answerIds[question.answers.findIndex((answer) => answer.correct)],
        explanation: question.explanation, expiresAt, ttl,
      };
      await client.send(new PutCommand({
        TableName: tableName, Item: item,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      }));
    }
    await client.send(new UpdateCommand({
      TableName: tableName, Key: metaKey,
      UpdateExpression: "SET #status = :lobby ADD #version :one",
      ConditionExpression: "#status = :preparing AND ownerId = :owner",
      ExpressionAttributeNames: { "#status": "status", "#version": "version" },
      ExpressionAttributeValues: { ":lobby": "LOBBY", ":preparing": "PREPARING", ":owner": ownerId, ":one": 1 },
    }));
  } catch (error) {
    const state = await client.send(new GetCommand({ TableName: tableName, Key: metaKey, ConsistentRead: true }));
    if (state.Item?.status === "LOBBY" && state.Item.ownerId === ownerId) {
      return { sessionId, joinCode, presentationToken };
    }
    try {
      await client.send(new TransactWriteCommand({ TransactItems: [
        { Update: {
          TableName: tableName, Key: metaKey,
          UpdateExpression: "SET #status = :failed",
          ConditionExpression: "#status = :preparing AND ownerId = :owner",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":failed": "FAILED", ":preparing": "PREPARING", ":owner": ownerId },
        } },
        { Delete: {
          TableName: tableName, Key: { pk: `CODE#${joinCode}`, sk: "META" },
          ConditionExpression: "sessionId = :session",
          ExpressionAttributeValues: { ":session": sessionId },
        } },
      ] }));
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Sitzung konnte nicht erstellt und nicht vollständig freigegeben werden.");
    }
    throw error;
  }
  return { sessionId, joinCode, presentationToken };
}
