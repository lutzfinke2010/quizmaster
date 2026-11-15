import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient, waitUntilTableExists } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QuizStore } from "./quizStore";
import { createSession } from "./createSession";
import { joinSession } from "./participation";
import { startQuestion } from "./startQuestion";
import { openQuestion } from "./controlQuestion";
import { DynamoAnswerStore, submitAnswer } from "./submitAnswer";
import { finalizeQuestion } from "./finalizeQuestion";

describe.skipIf(process.env.QUIZRUSH_LOAD_TEST !== "1")("100 Teilnehmende (AWS DynamoDB)", () => {
  const tableName = `quizrush-load-${randomUUID()}`;
  const db = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-central-1" });
  const document = DynamoDBDocumentClient.from(db);
  let created = false;
  beforeAll(async () => {
    await db.send(new CreateTableCommand({
      TableName: tableName, BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }, { AttributeName: "sk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }, { AttributeName: "sk", KeyType: "RANGE" }],
    }));
    created = true;
    await waitUntilTableExists({ client: db, maxWaitTime: 90 }, { TableName: tableName });
  }, 120_000);
  afterAll(async () => {
    try { if (created) await db.send(new DeleteTableCommand({ TableName: tableName })); } finally { db.destroy(); }
  }, 30_000);
  it("verarbeitet 100 gleichzeitige Beitritte und Antworten ohne Doppelzählung", async () => {
    const owner = { subject: "load-owner", groups: ["Quizmasters"] };
    const quiz = await new QuizStore(document, tableName).createQuiz(owner, {
      title: "Lasttest", description: "", questions: [{
        text: "Test?", durationSeconds: 30, explanation: "", answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }],
      }],
    }, 1000);
    const session = await createSession(document, tableName, { quizId: quiz.quizId }, owner, {}, 1000);
    const startedJoining = Date.now();
    const participants = await Promise.all(Array.from({ length: 100 }, (_, index) =>
      joinSession(document, tableName, session.joinCode, `load-${index}`, 1200)));
    const joinMs = Date.now() - startedJoining;
    expect(new Set(participants.map((player) => player.displayName)).size).toBe(100);
    const pk = `SESSION#${session.sessionId}`;
    const meta = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true }));
    const questions = await document.send(new QueryCommand({ TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": "QUESTION#" } }));
    const questionId = questions.Items?.[0]?.questionId;
    if (typeof questionId !== "string" || typeof meta.Item?.version !== "number") throw new Error("Missing fixture");
    const started = await startQuestion(document, tableName, { sessionId: session.sessionId, questionId,
      expectedVersion: meta.Item.version }, owner, 1500);
    const timer = { sessionId: session.sessionId, questionId, timerId: started.timerId };
    await openQuestion(document, tableName, timer, 4500);
    const store = new DynamoAnswerStore(document, tableName);
    const startedAnswering = Date.now();
    await Promise.all(Array.from({ length: 100 }, (_, index) =>
      submitAnswer(store, { sessionId: session.sessionId, questionId, choiceId: index % 2 ? "a1" : "a0" }, `load-${index}`, 4501 + index)));
    const answerMs = Date.now() - startedAnswering;
    await finalizeQuestion(document, tableName, timer, 34_500);
    const final = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true }));
    expect(final.Item).toMatchObject({ status: "REVEAL", participantCount: 100, answerCount: 100 });
    const reveal = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: `REVEAL#${questionId}` }, ConsistentRead: true }));
    expect(reveal.Item?.distribution).toEqual([{ choiceId: "a0", count: 50 }, { choiceId: "a1", count: 50 }]);
    console.info(`100 Beitritte: ${joinMs} ms; 100 Antworten: ${answerMs} ms`);
  }, 180_000);
});
