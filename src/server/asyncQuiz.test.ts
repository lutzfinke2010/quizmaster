import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand,
  type BatchWriteCommandInput, type GetCommandInput, type QueryCommandInput, type TransactWriteCommandInput,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import {
  endAsyncPublication, getAsyncPublicInfo, getAsyncPublicationResults, listAsyncPublications, getMyAsyncState, publishAsyncQuiz, startAsyncQuiz, submitAsyncAnswer,
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

// Subset of DynamoDB reserved words that must be aliased via ExpressionAttributeNames.
const reservedWords = new Set(["status", "ttl", "name", "count", "index", "timestamp", "data", "value", "values",
  "key", "keys", "size", "type", "date", "time", "year", "user", "users", "comment", "order", "source", "state",
  "hash", "range", "level", "number", "token", "position", "percent", "total", "session"]);
const expressionKeywords = new Set(["and", "or", "not", "set", "add", "remove", "delete", "between", "in"]);

type ExpressionInput = {
  KeyConditionExpression?: string; ConditionExpression?: string; UpdateExpression?: string;
  FilterExpression?: string; ProjectionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>; ExpressionAttributeValues?: Record<string, unknown>;
};

function assertValidExpressions(input: ExpressionInput) {
  const text = [input.KeyConditionExpression, input.ConditionExpression, input.UpdateExpression,
    input.FilterExpression, input.ProjectionExpression].filter(Boolean).join(" ");
  const usedValues = new Set(text.match(/:[A-Za-z0-9_]+/g) ?? []);
  const usedNames = new Set(text.match(/#[A-Za-z0-9_]+/g) ?? []);
  const definedValues = Object.keys(input.ExpressionAttributeValues ?? {});
  const definedNames = Object.keys(input.ExpressionAttributeNames ?? {});
  const unusedValues = definedValues.filter((key) => !usedValues.has(key));
  if (unusedValues.length) throw new Error(`Value provided in ExpressionAttributeValues unused in expressions: keys: {${unusedValues.join(", ")}}`);
  const unusedNames = definedNames.filter((key) => !usedNames.has(key));
  if (unusedNames.length) throw new Error(`Value provided in ExpressionAttributeNames unused in expressions: keys: {${unusedNames.join(", ")}}`);
  const missing = [...usedValues, ...usedNames].filter((key) => !definedValues.includes(key) && !definedNames.includes(key));
  if (missing.length) throw new Error(`An expression attribute placeholder is not defined: ${missing.join(", ")}`);
  const bare = text.replace(/[:#][A-Za-z0-9_]+/g, " ").replace(/\b[a-z_]+\s*\(/g, " ").match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  const reserved = bare.find((word) => !expressionKeywords.has(word.toLowerCase()) && reservedWords.has(word.toLowerCase()));
  if (reserved) throw new Error(`Attribute name is a reserved keyword; reserved keyword: ${reserved}`);
}

function assertValidTransaction(input: TransactWriteCommandInput) {
  for (const entry of input.TransactItems ?? []) {
    for (const operation of [entry.ConditionCheck, entry.Update, entry.Put, entry.Delete]) {
      if (operation) assertValidExpressions(operation);
    }
  }
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
    assertValidExpressions(input);
    const partition = input.ExpressionAttributeValues?.[":pk"];
    const prefix = input.ExpressionAttributeValues?.[":prefix"];
    return { Items: [...records.values()].filter((item) => item.pk === partition &&
      typeof item.sk === "string" && (prefix === undefined || item.sk.startsWith(String(prefix)))) };
  });
  database.on(UpdateCommand).callsFake((input: UpdateCommandInput) => {
    assertValidExpressions(input);
    if (!input.Key) throw new Error("Missing key.");
    const key = keyOf(input.Key.pk, input.Key.sk);
    const current = records.get(key);
    const values = input.ExpressionAttributeValues ?? {};
    if (input.UpdateExpression?.includes("retentionSyncedTtl")) {
      if (!current) throw Object.assign(new Error("conditional failure"), { name: "ConditionalCheckFailedException" });
      records.set(key, { ...current, retentionSyncedTtl: values[":ttl"] });
      return {};
    }
    if (!current || current.ownerId !== values[":owner"] || current.status !== values[":active"] ||
        Number(current.expiresAt) <= Number(values[":now"])) {
      throw Object.assign(new Error("conditional failure"), { name: "ConditionalCheckFailedException" });
    }
    records.set(key, { ...current, status: values[":ended"], endedAt: values[":now"],
      retentionAt: values[":retentionAt"], ttl: values[":ttl"] });
    return {};
  });
  database.on(BatchWriteCommand).callsFake((input: BatchWriteCommandInput) => {
    for (const request of Object.values(input.RequestItems ?? {}).flat()) {
      const item = request.PutRequest?.Item;
      if (item) records.set(keyOf(item.pk, item.sk), item);
    }
    return { UnprocessedItems: {} };
  });
  database.on(TransactWriteCommand).callsFake((input: TransactWriteCommandInput) => {
    assertValidTransaction(input);
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

  it("speichert Antworten auf nicht-letzte Fragen und schließt erst mit der letzten ab", async () => {
    const metaKey = keyOf(pk, "META");
    const meta = records.get(metaKey) as { snapshot: { questions: unknown[] } };
    records.set(metaKey, { ...meta, snapshot: { ...meta.snapshot, questions: [...meta.snapshot.questions, {
      text: "Zweite Frage?", answers: [{ text: "A", correct: false }, { text: "B", correct: true }],
      durationSeconds: 20, explanation: "",
    }] } });
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const attemptKey = keyOf(pk, `ATTEMPT#${createHash("sha256").update(identityId).digest("hex")}`);
    const first = await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
    expect(first.answeredCount).toBe(1);
    expect(records.get(attemptKey)).toMatchObject({ status: "IN_PROGRESS", answeredCount: 1 });
    expect(records.get(attemptKey)?.completedAt).toBeUndefined();
    const state = await getMyAsyncState(db, "table", token, identityId, Date.now());
    expect(state?.question?.questionIndex).toBe(1);
    await submitAsyncAnswer(db, "table", { token, questionIndex: 1, choiceId: "a1" }, identityId, Date.now());
    expect(records.get(attemptKey)).toMatchObject({ status: "COMPLETED", answeredCount: 2 });
    expect(records.get(attemptKey)?.completedAt).toEqual(expect.any(Number));
  });

  it("beendet eine aktive Runde vorzeitig und verkürzt die Aufbewahrung abhängiger Datensätze", async () => {
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const result = await endAsyncPublication(db, "table", { publicationId },
      { subject: "admin", groups: ["Quizmasters"] }, Date.now());
    expect(result.status).toBe("ENDED");
    const meta = records.get(keyOf(pk, "META"));
    expect(meta?.status).toBe("ENDED");
    const ttl = Math.ceil(Number(meta?.retentionAt) / 1000);
    expect(meta?.ttl).toBe(ttl);
    const attempt = [...records.values()].find((item) => String(item.sk).startsWith("ATTEMPT#"));
    expect(attempt?.ttl).toBe(ttl);
    await expect(startAsyncQuiz(db, "table", token, "eu-central-1:late-guest", Date.now())).rejects.toThrow("beendet");
  });

  it("meldet eine nach Rundenende abgelehnte Antwort als Fristablauf", async () => {
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const metaKey = keyOf(pk, "META");
    records.set(metaKey, { ...records.get(metaKey), status: "ENDED", endedAt: Date.now() });
    await expect(submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now()))
      .rejects.toThrow(/Quizfrist ist abgelaufen|beendet/);
  });

  it("liefert Ergebnisse, wenn AppSync den fehlenden Cursor als null übergibt", async () => {
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    const results = await getAsyncPublicationResults(db, "table", { publicationId, cursor: null }, principal, Date.now());
    expect(results.participants).toHaveLength(1);
  });

  it("listet Runden robust, auch wenn eine Veröffentlichung bereits gelöscht wurde", async () => {
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    const createdAt = Number(records.get(keyOf(pk, "META"))?.createdAt);
    records.set(keyOf("OWNER#admin", `ASYNC#${String(createdAt).padStart(15, "0")}#${publicationId}`), {
      pk: "OWNER#admin", sk: `ASYNC#${String(createdAt).padStart(15, "0")}#${publicationId}`, publicationId, token,
      retentionAt: Date.now() + 31 * 86_400_000,
    });
    const goneId = "0b7c2a5e-8d7f-4c1a-9a0e-3f1e2d3c4b5a";
    records.set(keyOf("OWNER#admin", `ASYNC#000000000000001#${goneId}`), {
      pk: "OWNER#admin", sk: `ASYNC#000000000000001#${goneId}`, publicationId: goneId, token,
      retentionAt: Date.now() + 31 * 86_400_000,
    });
    await endAsyncPublication(db, "table", { publicationId }, principal, Date.now());
    const listed = await listAsyncPublications(db, "table", principal, Date.now());
    expect(listed.map((item) => item.publicationId)).toEqual([publicationId]);
    const meta = records.get(keyOf(pk, "META"));
    const ownerRow = records.get(keyOf("OWNER#admin", `ASYNC#${String(createdAt).padStart(15, "0")}#${publicationId}`));
    expect(ownerRow?.retentionAt).toBe(meta?.retentionAt);
    expect(meta?.retentionSyncedTtl).toBe(Math.ceil(Number(meta?.retentionAt) / 1000));
  });
});
