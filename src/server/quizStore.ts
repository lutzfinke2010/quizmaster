import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { isQuizCategory, type QuizCategory } from "../domain/categories";
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

export interface QuizSummary {
  quizId: string; version: number; updatedAt: number; title: string; description: string; questionCount: number;
  category?: QuizCategory;
}
export interface QuizSummaryPage { items: QuizSummary[]; nextCursor: string | null }

const summarySchema = z.object({
  quizId: quizIdSchema, ownerId: z.string(), version: z.number().int(), updatedAt: z.number().int(),
  summaryTitle: z.string().optional(), summaryDescription: z.string().optional(), questionCount: z.number().int().optional(),
  summaryCategory: z.string().optional(),
});
const QUIZ_PAGE_SIZE = 100;

/** Denormalisierte Metadaten, damit die Übersicht per Projektion ohne die (bis zu 350 KB großen) Fragen auskommt. */
function summaryAttributes(quiz: Quiz) {
  return { summaryTitle: quiz.title, summaryDescription: quiz.description, questionCount: quiz.questions.length,
    ...(quiz.category ? { summaryCategory: quiz.category } : {}) };
}

/** Older items have no (or an unknown) category; the summary then omits it. */
function summaryCategory(value: unknown): { category?: QuizCategory } {
  return isQuizCategory(value) ? { category: value } : {};
}

function encodeCursor(key: Record<string, unknown> | undefined): string | null {
  return key ? Buffer.from(JSON.stringify({ sk: key.sk }), "utf8").toString("base64url") : null;
}

function decodeCursor(raw: unknown, pk: string): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  try {
    const { sk } = z.object({ sk: z.string().regex(/^QUIZ#[0-9a-f-]{36}$/) }).strict()
      .parse(JSON.parse(Buffer.from(z.string().max(200).parse(raw), "base64url").toString("utf8")));
    return { pk, sk };
  } catch {
    throw new Error("Ungültiger Seitencursor.");
  }
}

function ownerKey(principal: unknown) {
  const ownerId = requireQuizmaster(principal);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)) throw new Error("Ungültige Admin-Identität.");
  return { ownerId, pk: `OWNER#${ownerId}` };
}

function validateQuiz(rawQuiz: unknown): Quiz {
  // GraphQL may deliver an omitted optional input field as null.
  const input = rawQuiz && typeof rawQuiz === "object" && (rawQuiz as { category?: unknown }).category === null
    ? { ...rawQuiz, category: undefined } : rawQuiz;
  const quiz = quizSchema.parse(input);
  // DynamoDB rejects undefined attribute values; a quiz without category simply has no such key.
  if (quiz.category === undefined) delete quiz.category;
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
      TableName: this.tableName, Item: { pk: owner.pk, sk: `QUIZ#${record.quizId}`, ...record, ...summaryAttributes(quiz) },
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

  /**
   * Liefert eine Seite Quiz-Metadaten (ohne Fragen). Ältere Items ohne Summary-Attribute werden einzeln
   * vollständig gelesen; sie erhalten die Attribute beim nächsten Speichern.
   */
  async listQuizzes(principal: unknown, rawCursor?: unknown): Promise<QuizSummaryPage> {
    const owner = ownerKey(principal);
    const page = await this.client.send(new QueryCommand({
      TableName: this.tableName, ConsistentRead: true, Limit: QUIZ_PAGE_SIZE,
      KeyConditionExpression: "pk = :owner AND begins_with(sk, :prefix)",
      ProjectionExpression: "quizId, ownerId, #version, updatedAt, summaryTitle, summaryDescription, questionCount, summaryCategory",
      ExpressionAttributeNames: { "#version": "version" },
      ExpressionAttributeValues: { ":owner": owner.pk, ":prefix": "QUIZ#" },
      ExclusiveStartKey: decodeCursor(rawCursor, owner.pk),
    }));
    const items: QuizSummary[] = [];
    for (const raw of page.Items ?? []) {
      const item = summarySchema.parse(raw);
      if (item.ownerId !== owner.ownerId) throw new Error("Quiz gehört nicht zu diesem Konto.");
      if (item.summaryTitle !== undefined && item.summaryDescription !== undefined && item.questionCount !== undefined) {
        items.push({ quizId: item.quizId, version: item.version, updatedAt: item.updatedAt,
          title: item.summaryTitle, description: item.summaryDescription, questionCount: item.questionCount,
          ...summaryCategory(item.summaryCategory) });
        continue;
      }
      const legacy = await this.getQuiz(principal, item.quizId);
      items.push({ quizId: legacy.quizId, version: legacy.version, updatedAt: legacy.updatedAt,
        title: legacy.quiz.title, description: legacy.quiz.description, questionCount: legacy.quiz.questions.length,
        ...summaryCategory(legacy.quiz.category) });
    }
    return { items, nextCursor: encodeCursor(page.LastEvaluatedKey) };
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
      UpdateExpression: "SET quiz = :quiz, updatedAt = :updatedAt, #version = :next, summaryTitle = :title, summaryDescription = :description, questionCount = :questionCount" +
        (quiz.category ? ", summaryCategory = :category" : " REMOVE summaryCategory"),
      ConditionExpression: "ownerId = :owner AND #version = :expected",
      ExpressionAttributeNames: { "#version": "version" },
      ExpressionAttributeValues: { ":quiz": quiz, ":updatedAt": updatedAt, ":owner": owner.ownerId,
        ":expected": version, ":next": version + 1,
        ":title": quiz.title, ":description": quiz.description, ":questionCount": quiz.questions.length,
        ...(quiz.category ? { ":category": quiz.category } : {}) },
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
