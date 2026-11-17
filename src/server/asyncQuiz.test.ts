import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand,
  type GetCommandInput, type QueryCommandInput, type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getAsyncPublicInfo, getMyAsyncState, publishAsyncQuiz, startAsyncQuiz, submitAsyncAnswer,
} from "./asyncQuiz";

const database = mockClient(DynamoDBDocumentClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const records = new Map<string, Record<string, unknown>>();
const publicationId = "2ba41d80-30b1-4ad0-9e3f-375cf07cf6f5";
const token = "A".repeat(43);
const identityId = "eu-central-1:guest-identity";
const pk = `ASYNC#${publicationId}`;
const keyOf = (partition: unknown, sort: unknown) => `${String(partition)}#${String(sort)}`;

function conditionalFailure() {
  return Object.assign(new Error("conditional failure"), {
    name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
  });
}

function setupDatabase() {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  records.set(keyOf(`ASYNC_TOKEN#${tokenHash}`, "META"), { publicationId });
  records.set(keyOf(pk, "META"), {
    pk, sk: "META", publicationId, ownerId: "admin", quizId: "4ee86a5f-31ed-4e31-b6c1-5b2699256747",
    title: "Testquiz", snapshot: { title: "Testquiz", description: "", questions: [{
      text: "Welche Option ist richtig?", answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }],
      durationSeconds: 20, explanation: "Weil es so ist.",
    }] }, status: "ACTIVE", tokenHash, createdAt: Date.now(), expiresAt: Date.now() + 60_000,
    timeZone: "Europe/Berlin", retentionAt: Date.now() + 31 * 86_400_000, retentionDays: 30,
    maxParticipants: 100, startedCount: 0,
  });
  database.on(GetCommand).callsFake((input: GetCommandInput) => {
    if (!input.Key) throw new Error("Missing key.");
    const item = records.get(keyOf(input.Key.pk, input.Key.sk));
    return { Item: item ? { ...item } : undefined };
  });
  database.on(QueryCommand).callsFake((input: QueryCommandInput) => {
    const partition = input.ExpressionAttributeValues?.[":pk"];
    const prefix = input.ExpressionAttributeValues?.[":prefix"];
    return { Items: [...records.values()].filter((item) => item.pk === partition &&
      typeof item.sk === "string" && item.sk.startsWith(String(prefix))) };
  });
  database.on(TransactWriteCommand).callsFake((input: TransactWriteCommandInput) => {
    const items = input.TransactItems ?? [];
    const puts = items.flatMap((entry) => entry.Put?.Item ? [entry.Put.Item] : []);
    const update = items.find((entry) => entry.Update)?.Update;
    if (!update?.Key) {
      if (puts.some((item) => records.has(keyOf(item.pk, item.sk)))) throw conditionalFailure();
      for (const item of puts) records.set(keyOf(item.pk, item.sk), item);
      return {};
    }
    const key = keyOf(update.Key.pk, update.Key.sk);
    const current = records.get(key);
    if (!current) throw conditionalFailure();
    if (update.Key.sk === "META") {
      if (current.status !== "ACTIVE" || Number(current.expiresAt) <= Number(update.ExpressionAttributeValues?.[":now"]) ||
          Number(current.startedCount) >= Number(current.maxParticipants) ||
          puts.some((item) => records.has(keyOf(item.pk, item.sk)))) throw conditionalFailure();
      records.set(key, { ...current, startedCount: Number(current.startedCount) + 1 });
    } else {
      const question = items.find((entry) => entry.ConditionCheck)?.ConditionCheck;
      const publication = question?.Key ? records.get(keyOf(question.Key.pk, question.Key.sk)) : undefined;
      if (!publication || publication.status !== "ACTIVE" ||
          Number(publication.expiresAt) <= Number(question?.ExpressionAttributeValues?.[":now"]) ||
          Number(current.answeredCount) !== Number(update.ExpressionAttributeValues?.[":index"]) ||
          puts.some((item) => records.has(keyOf(item.pk, item.sk)))) throw conditionalFailure();
      records.set(key, {
        ...current,
        answeredCount: Number(current.answeredCount) + 1,
        status: update.ExpressionAttributeValues?.[":completed"] ?? "IN_PROGRESS",
        ...(update.ExpressionAttributeValues?.[":now"] ? { completedAt: update.ExpressionAttributeValues[":now"] } : {}),
      });
    }
    for (const item of puts) records.set(keyOf(item.pk, item.sk), item);
    return {};
  });
}

describe("Quiz per Link", () => {
  beforeEach(() => {
    database.reset();
    records.clear();
    setupDatabase();
  });

  it("öffnet eine Bot-Vorschau ohne Versuch oder Teilnehmerstatistik zu erzeugen", async () => {
    const info = await getAsyncPublicInfo(db, "table", token, Date.now());
    expect(info.title).toBe("Testquiz");
    expect(info.questionCount).toBe(1);
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(0);
    expect([...records.values()].some((item) => String(item.sk).startsWith("ATTEMPT#"))).toBe(false);
  });

  it("veröffentlicht einen Snapshot und gibt bei idempotentem Retry denselben Link zurück", async () => {
    const quizId = "4ee86a5f-31ed-4e31-b6c1-5b2699256747";
    records.set(keyOf("OWNER#admin", `QUIZ#${quizId}`), {
      quizId, ownerId: "admin", version: 1, updatedAt: Date.now(),
      quiz: { title: "Snapshot", description: "Test", questions: [{
        text: "Frage", answers: [{ text: "Richtig", correct: true }, { text: "Falsch", correct: false }],
        durationSeconds: 20, explanation: "",
      }] },
    });
    const request = { quizId, requestId: "b22f156b-61a2-42d7-ae36-98aac6c22fb8",
      expiresAt: Date.now() + 60_000, timeZone: "Europe/Berlin" };
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    const created = await publishAsyncQuiz(db, "table", request, principal, 30, 100, Date.now());
    const retry = await publishAsyncQuiz(db, "table", request, principal, 30, 100, Date.now());
    expect(retry).toEqual(created);
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const publication = records.get(keyOf(`ASYNC#${created.publicationId}`, "META"));
    expect(publication?.snapshot).toEqual(records.get(keyOf("OWNER#admin", `QUIZ#${quizId}`))?.quiz);
    records.set(keyOf("OWNER#admin", `QUIZ#${quizId}`), {
      ...records.get(keyOf("OWNER#admin", `QUIZ#${quizId}`)), quiz: { title: "Geändert", questions: [] },
    });
    expect((records.get(keyOf(`ASYNC#${created.publicationId}`, "META"))?.snapshot as { title: string }).title).toBe("Snapshot");
    expect([...records.values()].filter((item) => item.pk === "OWNER#admin" &&
      String(item.sk).startsWith("ASYNC#"))).toHaveLength(1);
    await expect(publishAsyncQuiz(db, "table", { ...request, expiresAt: request.expiresAt + 1 },
      principal, 30, 100, Date.now())).rejects.toThrow("bereits für eine andere Veröffentlichung verwendet");
  });

  it("startet idempotent mit eigenem Fortschritt und gibt vor Quizende keine Lösung aus", async () => {
    const first = await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const again = await startAsyncQuiz(db, "table", token, identityId, Date.now());
    expect(again.displayName).toBe(first.displayName);
    expect(again.avatarId).toBe(first.avatarId);
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(1);
    expect(first.question?.answers).toEqual([{ id: "a0", text: "Ja" }, { id: "a1", text: "Nein" }]);
    expect(JSON.stringify(first)).not.toContain("Weil es so ist.");
    expect(JSON.stringify(first)).not.toContain('"correct":true');
    expect(first.points).toBeNull();
  });

  it("begrenzt Starts auf die konfigurierte Teilnehmerzahl", async () => {
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), maxParticipants: 1 });
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    await expect(startAsyncQuiz(db, "table", token, "eu-central-1:another-guest", Date.now()))
      .rejects.toThrow("maximale Teilnehmerzahl");
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(1);
  });

  it("speichert die erste Antwort und erkennt denselben Retry ohne Überschreiben", async () => {
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const first = await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
    const retry = await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
    expect(retry.acceptedAt).toBe(first.acceptedAt);
    await expect(submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a1" }, identityId, Date.now()))
      .rejects.toThrow("bereits eine andere Antwort");
    expect(records.get(keyOf(pk, `ANSWER#${createHash("sha256").update(identityId).digest("hex")}#000`))?.choiceId).toBe("a0");
    const state = await getMyAsyncState(db, "table", token, identityId, Date.now());
    expect(state?.answers[0].correct).toBeNull();
    expect(state?.answers[0].correctChoiceId).toBeNull();
    expect(state?.answers[0].explanation).toBeNull();
    expect(state?.points).toBeNull();
    const metaKey = keyOf(pk, "META");
    records.set(metaKey, { ...records.get(metaKey), status: "ENDED", endedAt: Date.now() });
    const finalState = await getMyAsyncState(db, "table", token, identityId, Date.now());
    expect(finalState?.points).toBe(1);
    expect(finalState?.results[0]).toMatchObject({
      answered: true, questionText: "Welche Option ist richtig?", selectedText: "Ja", correctText: "Ja", correct: true,
    });
  });
});
