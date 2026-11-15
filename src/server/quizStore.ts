import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { quizSchema, type Quiz } from "../domain/quiz";
import { requireQuizmaster } from "./adminPrincipal";

const quizIdSchema = z.string().uuid();
const storedQuizSchema = z.object({
  quizId: quizIdSchema,
  ownerId: z.string().min(1).max(128),
  version: z.number().int().min(1),
  updatedAt: z.number().int().min(0),
  quiz: quizSchema,
});
export type StoredQuiz = z.infer<typeof storedQuizSchema>;

function ownerKey(principal: unknown) {
  const ownerId = requireQuizmaster(principal);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)) throw new Error("Ungültige Admin-Identität.");
  return { ownerId, pk: `OWNER#${ownerId}` };
}

function validateQuiz(rawQuiz: unknown): Quiz {
  const quiz = quizSchema.parse(rawQuiz);
  if (Buffer.byteLength(JSON.stringify(quiz), "utf8") > 350 * 1024) {
    throw new Error("Das Quiz ist für die Speicherung zu groß.");
  }
  return quiz;
}

function time(now: number): number {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Ungültige Serverzeit.");
  return now;
}

/**
 * Principal must be constructed from a verified Cognito context in the caller.
 */
export class QuizStore {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async createQuiz(principal: unknown, rawQuiz: unknown, now: number): Promise<StoredQuiz> {
    const owner = ownerKey(principal);
    const quiz = validateQuiz(rawQuiz);
    const record = { quizId: randomUUID(), ownerId: owner.ownerId, version: 1, updatedAt: time(now), quiz };
    await this.client.send(new PutCommand({
      TableName: this.tableName, Item: { pk: owner.pk, sk: `QUIZ#${record.quizId}`, ...record },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }));
    return record;
  }

  async getQuiz(principal: unknown, rawQuizId: unknown): Promise<StoredQuiz> {
    const owner = ownerKey(principal);
    const quizId = quizIdSchema.parse(rawQuizId);
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName, Key: { pk: owner.pk, sk: `QUIZ#${quizId}` }, ConsistentRead: true,
    }));
    if (!result.Item) throw new Error("Quiz nicht gefunden.");
    const quiz = storedQuizSchema.parse(result.Item);
    if (quiz.ownerId !== owner.ownerId) throw new Error("Quiz gehört nicht zu diesem Konto.");
    return quiz;
  }

  async listQuizzes(principal: unknown): Promise<StoredQuiz[]> {
    const owner = ownerKey(principal);
    const quizzes: StoredQuiz[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(new QueryCommand({
        TableName: this.tableName, ConsistentRead: true,
        KeyConditionExpression: "pk = :owner AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":owner": owner.pk, ":prefix": "QUIZ#" },
        ExclusiveStartKey: cursor,
      }));
      quizzes.push(...(page.Items ?? []).map((item) => {
        const quiz = storedQuizSchema.parse(item);
        if (quiz.ownerId !== owner.ownerId) throw new Error("Quiz gehört nicht zu diesem Konto.");
        return quiz;
      }));
      cursor = page.LastEvaluatedKey;
    } while (cursor);
    return quizzes;
  }

  async updateQuiz(
    principal: unknown, rawQuizId: unknown, expectedVersion: number, rawQuiz: unknown, now: number,
  ): Promise<StoredQuiz> {
    const owner = ownerKey(principal);
    const quizId = quizIdSchema.parse(rawQuizId);
    const version = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER - 1).parse(expectedVersion);
    const quiz = validateQuiz(rawQuiz);
    const updatedAt = time(now);
    await this.client.send(new UpdateCommand({
      TableName: this.tableName, Key: { pk: owner.pk, sk: `QUIZ#${quizId}` },
      UpdateExpression: "SET quiz = :quiz, updatedAt = :updatedAt, #version = :next",
      ConditionExpression: "ownerId = :owner AND #version = :expected",
      ExpressionAttributeNames: { "#version": "version" },
      ExpressionAttributeValues: { ":quiz": quiz, ":updatedAt": updatedAt, ":owner": owner.ownerId,
        ":expected": version, ":next": version + 1 },
    }));
    return { quizId, ownerId: owner.ownerId, version: version + 1, updatedAt, quiz };
  }

  async deleteQuiz(principal: unknown, rawQuizId: unknown, expectedVersion: number): Promise<void> {
    const owner = ownerKey(principal);
    const quizId = quizIdSchema.parse(rawQuizId);
    const version = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).parse(expectedVersion);
    await this.client.send(new DeleteCommand({
      TableName: this.tableName, Key: { pk: owner.pk, sk: `QUIZ#${quizId}` },
      ConditionExpression: "ownerId = :owner AND #version = :expected",
      ExpressionAttributeNames: { "#version": "version" },
      ExpressionAttributeValues: { ":owner": owner.ownerId, ":expected": version },
    }));
  }

  async duplicateQuiz(principal: unknown, rawQuizId: unknown, now: number): Promise<StoredQuiz> {
    const original = await this.getQuiz(principal, rawQuizId);
    return this.createQuiz(principal, original.quiz, now);
  }
}
