import { randomUUID } from "node:crypto";
import {
  CreateTableCommand, DeleteTableCommand, DynamoDBClient, waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DynamoAnswerStore, submitAnswer } from "./submitAnswer";
import { finalizeQuestion } from "./finalizeQuestion";
import { startQuestion } from "./startQuestion";
import { closeQuestion, openQuestion } from "./controlQuestion";
import { controlSession } from "./controlSession";
import { QuizStore } from "./quizStore";
import { exampleQuiz } from "../domain/exampleQuiz";
import { createSession } from "./createSession";
import { createHash } from "node:crypto";
import { getMyParticipation, joinSession } from "./participation";
import { getGameState, getMyAnswer, getMyResult, getPresentationState } from "./gameState";

describe.skipIf(process.env.QUIZRUSH_AWS_TEST !== "1")("DynamoDB-Antwortannahme (AWS)", () => {
  const tableName = `quizrush-answer-test-${randomUUID()}`;
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-central-1" });
  const document = DynamoDBDocumentClient.from(client);
  const store = new DynamoAnswerStore(document, tableName);
  const pk = "SESSION#test";
  let created = false;

  beforeAll(async () => {
    await client.send(new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
    }));
    created = true;
    await waitUntilTableExists({ client, maxWaitTime: 90 }, { TableName: tableName });
    for (const item of [
      { pk, sk: "META", status: "QUESTION_OPEN", currentQuestionId: "q1", opensAt: 1000, closesAt: 2000, expiresAt: 5000, answerCount: 0, version: 1 },
      { pk, sk: "IDENTITY#guest-one", participantId: "p1" },
      { pk, sk: "IDENTITY#guest-two", participantId: "p2" },
      { pk, sk: "QUESTION#q1", answerIds: ["a1", "a2"] },
    ]) await document.send(new PutCommand({ TableName: tableName, Item: item }));
  }, 120_000);

  afterAll(async () => {
    try {
      if (created) await client.send(new DeleteTableCommand({ TableName: tableName }));
    } finally {
      client.destroy();
    }
  }, 30_000);

  it("prüft Teilnahme, Antwortoption, Frist, Wiederholung und atomaren Zähler gegen DynamoDB", async () => {
    const request = { sessionId: "test", questionId: "q1", choiceId: "a1" };
    await expect(submitAnswer(store, request, "not-a-member", 1500)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await expect(submitAnswer(store, { ...request, choiceId: "unknown" }, "guest-one", 1500))
      .rejects.toMatchObject({ code: "REJECTED" });
    await expect(submitAnswer(store, request, "guest-one", 2000)).rejects.toMatchObject({ code: "NOT_OPEN" });
    expect(await submitAnswer(store, request, "guest-one", 1500)).toEqual({ acceptedAt: 1500 });
    expect(await submitAnswer(store, request, "guest-one", 1700)).toEqual({ acceptedAt: 1500 });
    expect(await submitAnswer(store, { ...request, choiceId: "a2" }, "guest-one", 1700)).toEqual({ acceptedAt: 1700 });
    expect(await submitAnswer(store, { ...request, choiceId: "a2" }, "guest-one", 1800)).toEqual({ acceptedAt: 1700 });
    await expect(submitAnswer(store, request, "guest-one", 2000)).rejects.toMatchObject({ code: "NOT_OPEN" });
    const meta = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true }));
    expect(meta.Item).toMatchObject({ answerCount: 1, version: 3 });
    const stored = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "ANSWER#q1#p1" }, ConsistentRead: true }));
    expect(stored.Item).toMatchObject({ choiceId: "a2", receivedAt: 1700, ttl: 5 });
    await document.send(new UpdateCommand({
      TableName: tableName, Key: { pk, sk: "META" },
      UpdateExpression: "SET #status = :closed", ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":closed": "QUESTION_CLOSED" },
    }));
    await expect(submitAnswer(store, request, "guest-two", 1500)).rejects.toMatchObject({ code: "NOT_OPEN" });
    await expect(submitAnswer(store, request, "guest-one", 1900)).rejects.toMatchObject({ code: "NOT_OPEN" });
  }, 60_000);

  it("ordnet konkurrierende Erstabgaben nach Serverzeit und zählt auch nach einem Wechsel nur eine Stimme", async () => {
    const sessionId = "changing";
    const changingPk = `SESSION#${sessionId}`;
    await Promise.all([
      { pk: changingPk, sk: "META", status: "QUESTION_OPEN", currentQuestionId: "q1",
        opensAt: 1000, closesAt: 2000, expiresAt: 5000, answerCount: 0, version: 1 },
      { pk: changingPk, sk: "QUESTION#q1", answerIds: ["a1", "a2"] },
      { pk: changingPk, sk: "IDENTITY#guest", participantId: "p1" },
    ].map((item) => document.send(new PutCommand({ TableName: tableName, Item: item }))));
    const request = { sessionId, questionId: "q1", choiceId: "a1" };
    const results = await Promise.allSettled([
      submitAnswer(store, request, "guest", 1200),
      submitAnswer(store, { ...request, choiceId: "a2" }, "guest", 1600),
    ]);
    expect(results[1]).toEqual({ status: "fulfilled", value: { acceptedAt: 1600 } });
    expect((await document.send(new GetCommand({
      TableName: tableName, Key: { pk: changingPk, sk: "ANSWER#q1#p1" }, ConsistentRead: true,
    }))).Item).toMatchObject({ choiceId: "a2", receivedAt: 1600 });
    expect(await submitAnswer(store, request, "guest", 1999)).toEqual({ acceptedAt: 1999 });
    expect((await document.send(new GetCommand({
      TableName: tableName, Key: { pk: changingPk, sk: "META" }, ConsistentRead: true,
    }))).Item?.answerCount).toBe(1);
  }, 60_000);

  it("zählt parallele Antworten und Wiederholungen nur einmal pro Person", async () => {
    const parallelPk = "SESSION#parallel";
    await Promise.all([
      { pk: parallelPk, sk: "META", status: "QUESTION_OPEN", currentQuestionId: "q1", opensAt: 1000, closesAt: 2000, expiresAt: 5000, answerCount: 0, version: 1 },
      { pk: parallelPk, sk: "QUESTION#q1", answerIds: ["a1", "a2"] },
      ...Array.from({ length: 10 }, (_, index) => ({
        pk: parallelPk, sk: `IDENTITY#parallel-${index}`, participantId: `p${index}`,
      })),
    ].map((item) => document.send(new PutCommand({ TableName: tableName, Item: item }))));
    const request = { sessionId: "parallel", questionId: "q1", choiceId: "a1" };
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) =>
      submitAnswer(store, request, `parallel-${index}`, 1999)));
    expect(results).toHaveLength(10);
    const repeated = await Promise.all(Array.from({ length: 10 }, () =>
      submitAnswer(store, request, "parallel-0", 1999)));
    expect(repeated).toEqual(Array.from({ length: 10 }, () => ({ acceptedAt: 1999 })));
    const meta = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: parallelPk, sk: "META" }, ConsistentRead: true,
    }));
    expect(meta.Item?.answerCount).toBe(10);
  }, 60_000);

  it("schließt nach Frist und wertet auch bei Wiederholung nur einmal aus", async () => {
    const sessionId = "scoring";
    const scoringPk = `SESSION#${sessionId}`;
    await Promise.all([
      { pk: scoringPk, sk: "META", status: "QUESTION_OPEN", currentQuestionId: "q1",
        timerId: "timer1", opensAt: 1000, closesAt: 2000, expiresAt: 5000, answerCount: 0, version: 1 },
      { pk: scoringPk, sk: "QUESTION#q1", answerIds: ["a1", "a2"], correctChoiceId: "a1", explanation: "Erklärung" },
      ...[1, 2, 3].flatMap((number) => [
        { pk: scoringPk, sk: `IDENTITY#scoring-${number}`, participantId: `p${number}` },
        { pk: scoringPk, sk: `PARTICIPANT#p${number}`, totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0 },
      ]),
    ].map((item) => document.send(new PutCommand({ TableName: tableName, Item: item }))));
    const request = { sessionId, questionId: "q1", timerId: "timer1" };
    await submitAnswer(store, { sessionId, questionId: "q1", choiceId: "a2" }, "scoring-1", 1200);
    await submitAnswer(store, { sessionId, questionId: "q1", choiceId: "a1" }, "scoring-1", 1500);
    await submitAnswer(store, { sessionId, questionId: "q1", choiceId: "a1" }, "scoring-2", 1300);
    await submitAnswer(store, { sessionId, questionId: "q1", choiceId: "a2" }, "scoring-2", 1750);
    await expect(finalizeQuestion(document, tableName, request, 1999)).rejects.toThrow(/noch nicht abgelaufen/);
    await expect(finalizeQuestion(document, tableName, { ...request, timerId: "old" }, 2000)).rejects.toThrow(/Veralteter/);
    const early = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: scoringPk, sk: "REVEAL#q1" }, ConsistentRead: true,
    }));
    expect(early.Item).toBeUndefined();
    await Promise.all([
      finalizeQuestion(document, tableName, request, 2000),
      finalizeQuestion(document, tableName, request, 2000),
    ]);
    await finalizeQuestion(document, tableName, request, 2500);
    const read = async (sk: string) => (await document.send(new GetCommand({
      TableName: tableName, Key: { pk: scoringPk, sk }, ConsistentRead: true,
    }))).Item;
    expect(await read("META")).toMatchObject({ status: "REVEAL", answerCount: 2 });
    expect(await read("PARTICIPANT#p1")).toMatchObject({ totalPoints: 750, correctAnswers: 1, correctElapsedMs: 500 });
    expect(await read("PARTICIPANT#p2")).toMatchObject({ totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0 });
    expect(await read("PARTICIPANT#p3")).toMatchObject({ totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0 });
    expect(await read("RESULT#q1#p1")).toMatchObject({ ttl: 5 });
    expect(await read("REVEAL#q1")).toMatchObject({
      correctChoiceId: "a1", ttl: 5, distribution: [{ choiceId: "a1", count: 1 }, { choiceId: "a2", count: 1 }],
    });
    await expect(submitAnswer(store, { sessionId, questionId: "q1", choiceId: "a1" }, "scoring-3", 1500))
      .rejects.toMatchObject({ code: "NOT_OPEN" });
  }, 60_000);

  it("startet eine Frage versionsgeschützt zusammen mit einem dauerhaften Timerauftrag", async () => {
    const sessionId = "starting";
    const startingPk = `SESSION#${sessionId}`;
    await Promise.all([
      { pk: startingPk, sk: "META", status: "LOBBY", ownerId: "owner", version: 3,
        questionIndex: -1, questionCount: 2, participantCount: 5, expiresAt: 100_000 },
      { pk: startingPk, sk: "QUESTION#q1", index: 0, durationSeconds: 5 },
      { pk: startingPk, sk: "QUESTION#q2", index: 1, durationSeconds: 10 },
    ].map((item) => document.send(new PutCommand({ TableName: tableName, Item: item }))));
    const request = { sessionId, questionId: "q1", expectedVersion: 3 };
    const owner = { subject: "owner", groups: ["Quizmasters"] };
    await expect(startQuestion(document, tableName, request, { subject: "owner", groups: [] }, 1001))
      .rejects.toThrow(/Berechtigung/);
    await expect(startQuestion(document, tableName, request, { subject: "other", groups: ["Quizmasters"] }, 1001))
      .rejects.toThrow(/Berechtigung/);
    await expect(startQuestion(document, tableName, { ...request, questionId: "q2" }, owner, 1001))
      .rejects.toThrow(/nächste/);
    const results = await Promise.allSettled([
      startQuestion(document, tableName, request, owner, 1001),
      startQuestion(document, tableName, request, owner, 1001),
    ]);
    const successes = results.filter((result) => result.status === "fulfilled");
    expect(successes).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const started = successes[0].value;
    expect(started).toMatchObject({ opensAt: 4001, closesAt: 9001, version: 4 });
    const meta = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: startingPk, sk: "META" }, ConsistentRead: true,
    }));
    expect(meta.Item).toMatchObject({ status: "COUNTDOWN", version: 4, questionIndex: 0,
      eligibleParticipantCount: 5, timerId: started.timerId, answerCount: 0 });
    const timer = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: startingPk, sk: `TIMER#q1#${started.timerId}` }, ConsistentRead: true,
    }));
    expect(timer.Item).toMatchObject({ status: "PENDING", sessionId, questionId: "q1", ttl: 100,
      deadlineAt: new Date(10_000).toISOString() });
    await expect(startQuestion(document, tableName, request, owner, 2000)).rejects.toThrow();
  }, 60_000);

  it("öffnet und schließt eine Frage serverseitig und wertet frühes Schließen aus", async () => {
    const sessionId = "controlled";
    const sessionPk = `SESSION#${sessionId}`;
    await Promise.all([
      { pk: sessionPk, sk: "META", status: "LOBBY", ownerId: "owner", version: 0,
        questionIndex: -1, questionCount: 1, participantCount: 1, expiresAt: 100_000 },
      { pk: sessionPk, sk: "QUESTION#q1", index: 0, durationSeconds: 5, answerIds: ["a1", "a2"],
        correctChoiceId: "a1", explanation: "" },
      { pk: sessionPk, sk: "IDENTITY#guest", participantId: "p1" },
      { pk: sessionPk, sk: "PARTICIPANT#p1", totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0 },
    ].map((item) => document.send(new PutCommand({ TableName: tableName, Item: item }))));
    const owner = { subject: "owner", groups: ["Quizmasters"] };
    const started = await startQuestion(document, tableName, { sessionId, questionId: "q1", expectedVersion: 0 }, owner, 1000);
    const timerRequest = { sessionId, questionId: "q1", timerId: started.timerId };
    await expect(openQuestion(document, tableName, timerRequest, 3999)).rejects.toThrow();
    await openQuestion(document, tableName, timerRequest, 4000);
    await openQuestion(document, tableName, timerRequest, 4001);
    await submitAnswer(store, { sessionId, questionId: "q1", choiceId: "a1" }, "guest", 4500);
    const meta = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: sessionPk, sk: "META" }, ConsistentRead: true,
    }));
    const version = zVersion(meta.Item?.version);
    await expect(closeQuestion(document, tableName, { sessionId, questionId: "q1", expectedVersion: version },
      { subject: "other", groups: ["Quizmasters"] }, 4600)).rejects.toThrow();
    const closed = await closeQuestion(document, tableName, { sessionId, questionId: "q1", expectedVersion: version }, owner, 4600);
    expect(closed.timerId).toBe(started.timerId);
    await finalizeQuestion(document, tableName, timerRequest, 4600);
    const participant = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: sessionPk, sk: "PARTICIPANT#p1" }, ConsistentRead: true,
    }));
    expect(participant.Item).toMatchObject({ totalPoints: 950, correctAnswers: 1, correctElapsedMs: 500 });
  }, 60_000);

  it("verwaltet Quizze nur für den berechtigten Eigentümer und schützt Versionen", async () => {
    const quizzes = new QuizStore(document, tableName);
    const owner = { subject: "quiz-owner", groups: ["Quizmasters"] };
    const other = { subject: "other-owner", groups: ["Quizmasters"] };
    const createdQuiz = await quizzes.createQuiz(owner, exampleQuiz, 1000);
    expect(createdQuiz.version).toBe(1);
    await expect(quizzes.createQuiz({ subject: "quiz-owner", groups: [] }, exampleQuiz, 1000))
      .rejects.toThrow(/Berechtigung/);
    await expect(quizzes.getQuiz(other, createdQuiz.quizId)).rejects.toThrow(/nicht gefunden/);
    const updated = await quizzes.updateQuiz(owner, createdQuiz.quizId, 1, { ...exampleQuiz, title: "Neu" }, 2000);
    expect(updated).toMatchObject({ version: 2, quiz: { title: "Neu" } });
    await expect(quizzes.updateQuiz(owner, createdQuiz.quizId, 1, exampleQuiz, 2001)).rejects.toThrow();
    const duplicate = await quizzes.duplicateQuiz(owner, createdQuiz.quizId, 3000);
    expect(duplicate.quizId).not.toBe(createdQuiz.quizId);
    expect((await quizzes.listQuizzes(owner)).map((item) => item.quizId)).toHaveLength(2);
    await expect(quizzes.deleteQuiz(other, createdQuiz.quizId, 2)).rejects.toThrow();
    await quizzes.deleteQuiz(owner, createdQuiz.quizId, 2);
    expect((await quizzes.listQuizzes(owner)).map((item) => item.quizId)).toEqual([duplicate.quizId]);
  }, 60_000);

  it("reserviert einen Code und erstellt einen unabhängigen Fragen-Snapshot", async () => {
    const quizzes = new QuizStore(document, tableName);
    const owner = { subject: "session-owner", groups: ["Quizmasters"] };
    const quiz = await quizzes.createQuiz(owner, exampleQuiz, 1000);
    await expect(createSession(document, tableName, { quizId: quiz.quizId },
      { subject: "other-owner", groups: ["Quizmasters"] }, {}, 1000)).rejects.toThrow();
    const session = await createSession(document, tableName, { quizId: quiz.quizId }, owner, {}, 1000);
    expect(session.joinCode).toMatch(/^\d{6}$/);
    expect(session.presentationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const pk = `SESSION#${session.sessionId}`;
    const meta = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true }));
    expect(meta.Item).toMatchObject({ status: "LOBBY", participantCount: 0, questionCount: 10, maxParticipants: 100,
      presentationTokenHash: createHash("sha256").update(session.presentationToken).digest("hex") });
    expect(meta.Item).not.toHaveProperty("presentationToken");
    const code = await document.send(new GetCommand({
      TableName: tableName, Key: { pk: `CODE#${session.joinCode}`, sk: "META" }, ConsistentRead: true,
    }));
    expect(code.Item?.sessionId).toBe(session.sessionId);
    await quizzes.updateQuiz(owner, quiz.quizId, 1, { ...exampleQuiz, questions: [exampleQuiz.questions[1]] }, 2000);
    const snapshots = await document.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": "QUESTION#" },
    }));
    expect(snapshots.Items).toHaveLength(10);
    expect(snapshots.Items?.find((item) => item.index === 0)).toMatchObject({ text: exampleQuiz.questions[0].text });
  }, 60_000);

  it("begrenzt parallele Beitritte atomar und stellt die eigene Teilnahme wieder her", async () => {
    const quizzes = new QuizStore(document, tableName);
    const owner = { subject: "join-owner", groups: ["Quizmasters"] };
    const quiz = await quizzes.createQuiz(owner, exampleQuiz, 1000);
    const session = await createSession(document, tableName, { quizId: quiz.quizId }, owner, { maxParticipants: 2 }, 1000);
    const same = await Promise.all([
      joinSession(document, tableName, session.joinCode, "guest-one", 1200),
      joinSession(document, tableName, session.joinCode, "guest-one", 1200),
    ]);
    expect(same[0]).toEqual(same[1]);
    const attempts = await Promise.allSettled([
      joinSession(document, tableName, session.joinCode, "guest-two", 1200),
      joinSession(document, tableName, session.joinCode, "guest-three", 1200),
      joinSession(document, tableName, session.joinCode, "guest-four", 1200),
    ]);
    const accepted = attempts.filter((result) => result.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    expect(accepted[0].value.displayName).not.toBe(same[0].displayName);
    const pk = `SESSION#${session.sessionId}`;
    const meta = await document.send(new GetCommand({ TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true }));
    expect(meta.Item?.participantCount).toBe(2);
    expect(await getMyParticipation(document, tableName, session.sessionId, "guest-one", 1300)).toEqual(same[0]);
    await expect(getMyParticipation(document, tableName, session.sessionId, "impostor", 1300)).rejects.toThrow();
    const questions = await document.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true, KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": "QUESTION#" },
    }));
    const first = questions.Items?.find((item) => item.index === 0);
    if (typeof first?.questionId !== "string" || typeof meta.Item?.version !== "number") throw new Error("Missing fixture");
    await startQuestion(document, tableName,
      { sessionId: session.sessionId, questionId: first.questionId, expectedVersion: meta.Item.version }, owner, 1400);
    expect(await joinSession(document, tableName, session.joinCode, "guest-one", 1500)).toEqual(same[0]);
    await expect(joinSession(document, tableName, session.joinCode, "new-guest", 1500)).rejects.toThrow(/begonnen/);
    await expect(getMyParticipation(document, tableName, session.sessionId, "guest-one", 604_801_000)).rejects.toThrow();
  }, 60_000);

  it("gibt Spielzustand nur an Berechtigte und Lösungen erst nach Auswertung frei", async () => {
    const quizzes = new QuizStore(document, tableName);
    const owner = { subject: "state-owner", groups: ["Quizmasters"] };
    const quiz = await quizzes.createQuiz(owner, exampleQuiz, 1000);
    const session = await createSession(document, tableName, { quizId: quiz.quizId }, owner, {}, 1000);
    const player = await joinSession(document, tableName, session.joinCode, "state-guest", 1200);
    const pk = `SESSION#${session.sessionId}`;
    const lobby = await getGameState(document, tableName, session.sessionId, "state-guest", 1300);
    expect(lobby.participants).toMatchObject([{ participantId: player.participantId }]);
    await expect(getGameState(document, tableName, session.sessionId, "impostor", 1300)).rejects.toThrow();
    await expect(getPresentationState(document, tableName, "a".repeat(43), 1300)).rejects.toThrow();
    const questions = await document.send(new QueryCommand({
      TableName: tableName, ConsistentRead: true, KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": "QUESTION#" },
    }));
    const first = questions.Items?.find((item) => item.index === 0);
    if (typeof first?.questionId !== "string") throw new Error("Missing fixture");
    const started = await startQuestion(document, tableName,
      { sessionId: session.sessionId, questionId: first.questionId, expectedVersion: lobby.version }, owner, 1500);
    const timerRequest = { sessionId: session.sessionId, questionId: first.questionId, timerId: started.timerId };
    await openQuestion(document, tableName, timerRequest, 4500);
    const open = await getGameState(document, tableName, session.sessionId, "state-guest", 4600);
    expect(open.question?.text).toBe(exampleQuiz.questions[0].text);
    expect(open.reveal).toBeNull();
    expect(JSON.stringify(open)).not.toContain("correctChoiceId");
    await expect(getMyResult(document, tableName, session.sessionId, "state-guest", 4600)).rejects.toThrow(/noch nicht/);
    expect(await getMyAnswer(document, tableName, session.sessionId, "state-guest", 4600))
      .toEqual({ questionId: first.questionId, choiceId: null });
    await expect(getMyAnswer(document, tableName, session.sessionId, "impostor", 4600)).rejects.toThrow();
    expect((await getPresentationState(document, tableName, session.presentationToken, 4600)).reveal).toBeNull();
    await submitAnswer(store, { sessionId: session.sessionId, questionId: first.questionId, choiceId: "a0" }, "state-guest", 4700);
    expect(await getMyAnswer(document, tableName, session.sessionId, "state-guest", 4701))
      .toEqual({ questionId: first.questionId, choiceId: "a0" });
    await finalizeQuestion(document, tableName, timerRequest, 24_500);
    const revealed = await getGameState(document, tableName, session.sessionId, "state-guest", 24_600);
    expect(revealed.reveal?.correctChoiceId).toBe("a0");
    expect(revealed.leaderboard).toEqual([]);
    expect(await getMyResult(document, tableName, session.sessionId, "state-guest", 24_600))
      .toMatchObject({ questionId: first.questionId, answered: true, correct: true });
    const presentationReveal = await getPresentationState(document, tableName, session.presentationToken, 24_600);
    expect(presentationReveal.reveal?.correctChoiceId).toBe("a0");
    expect(presentationReveal.leaderboard).toMatchObject([{ participantId: player.participantId, rank: 1 }]);
    await controlSession(document, tableName, { sessionId: session.sessionId, expectedVersion: revealed.version },
      owner, 24_700, "showLeaderboard");
    const leaderboard = await getGameState(document, tableName, session.sessionId, "state-guest", 24_800);
    expect(leaderboard.leaderboard).toMatchObject([{ participantId: player.participantId, rank: 1, previousRank: 1, rankChange: 0 }]);
  }, 60_000);
});

function zVersion(value: unknown): number {
  if (typeof value !== "number") throw new Error("Missing version");
  return value;
}
