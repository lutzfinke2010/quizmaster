import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand,
  type GetCommandInput, type PutCommandInput, type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultGenerationRequest } from "../domain/quizGeneration";
import { buildPrompt, getQuizGeneration, GENERATION_STALE_AFTER_MS, runQuizGeneration, startQuizGeneration } from "./quizGeneration";

const database = mockClient(DynamoDBDocumentClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const records = new Map<string, Record<string, unknown>>();
const admin = { subject: "admin-1", groups: ["Quizmasters"] };
const request = { ...defaultGenerationRequest(), title: "Weltraum", topic: "Planeten", questionCount: 1, answerCount: 2 };
const keyOf = (key: Record<string, unknown> | undefined) => `${String(key?.pk)}#${String(key?.sk)}`;

function openAiResponse(content: unknown, init: { status?: number; finish?: string } = {}) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ finish_reason: init.finish ?? "stop",
    message: { content: JSON.stringify(content), refusal: null } }] }), { status: init.status ?? 200 }));
}

beforeEach(() => {
  database.reset();
  records.clear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  database.on(PutCommand).callsFake((input: PutCommandInput) => { records.set(keyOf(input.Item), { ...input.Item }); return {}; });
  database.on(GetCommand).callsFake((input: GetCommandInput) => ({ Item: records.get(keyOf(input.Key)) }));
  database.on(UpdateCommand).callsFake((input: UpdateCommandInput) => {
    const item = records.get(keyOf(input.Key));
    const values = input.ExpressionAttributeValues ?? {};
    if (!item || item.status !== "PENDING") throw Object.assign(new Error("failed"), { name: "ConditionalCheckFailedException" });
    item.status = values[":succeeded"] ?? values[":failed"];
    if (values[":quiz"]) item.quiz = values[":quiz"];
    if (values[":error"]) item.error = values[":error"];
    return {};
  });
});

async function start() {
  const invoke = vi.fn(async () => undefined);
  const job = await startQuizGeneration(db, "table", request, admin, 1_000, invoke);
  return { job, invoke };
}

describe("KI-Quizgenerierung (Server)", () => {
  it("legt einen Job an und startet den Generator", async () => {
    const { job, invoke } = await start();
    expect(job.status).toBe("PENDING");
    expect(invoke).toHaveBeenCalledWith(job.jobId);
    expect(records.get(`GENERATION#${job.jobId}#JOB`)).toMatchObject({ ownerId: "admin-1", status: "PENDING" });
  });

  it("verweigert Nicht-Quizmaster und fremde Jobs", async () => {
    await expect(startQuizGeneration(db, "table", request, { subject: "x", groups: [] }, 1_000, vi.fn()))
      .rejects.toThrow("Keine Berechtigung");
    const { job } = await start();
    await expect(getQuizGeneration(db, "table", job.jobId, { subject: "other", groups: ["Quizmasters"] }, 2_000))
      .rejects.toThrow("nicht gefunden");
  });

  it("speichert das normalisierte Quiz nach erfolgreicher OpenAI-Antwort", async () => {
    const { job } = await start();
    const fetch = openAiResponse({ description: "Test", questions: [{ text: "Roter Planet?", answers: ["Mars", "Venus"], correctIndex: 0, explanation: "Eisenoxid." }] });
    await runQuizGeneration(db, "table", job.jobId, { apiKey: "key", model: "gpt-4.1-mini", fetch });
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.response_format.json_schema.strict).toBe(true);
    const result = await getQuizGeneration(db, "table", job.jobId, admin, 2_000);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.quiz?.title).toBe("Weltraum");
    expect(result.quiz?.questions[0].answers.find((answer) => answer.correct)?.text).toBe("Mars");
  });

  it("vermerkt OpenAI-Fehler am Job, ohne zu werfen", async () => {
    const { job } = await start();
    const fetch = vi.fn(async () => new Response("quota", { status: 429 }));
    await runQuizGeneration(db, "table", job.jobId, { apiKey: "key", model: "m", fetch });
    const result = await getQuizGeneration(db, "table", job.jobId, admin, 2_000);
    expect(result).toMatchObject({ status: "FAILED", quiz: null });
    expect(result.error).toMatch(/ausgelastet/);
  });

  it("meldet abgebrochene Jobs nach Zeitüberschreitung als fehlgeschlagen", async () => {
    const { job } = await start();
    const result = await getQuizGeneration(db, "table", job.jobId, admin, 1_000 + GENERATION_STALE_AFTER_MS + 1);
    expect(result.status).toBe("FAILED");
  });

  it("markiert den Job als fehlgeschlagen, wenn der Generator nicht gestartet werden kann", async () => {
    await expect(startQuizGeneration(db, "table", request, admin, 1_000, async () => { throw new Error("boom"); }))
      .rejects.toThrow("fehlgeschlagen");
    expect([...records.values()][0]).toMatchObject({ status: "FAILED" });
  });

  it("baut den Prompt aus allen Vorgaben", () => {
    const { user } = buildPrompt({ ...request, audience: "Kinder", notes: "Keine Zwergplaneten", includeExplanations: false });
    expect(user).toContain("Thema: Planeten");
    expect(user).toContain("genau 2");
    expect(user).toContain("Zielgruppe: Kinder");
    expect(user).toContain("Keine Zwergplaneten");
    expect(user).toContain("leer lassen");
  });
});
