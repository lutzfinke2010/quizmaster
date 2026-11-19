import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand, BatchWriteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand,
  type BatchGetCommandInput, type BatchWriteCommandInput, type GetCommandInput, type QueryCommandInput, type TransactWriteCommandInput,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as participation from "./participation";
import {
  endAsyncPublication, getAsyncPublicInfo, getAsyncPublicationResults, getAsyncStandings, listAsyncPublications,
  getMyAsyncState, publishAsyncQuiz, startAsyncQuiz, submitAsyncAnswer,
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
    if (input.UpdateExpression === "SET maxParticipants = :limit") {
      expect(input.ConditionExpression).toBe("#status = :active AND expiresAt > :now AND maxParticipants < :limit");
      expect(input.ReturnValues).toBe("ALL_NEW");
      if (!current || current.status !== values[":active"] || Number(current.expiresAt) <= Number(values[":now"]) ||
          Number(current.maxParticipants) >= Number(values[":limit"])) {
        throw Object.assign(new Error("conditional failure"), { name: "ConditionalCheckFailedException" });
      }
      const updated = { ...current, maxParticipants: values[":limit"] };
      records.set(key, updated);
      return { Attributes: { ...updated } };
    }
    if (input.UpdateExpression?.includes("currentQuestionStartedAt")) {
      if (!current || current.status !== values[":progress"] || current.answeredCount !== values[":index"] ||
          current.currentQuestionIndex === values[":index"]) {
        throw Object.assign(new Error("conditional failure"), { name: "ConditionalCheckFailedException" });
      }
      records.set(key, { ...current, currentQuestionIndex: values[":index"], currentQuestionStartedAt: values[":startedAt"] });
      return {};
    }
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
  database.on(BatchGetCommand).callsFake((input: BatchGetCommandInput) => ({
    Responses: Object.fromEntries(Object.entries(input.RequestItems ?? {}).map(([table, request]) => [table,
      (request.Keys ?? []).flatMap((key) => {
        const item = records.get(keyOf(key.pk, key.sk));
        return item ? [{ ...item }] : [];
      })])),
    UnprocessedKeys: {},
  }));
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
    const updates = items.flatMap((entry) => entry.Update ? [entry.Update] : []);
    const update = updates.find((entry) => entry.Key?.sk !== "META") ?? updates[0];
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
      const question = items.find((entry) => entry.ConditionCheck)?.ConditionCheck ??
        updates.find((entry) => entry.Key?.sk === "META");
      const publication = question?.Key ? records.get(keyOf(question.Key.pk, question.Key.sk)) : undefined;
      if (!publication || publication.status !== "ACTIVE" ||
          Number(publication.expiresAt) <= Number(question?.ExpressionAttributeValues?.[":now"]) ||
          Number(current.answeredCount) !== Number(update.ExpressionAttributeValues?.[":index"]) ||
          (update.ExpressionAttributeValues?.[":questionStart"] !== undefined &&
            (current.currentQuestionIndex !== update.ExpressionAttributeValues[":index"] ||
              current.currentQuestionStartedAt !== update.ExpressionAttributeValues[":questionStart"])) ||
          puts.some((item) => records.has(keyOf(item.pk, item.sk)))) throw conditionalFailure();
      if (question?.Key && "UpdateExpression" in question && publication) {
        const stat = question.ExpressionAttributeNames?.["#stat"];
        records.set(keyOf(question.Key.pk, question.Key.sk), { ...publication,
          ...(stat ? { [stat]: Number(publication[stat] ?? 0) + 1 } : {}),
          ...(question.UpdateExpression?.includes("completedCount")
            ? { completedCount: Number(publication.completedCount ?? 0) + 1 } : {}) });
      }
      records.set(key, {
        ...current,
        points: Number(current.points ?? 0) + Number(update.ExpressionAttributeValues?.[":points"] ?? 0),
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
  afterEach(() => { vi.restoreAllMocks(); });

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
    const created = await publishAsyncQuiz(db, "table", request, principal, 30, Date.now());
    const retry = await publishAsyncQuiz(db, "table", request, principal, 30, Date.now());
    expect(retry).toEqual(created);
    expect(created.maxParticipants).toBe(250);
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const publication = records.get(keyOf(`ASYNC#${created.publicationId}`, "META"));
    expect(publication?.maxParticipants).toBe(250);
    expect(publication?.snapshot).toEqual(records.get(keyOf("OWNER#admin", `QUIZ#${quizId}`))?.quiz);
    records.set(keyOf("OWNER#admin", `QUIZ#${quizId}`), {
      ...records.get(keyOf("OWNER#admin", `QUIZ#${quizId}`)), quiz: { title: "Geändert", questions: [] },
    });
    expect((records.get(keyOf(`ASYNC#${created.publicationId}`, "META"))!.snapshot as { title: string }).title).toBe("Snapshot");
    expect([...records.values()].filter((item) => item.pk === "OWNER#admin" &&
      String(item.sk).startsWith("ASYNC#"))).toHaveLength(1);
    records.set(keyOf(`ASYNC#${created.publicationId}`, "META"), { ...publication, maxParticipants: 100 });
    const requestKey = keyOf("OWNER#admin", `ASYNC_REQUEST#${request.requestId}`);
    records.set(requestKey, { ...records.get(requestKey), maxParticipants: 100 });
    expect(await publishAsyncQuiz(db, "table", request, principal, 30, Date.now())).toEqual(created);
    expect(records.get(keyOf(`ASYNC#${created.publicationId}`, "META"))?.maxParticipants).toBe(250);
    await expect(publishAsyncQuiz(db, "table", { ...request, expiresAt: request.expiresAt + 1 },
      principal, 30, Date.now())).rejects.toThrow("bereits für eine andere Veröffentlichung verwendet");
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

  it("führt Quiz-Code und alten langen Link zu demselben Versuch derselben Runde", async () => {
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), joinCode: "004281" });
    records.set(keyOf("CODE#004281", "META"), { pk: "CODE#004281", sk: "META", publicationId, kind: "ASYNC", createdAt: 1 });
    const viaCode = await startAsyncQuiz(db, "table", "004281", identityId, Date.now());
    const viaToken = await startAsyncQuiz(db, "table", token, identityId, Date.now());
    expect(viaToken.displayName).toBe(viaCode.displayName);
    expect(viaToken.avatarId).toBe(viaCode.avatarId);
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(1);
    expect((await getAsyncPublicInfo(db, "table", "004281", Date.now())).joinCode).toBe("004281");
    expect((await getAsyncPublicInfo(db, "table", token, Date.now())).joinCode).toBe("004281");
  });

  it("erlaubt genau 250 eindeutige Teilnahmen und die Wiederaufnahme bei voller Runde", async () => {
    const names = new Set<string>();
    for (let index = 0; index < 250; index++) {
      const state = await startAsyncQuiz(db, "table", token, `guest-${index}`, Date.now());
      names.add(state.displayName);
      expect(state.maxParticipants).toBe(250);
    }
    expect(names.size).toBe(250);
    expect([...records.values()].filter((item) => String(item.sk).startsWith("ATTEMPT#"))).toHaveLength(250);
    expect([...records.values()].filter((item) => String(item.sk).startsWith("NAME#"))).toHaveLength(250);
    const before = await getMyAsyncState(db, "table", token, "guest-0", Date.now());
    const resumed = await startAsyncQuiz(db, "table", token, "guest-0", Date.now());
    expect(resumed.displayName).toBe(before?.displayName);
    expect(resumed.avatarId).toBe(before?.avatarId);
    await expect(startAsyncQuiz(db, "table", token, "guest-250", Date.now())).rejects.toThrow("maximale Teilnehmerzahl");
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(250);
  });

  it("vergibt den letzten von 250 Plätzen auch bei parallelen Starts nur einmal", async () => {
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), maxParticipants: 250, startedCount: 249 });
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, (_, index) =>
      startAsyncQuiz(db, "table", token, `concurrent-${index}`, Date.now())));
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of outcomes.filter((outcome) => outcome.status === "rejected")) {
      expect(result.reason.message).toContain("maximale Teilnehmerzahl");
    }
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(250);
    expect([...records.values()].filter((item) => String(item.sk).startsWith("ATTEMPT#"))).toHaveLength(1);
  });

  it("ergänzt bei einer Namenskollision eine Zahl, ohne bestehende Namen zu ändern", async () => {
    vi.spyOn(participation, "displayNameFor").mockReturnValue("Flinker Fuchs");
    const first = await startAsyncQuiz(db, "table", token, identityId, Date.now());
    const second = await startAsyncQuiz(db, "table", token, "another-guest", Date.now());
    expect(first.displayName).toBe("Flinker Fuchs");
    expect(second.displayName).toMatch(/^Flinker Fuchs \d{2,3}$/);
    expect((await getMyAsyncState(db, "table", token, identityId, Date.now()))?.displayName).toBe(first.displayName);
    expect(records.has(keyOf(pk, `NAME#${first.displayName}`))).toBe(true);
    expect(records.has(keyOf(pk, `NAME#${second.displayName}`))).toBe(true);
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(2);
  });

  it.each(["public", "code", "results", "overview", "state"] as const)(
    "hebt Bestandsrunden beim Zugriff über %s dauerhaft auf 250 an", async (surface) => {
      const original = { ...records.get(keyOf(pk, "META")), startedCount: 100, joinCode: "004281" };
      records.set(keyOf(pk, "META"), original);
      records.set(keyOf("CODE#004281", "META"), { pk: "CODE#004281", sk: "META", publicationId, kind: "ASYNC", createdAt: 1 });
      records.set(keyOf("OWNER#admin", `ASYNC#${publicationId}`), { pk: "OWNER#admin", sk: `ASYNC#${publicationId}`, publicationId, token });
      const principal = { subject: "admin", groups: ["Quizmasters"] };
      let result: { maxParticipants: number } | null;
      if (surface === "overview") {
        result = (await listAsyncPublications(db, "table", principal, Date.now()))[0];
      } else if (surface === "results") {
        result = await getAsyncPublicationResults(db, "table", { publicationId }, principal, Date.now());
      } else if (surface === "state") {
        result = await getMyAsyncState(db, "table", token, identityId, Date.now());
      } else {
        result = await getAsyncPublicInfo(db, "table", surface === "code" ? "004281" : token, Date.now());
      }
      expect(result?.maxParticipants ?? null).toBe(surface === "state" ? null : 250);
      expect(records.get(keyOf(pk, "META"))).toEqual({ ...original, maxParticipants: 250 });
      const writes = database.commandCalls(UpdateCommand).length;
      await getAsyncPublicInfo(db, "table", token, Date.now());
      expect(database.commandCalls(UpdateCommand)).toHaveLength(writes);
    },
  );

  it.each([
    { status: "ENDED", maxParticipants: 100 },
    { expiresAt: 1, maxParticipants: 100 },
    { maxParticipants: 500 },
  ])("ändert abgeschlossene Runden und höhere Limits nicht: %j", async (extra) => {
    const original = { ...records.get(keyOf(pk, "META")), ...extra };
    records.set(keyOf(pk, "META"), original);
    const info = await getAsyncPublicInfo(db, "table", token, Date.now());
    expect(info.maxParticipants).toBe(extra.maxParticipants);
    expect(records.get(keyOf(pk, "META"))).toEqual(original);
    expect(database.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it("hebt das Limit auch bei gleichzeitigen Zugriffen nur einmal an", async () => {
    const infos = await Promise.all(Array.from({ length: 5 }, () => getAsyncPublicInfo(db, "table", token, Date.now())));
    expect(infos.every((info) => info.maxParticipants === 250)).toBe(true);
    expect(records.get(keyOf(pk, "META"))).toMatchObject({ maxParticipants: 250, startedCount: 0 });
  });

  it.each([
    { status: "ENDED", maxParticipants: 100 },
    { expiresAt: 1, maxParticipants: 100 },
    { maxParticipants: 500 },
  ])("respektiert Änderungen zwischen Lesen und Anheben: %j", async (change) => {
    database.on(UpdateCommand).callsFake((input: UpdateCommandInput) => {
      assertValidExpressions(input);
      records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), ...change });
      throw Object.assign(new Error("conditional failure"), { name: "ConditionalCheckFailedException" });
    });
    const info = await getAsyncPublicInfo(db, "table", token, Date.now());
    expect(info.maxParticipants).toBe(change.maxParticipants);
    expect(records.get(keyOf(pk, "META"))).toMatchObject(change);
    expect(database.commandCalls(UpdateCommand)).toHaveLength(1);
  });

  it.each(["token", "code"])("gibt Speicherfehler beim Anheben über %s weiter", async (reference) => {
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), joinCode: "004281" });
    records.set(keyOf("CODE#004281", "META"), { publicationId });
    database.on(UpdateCommand).rejects(new Error("Speicher nicht verfügbar"));
    await expect(getAsyncPublicInfo(db, "table", reference === "code" ? "004281" : token, Date.now()))
      .rejects.toThrow("Speicher nicht verfügbar");
    expect(records.get(keyOf(pk, "META"))?.maxParticipants).toBe(100);
  });

  it("erlaubt nach Anhebung einer zuvor vollen Bestandsrunde weitere Starts", async () => {
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), startedCount: 100 });
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    expect(records.get(keyOf(pk, "META"))).toMatchObject({ maxParticipants: 250, startedCount: 101 });
  });

  it("wendet die Teilnahmegrenze auch beim Beitritt über den Quiz-Code an", async () => {
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), maxParticipants: 250, startedCount: 249, joinCode: "004281" });
    records.set(keyOf("CODE#004281", "META"), { pk: "CODE#004281", sk: "META", publicationId, kind: "ASYNC", createdAt: 1 });
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    await expect(startAsyncQuiz(db, "table", "004 281", "eu-central-1:another-guest", Date.now()))
      .rejects.toThrow("maximale Teilnehmerzahl");
    const resumed = await startAsyncQuiz(db, "table", "004281", identityId, Date.now());
    expect(resumed.displayName).toBeTruthy();
    expect(records.get(keyOf(pk, "META"))?.startedCount).toBe(250);
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
    // Ohne Tempo-Wertung gibt es keinen Timer; die Folgefrage darf direkt mitkommen.
    expect(first.question?.questionIndex).toBe(1);
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

  it("begrenzt die Laufzeit einer Veröffentlichung serverseitig", async () => {
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    await expect(publishAsyncQuiz(db, "table", { quizId: "4ee86a5f-31ed-4e31-b6c1-5b2699256747",
      requestId: "c22f156b-61a2-42d7-ae36-98aac6c22fb8", expiresAt: Date.now() + 91 * 86_400_000,
      timeZone: "Europe/Berlin" }, principal, 30, Date.now())).rejects.toThrow("höchstens 90 Tage");
  });

  it("liefert Ergebnisse aus aggregierten Zählern mit stabiler Versuchskennung", async () => {
    const metaKey = keyOf(pk, "META");
    records.set(metaKey, { ...records.get(metaKey), statsVersion: 1, completedCount: 0 });
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    await startAsyncQuiz(db, "table", token, "eu-central-1:second-guest", Date.now());
    await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
    expect(records.get(metaKey)).toMatchObject({ completedCount: 1, stat_000_a0: 1 });
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    const allAnswers = database.commandCalls(QueryCommand).length;
    const results = await getAsyncPublicationResults(db, "table", { publicationId, cursor: null }, principal, Date.now());
    const answerScans = database.commandCalls(QueryCommand).slice(allAnswers)
      .filter((call) => call.args[0].input.ExpressionAttributeValues?.[":prefix"] === "ANSWER#");
    expect(answerScans).toHaveLength(0);
    expect(results).toMatchObject({ participantCount: 2, completedCount: 1, partialCount: 1 });
    expect(results.questions[0].options.map((option) => option.count)).toEqual([1, 0]);
    expect(results.participants[0]).toMatchObject({ points: 1, rank: 1, status: "COMPLETED" });
    expect(results.participants[0].attemptId).toMatch(/^[a-f0-9]{24}$/);
    expect(results.participants[0].attemptId).not.toBe(results.participants[1].attemptId);
    expect(JSON.stringify(results)).not.toContain(createHash("sha256").update(identityId).digest("hex"));
  });

  it.each([250, 500])("liefert alle %i Plätze ohne Einzelantwortabfragen", async (count) => {
    const metaKey = keyOf(pk, "META");
    records.set(metaKey, { ...records.get(metaKey), statsVersion: 1, startedCount: count, completedCount: count,
      maxParticipants: count, stat_000_a0: count, scoringVersion: "ASYNC_SPEED_V1" });
    for (let index = 0; index < count; index++) {
      const identity = index.toString(16).padStart(64, "0");
      records.set(keyOf(pk, `ATTEMPT#${identity}`), {
        pk, sk: `ATTEMPT#${identity}`, identityHash: identity, displayName: `Spieler ${String(index).padStart(3, "0")}`,
        avatarId: "avatar-001", startedAt: Date.now(), answeredCount: 1, status: "COMPLETED",
        completedAt: Date.now(), points: 4000 - Math.floor(index / 2),
      });
    }
    if (count === 500) {
      database.on(QueryCommand).callsFake((input: QueryCommandInput) => {
        assertValidExpressions(input);
        const partition = input.ExpressionAttributeValues?.[":pk"];
        const prefix = input.ExpressionAttributeValues?.[":prefix"];
        const items = [...records.values()].filter((item) => item.pk === partition &&
          typeof item.sk === "string" && item.sk.startsWith(String(prefix))).sort((a, b) => String(a.sk).localeCompare(String(b.sk)));
        const start = input.ExclusiveStartKey ? items.findIndex((item) => item.sk === input.ExclusiveStartKey?.sk) + 1 : 0;
        const page = items.slice(start, start + 100);
        return { Items: page, LastEvaluatedKey: start + page.length < items.length
          ? { pk: partition, sk: page.at(-1)?.sk } : undefined };
      });
    }
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    const before = database.commandCalls(QueryCommand).length;
    const standings = await getAsyncStandings(db, "table", { publicationId }, principal, Date.now());
    const reads = database.commandCalls(QueryCommand).slice(before);
    expect(reads.some((call) => String(call.args[0].input.ExpressionAttributeValues?.[":prefix"]).startsWith("ANSWER#"))).toBe(false);
    expect(reads.filter((call) => call.args[0].input.ExpressionAttributeValues?.[":prefix"] === "ATTEMPT#"))
      .toHaveLength(count === 500 ? 5 : 1);
    expect(standings).toMatchObject({ participantCount: count, completedCount: count, totalParticipants: count, isFinal: false });
    expect(standings.participants).toHaveLength(count);
    expect(standings.participants.slice(0, 4).map(({ rank }) => rank)).toEqual([1, 1, 3, 3]);
    expect(standings.questions[0].options.map(({ count: value }) => value)).toEqual([count, 0]);
    expect(standings.participants[0]).not.toHaveProperty("answers");
    expect(JSON.stringify(standings)).not.toContain("identityHash");
    expect(standings).not.toHaveProperty("token");
    expect(standings).not.toHaveProperty("joinCode");
    const details = await getAsyncPublicationResults(db, "table", { publicationId }, principal, Date.now());
    expect(standings.participants.slice(0, 5).map(({ attemptId, points, rank }) => ({ attemptId, points, rank })))
      .toEqual(details.leaders.map(({ attemptId, points, rank }) => ({ attemptId, points, rank })));
  });

  it("berechnet den Zwischenstand älterer Veröffentlichungen aus den gespeicherten Antworten", async () => {
    await startAsyncQuiz(db, "table", token, identityId, Date.now());
    await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
    const before = database.commandCalls(QueryCommand).length;
    const standings = await getAsyncStandings(db, "table", { publicationId },
      { subject: "admin", groups: ["Quizmasters"] }, Date.now());
    expect(database.commandCalls(QueryCommand).slice(before)
      .some((call) => call.args[0].input.ExpressionAttributeValues?.[":prefix"] === "ANSWER#")).toBe(true);
    expect(standings).toMatchObject({ scoringVersion: "LEGACY_CORRECT", participantCount: 1 });
    expect(standings.participants[0]).toMatchObject({ points: 1, rank: 1, answeredCount: 1 });
    expect(standings.questions[0].options.map(({ count }) => count)).toEqual([1, 0]);
  });

  it("beschränkt den Zwischenstand auf Quizmaster, Eigentümer und die Aufbewahrungsfrist", async () => {
    const input = { publicationId };
    await expect(getAsyncStandings(db, "table", input, { subject: "admin", groups: [] }, Date.now()))
      .rejects.toThrow("Keine Berechtigung");
    await expect(getAsyncStandings(db, "table", input, { subject: "other", groups: ["Quizmasters"] }, Date.now()))
      .rejects.toThrow("gehört nicht zu diesem Konto");
    records.set(keyOf(pk, "META"), { ...records.get(keyOf(pk, "META")), retentionAt: Date.now() - 1 });
    await expect(getAsyncStandings(db, "table", input, { subject: "admin", groups: ["Quizmasters"] }, Date.now()))
      .rejects.toThrow("Aufbewahrungsfrist");
  });

  describe("ASYNC_SPEED_V1", () => {
    const start = Date.UTC(2030, 0, 1, 12);
    const principal = { subject: "admin", groups: ["Quizmasters"] };
    const answerKey = (index: number, identity = identityId) =>
      keyOf(pk, `ANSWER#${createHash("sha256").update(identity).digest("hex")}#${String(index).padStart(3, "0")}`);
    const attemptKey = (identity = identityId) => keyOf(pk, `ATTEMPT#${createHash("sha256").update(identity).digest("hex")}`);

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(start);
      const metaKey = keyOf(pk, "META");
      const meta = records.get(metaKey) as { snapshot: { questions: unknown[] } };
      records.set(metaKey, { ...meta, createdAt: start, expiresAt: start + 3_600_000, retentionAt: start + 31 * 86_400_000,
        statsVersion: 1, completedCount: 0, scoringVersion: "ASYNC_SPEED_V1",
        scoring: { basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30_000 },
        snapshot: { ...meta.snapshot, questions: [...meta.snapshot.questions, {
          text: "Zweite Frage?", answers: [{ text: "A", correct: false }, { text: "B", correct: true }],
          durationSeconds: 20, explanation: "",
        }] } });
    });
    afterEach(() => { vi.useRealTimers(); });

    it("speichert neue Veröffentlichungen mit Wertungsversion und Parametern", async () => {
      const quizId = "4ee86a5f-31ed-4e31-b6c1-5b2699256747";
      records.set(keyOf("OWNER#admin", `QUIZ#${quizId}`), { quizId, ownerId: "admin", version: 1, updatedAt: start,
        quiz: { title: "Neu", description: "", questions: [{ text: "Frage",
          answers: [{ text: "R", correct: true }, { text: "F", correct: false }], durationSeconds: 20, explanation: "" }] } });
      const created = await publishAsyncQuiz(db, "table", { quizId, requestId: "d22f156b-61a2-42d7-ae36-98aac6c22fb8",
        expiresAt: start + 60_000, timeZone: "Europe/Berlin" }, principal, 30, start);
      expect(records.get(keyOf(`ASYNC#${created.publicationId}`, "META"))).toMatchObject({
        scoringVersion: "ASYNC_SPEED_V1", scoring: { basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30_000 },
      });
    });

    it("startet den Fragetimer serverseitig beim Quizstart, nicht beim Linkaufruf oder Refresh", async () => {
      await getAsyncPublicInfo(db, "table", token, start);
      vi.setSystemTime(start + 4_000);
      const first = await startAsyncQuiz(db, "table", token, identityId, Date.now());
      expect(first.question).toMatchObject({ questionIndex: 0, startedAt: start + 4_000 });
      expect(first).toMatchObject({ scoringVersion: "ASYNC_SPEED_V1", basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30_000 });
      vi.setSystemTime(start + 20_000);
      const refreshed = await getMyAsyncState(db, "table", token, identityId, Date.now());
      const secondTab = await startAsyncQuiz(db, "table", token, identityId, Date.now());
      expect(refreshed?.question?.startedAt).toBe(start + 4_000);
      expect(secondTab.question?.startedAt).toBe(start + 4_000);
      expect(JSON.stringify(first)).not.toContain("Zweite Frage?");
    });

    it("wertet Tempo serverseitig, pausiert vor der nächsten Frage und verrät Punkte erst nach Quizende", async () => {
      await startAsyncQuiz(db, "table", token, identityId, Date.now());
      vi.setSystemTime(start + 15_000);
      const receipt = await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
      expect(receipt).toMatchObject({ acceptedAt: start + 15_000, answeredCount: 1, questionIndex: 0,
        attemptStatus: "IN_PROGRESS", nextQuestionIndex: 1, question: null });
      expect(JSON.stringify(receipt)).not.toMatch(/points|correct|Zweite Frage/i);
      expect(records.get(answerKey(0))).toMatchObject({ questionStartedAt: start, elapsedMs: 15_000,
        basePoints: 1000, bonusPoints: 250, points: 1250 });

      vi.setSystemTime(start + 50_000);
      const retry = await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
      expect(retry).toMatchObject({ acceptedAt: start + 15_000, answeredCount: 1, question: null });
      expect(records.get(answerKey(0))).toMatchObject({ points: 1250, acceptedAt: start + 15_000 });
      // Pause: Refresh öffnet die Folgefrage nicht und startet keinen Timer.
      const paused = await getMyAsyncState(db, "table", token, identityId, Date.now());
      expect(paused).toMatchObject({ attemptStatus: "IN_PROGRESS", answeredCount: 1, nextQuestionIndex: 1, question: null });
      expect(JSON.stringify(paused)).not.toContain("Zweite Frage?");
      expect(records.get(attemptKey())).toMatchObject({ points: 1250, currentQuestionIndex: 0, currentQuestionStartedAt: start });

      vi.setSystemTime(start + 60_000);
      const resumed = await startAsyncQuiz(db, "table", token, identityId, Date.now());
      expect(resumed.question).toMatchObject({ questionIndex: 1, text: "Zweite Frage?", startedAt: start + 60_000 });
      vi.setSystemTime(start + 70_000);
      expect((await getMyAsyncState(db, "table", token, identityId, Date.now()))?.question?.startedAt).toBe(start + 60_000);
      expect((await startAsyncQuiz(db, "table", token, identityId, Date.now())).question?.startedAt).toBe(start + 60_000);

      vi.setSystemTime(start + 100_000);
      const last = await submitAsyncAnswer(db, "table", { token, questionIndex: 1, choiceId: "a1" }, identityId, Date.now());
      expect(last).toMatchObject({ answeredCount: 2, attemptStatus: "COMPLETED", nextQuestionIndex: -1, question: null });
      expect(records.get(answerKey(1))).toMatchObject({ elapsedMs: 40_000, basePoints: 1000, bonusPoints: 0, points: 1000 });

      const running = await getMyAsyncState(db, "table", token, identityId, Date.now());
      expect(running?.points).toBeNull();
      expect(running?.answers.map((answer) => answer.points)).toEqual([null, null]);

      const metaKey = keyOf(pk, "META");
      records.set(metaKey, { ...records.get(metaKey), status: "ENDED", endedAt: Date.now() });
      const final = await getMyAsyncState(db, "table", token, identityId, Date.now());
      expect(final?.points).toBe(2250);
      expect(final?.results.map(({ basePoints, bonusPoints, points, elapsedMs }) => ({ basePoints, bonusPoints, points, elapsedMs })))
        .toEqual([{ basePoints: 1000, bonusPoints: 250, points: 1250, elapsedMs: 15_000 },
          { basePoints: 1000, bonusPoints: 0, points: 1000, elapsedMs: 40_000 }]);
      const results = await getAsyncPublicationResults(db, "table", { publicationId, cursor: null }, principal, Date.now());
      expect(results.scoringVersion).toBe("ASYNC_SPEED_V1");
      expect(results.participants[0]).toMatchObject({ points: 2250, rank: 1 });
      expect(results.participants[0].answers[0]).toMatchObject({ basePoints: 1000, bonusPoints: 250, points: 1250, elapsedMs: 15_000 });
    });

    it("vergibt für falsche Antworten keinen Tempo-Bonus und nimmt nach der Deadline nichts mehr an", async () => {
      await startAsyncQuiz(db, "table", token, identityId, Date.now());
      await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a1" }, identityId, Date.now());
      expect(records.get(answerKey(0))).toMatchObject({ elapsedMs: 0, basePoints: 0, bonusPoints: 0, points: 0 });
      vi.setSystemTime(start + 3_600_000);
      await expect(submitAsyncAnswer(db, "table", { token, questionIndex: 1, choiceId: "a1" }, identityId, Date.now()))
        .rejects.toThrow("Quizfrist ist abgelaufen");
      expect(records.has(answerKey(1))).toBe(false);
    });

    it("lehnt veraltete Antworten auf eine bereits weitergeschaltete Frage ab", async () => {
      await startAsyncQuiz(db, "table", token, identityId, Date.now());
      await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
      await expect(submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a1" }, identityId, Date.now()))
        .rejects.toThrow("bereits eine andere Antwort");
      expect(records.get(attemptKey())).toMatchObject({ answeredCount: 1, currentQuestionIndex: 0 });
    });

    it("nimmt keine Antwort auf eine noch nicht geöffnete Frage an", async () => {
      await startAsyncQuiz(db, "table", token, identityId, Date.now());
      await submitAsyncAnswer(db, "table", { token, questionIndex: 0, choiceId: "a0" }, identityId, Date.now());
      await expect(submitAsyncAnswer(db, "table", { token, questionIndex: 1, choiceId: "a1" }, identityId, Date.now()))
        .rejects.toThrow("Quizfortschritt hat sich geändert");
      expect(records.has(answerKey(1))).toBe(false);
      expect(records.get(attemptKey())).toMatchObject({ answeredCount: 1, status: "IN_PROGRESS" });
    });

    it("liefert globale Top 5 mit geteilten Rängen unabhängig von der Ergebnisseite", async () => {
      const points = [900, 4000, 2500, 2500, 3000, 2000, 2000, 100];
      points.forEach((value, index) => {
        const identity = `p${index}`.padEnd(64, "0").replace(/[^a-f0-9]/g, "a");
        records.set(keyOf(pk, `ATTEMPT#${identity}`), { pk, sk: `ATTEMPT#${identity}`, identityHash: identity,
          displayName: `Spieler ${index}`, avatarId: "avatar-001", startedAt: start, answeredCount: 2,
          status: "COMPLETED", completedAt: start + 1, points: value });
      });
      const firstPage = await getAsyncPublicationResults(db, "table", { publicationId, cursor: null }, principal, Date.now());
      const laterPage = await getAsyncPublicationResults(db, "table", { publicationId, cursor: "5" }, principal, Date.now());
      for (const result of [firstPage, laterPage]) {
        expect(result.leaders.map((leader) => [leader.displayName, leader.points, leader.rank])).toEqual([
          ["Spieler 1", 4000, 1], ["Spieler 4", 3000, 2], ["Spieler 2", 2500, 3], ["Spieler 3", 2500, 3], ["Spieler 5", 2000, 5],
        ]);
        expect(result.totalParticipants).toBe(8);
      }
      expect(laterPage.participants.map((player) => [player.displayName, player.rank])).toEqual([
        ["Spieler 6", 5], ["Spieler 0", 7], ["Spieler 7", 8],
      ]);
    });
  });
});
