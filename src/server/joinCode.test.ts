import { createHash } from "node:crypto";
import {
  GetCommand, PutCommand, TransactWriteCommand, UpdateCommand, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureAsyncJoinCode, getAsyncPublicInfo, publishAsyncQuiz, resolveJoinCode } from "./asyncQuiz";
import { createSession } from "./createSession";
import { JOIN_CODE_FREE_CONDITION, JoinCodeSpaceExhaustedError, MAX_JOIN_CODE_ATTEMPTS, normalizeJoinCode } from "./joinCode";

/**
 * Kleiner In-Memory-Fake, der die tatsächlich verwendeten Bedingungen auswertet und Transaktionen atomar anwendet.
 * Unbekannte Ausdrücke schlagen laut fehl, damit neue Schreibpfade hier bewusst ergänzt werden.
 */
type Item = Record<string, unknown>;
type Values = Record<string, unknown>;
const records = new Map<string, Item>();
const keyOf = (key: Item) => `${String(key.pk)}#${String(key.sk)}`;

const conditions: Record<string, (item: Item | undefined, values: Values) => boolean> = {
  [JOIN_CODE_FREE_CONDITION]: (item, v) => !item ||
    (typeof item.expiresAt === "number" && item.expiresAt <= (v[":now"] as number) && item.publicationId === undefined),
  "attribute_not_exists(pk) AND attribute_not_exists(sk)": (item) => !item,
  "attribute_exists(pk) AND ownerId = :owner AND attribute_not_exists(joinCode)": (item, v) =>
    !!item && item.ownerId === v[":owner"] && item.joinCode === undefined,
  "#status = :preparing AND ownerId = :owner": (item, v) => item?.status === v[":preparing"] && item?.ownerId === v[":owner"],
  "sessionId = :session": (item, v) => item?.sessionId === v[":session"],
  "#status = :active AND expiresAt > :now AND maxParticipants < :limit": (item, v) =>
    !!item && item.status === v[":active"] && Number(item.expiresAt) > Number(v[":now"]) &&
    Number(item.maxParticipants) < Number(v[":limit"]),
};

function check(condition: string | undefined, item: Item | undefined, values: Values = {}) {
  if (!condition) return true;
  const evaluate = conditions[condition];
  if (!evaluate) throw new Error(`Nicht unterstützte Bedingung im Test-Fake: ${condition}`);
  return evaluate(item, values);
}

function update(item: Item, expression: string, values: Values): Item {
  if (expression === "SET joinCode = :code") return { ...item, joinCode: values[":code"] };
  if (expression === "SET maxParticipants = :limit") return { ...item, maxParticipants: values[":limit"] };
  if (expression === "SET #status = :lobby ADD #version :one") {
    return { ...item, status: values[":lobby"], version: Number(item.version ?? 0) + Number(values[":one"]) };
  }
  if (expression === "SET #status = :failed") return { ...item, status: values[":failed"] };
  throw new Error(`Nicht unterstützter Update-Ausdruck im Test-Fake: ${expression}`);
}

function cancelled() {
  return Object.assign(new Error("Transaction cancelled"), {
    name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const transactions: string[][] = [];

const db = {
  async send(command: unknown) {
    await tick();
    if (command instanceof GetCommand) {
      const item = records.get(keyOf(command.input.Key as Item));
      return { Item: item ? structuredClone(item) : undefined };
    }
    if (command instanceof PutCommand) {
      const item = command.input.Item as Item;
      if (!check(command.input.ConditionExpression, records.get(keyOf(item)), command.input.ExpressionAttributeValues)) {
        throw Object.assign(new Error("Conditional check failed"), { name: "ConditionalCheckFailedException" });
      }
      records.set(keyOf(item), structuredClone(item));
      return {};
    }
    if (command instanceof UpdateCommand) {
      const key = keyOf(command.input.Key as Item);
      const values = command.input.ExpressionAttributeValues ?? {};
      if (!check(command.input.ConditionExpression, records.get(key), values)) {
        throw Object.assign(new Error("Conditional check failed"), { name: "ConditionalCheckFailedException" });
      }
      records.set(key, update(records.get(key) ?? { ...command.input.Key }, command.input.UpdateExpression ?? "", values));
      return command.input.ReturnValues === "ALL_NEW" ? { Attributes: structuredClone(records.get(key)) } : {};
    }
    if (command instanceof TransactWriteCommand) {
      const writes: Array<() => void> = [];
      const touched: string[] = [];
      for (const entry of command.input.TransactItems ?? []) {
        if (entry.Put) {
          const item = entry.Put.Item as Item;
          if (!check(entry.Put.ConditionExpression, records.get(keyOf(item)), entry.Put.ExpressionAttributeValues)) throw cancelled();
          touched.push(keyOf(item));
          writes.push(() => records.set(keyOf(item), structuredClone(item)));
        } else if (entry.Update) {
          const key = keyOf(entry.Update.Key as Item);
          const values = entry.Update.ExpressionAttributeValues ?? {};
          if (!check(entry.Update.ConditionExpression, records.get(key), values)) throw cancelled();
          const expression = entry.Update.UpdateExpression ?? "";
          touched.push(key);
          writes.push(() => records.set(key, update(records.get(key) ?? { ...entry.Update!.Key }, expression, values)));
        } else if (entry.Delete) {
          const key = keyOf(entry.Delete.Key as Item);
          if (!check(entry.Delete.ConditionExpression, records.get(key), entry.Delete.ExpressionAttributeValues)) throw cancelled();
          touched.push(key);
          writes.push(() => records.delete(key));
        } else {
          throw new Error("Nicht unterstützter Transaktionseintrag im Test-Fake.");
        }
      }
      writes.forEach((write) => write());
      transactions.push(touched);
      return {};
    }
    throw new Error(`Nicht unterstützter Befehl im Test-Fake: ${(command as object).constructor.name}`);
  },
} as unknown as DynamoDBDocumentClient;

const principal = { subject: "admin", groups: ["Quizmasters"] };
const quizId = "4ee86a5f-31ed-4e31-b6c1-5b2699256747";
const legacyId = "2ba41d80-30b1-4ad0-9e3f-375cf07cf6f5";
const legacyToken = "A".repeat(43);
const sequence = (...codes: string[]) => {
  let index = 0;
  return () => codes[Math.min(index++, codes.length - 1)];
};
const codeItem = (code: string) => records.get(`CODE#${code}#META`);
const publishEnd = Date.now() + 3_600_000;
const publish = (codes: () => string, requestId = "b22f156b-61a2-42d7-ae36-98aac6c22fb8") =>
  publishAsyncQuiz(db, "table", { quizId, requestId, expiresAt: publishEnd, timeZone: "Europe/Berlin" },
    principal, 30, Date.now(), codes);

function seedLegacyPublication(extra: Item = {}) {
  const tokenHash = createHash("sha256").update(legacyToken).digest("hex");
  records.set(`ASYNC_TOKEN#${tokenHash}#META`, { pk: `ASYNC_TOKEN#${tokenHash}`, sk: "META", publicationId: legacyId });
  records.set(`ASYNC#${legacyId}#META`, {
    pk: `ASYNC#${legacyId}`, sk: "META", publicationId: legacyId, ownerId: "admin", quizId, title: "Altes Quiz",
    snapshot: { title: "Altes Quiz", description: "", questions: [{ text: "Frage?", durationSeconds: 20, explanation: "",
      answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }] }] },
    status: "ACTIVE", tokenHash, createdAt: Date.now() - 1000, expiresAt: Date.now() + 3_600_000, timeZone: "Europe/Berlin",
    retentionAt: Date.now() + 31 * 86_400_000, retentionDays: 30, maxParticipants: 100, startedCount: 0, ...extra,
  });
}

beforeEach(() => {
  records.clear();
  transactions.length = 0;
  records.set(`OWNER#admin#QUIZ#${quizId}`, {
    pk: "OWNER#admin", sk: `QUIZ#${quizId}`, quizId, ownerId: "admin", version: 1, updatedAt: Date.now(),
    quiz: { title: "Tierisch unglaubliche Fakten", description: "", questions: [{ text: "Frage?", durationSeconds: 20,
      explanation: "", answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }] }] },
  });
});

describe("Quiz-Code: Normalisierung", () => {
  it("entfernt Gruppierungszeichen und behält führende Nullen", () => {
    expect(normalizeJoinCode("004 281")).toBe("004281");
    expect(normalizeJoinCode(" 482-619 ")).toBe("482619");
    expect(normalizeJoinCode("482\u202f619")).toBe("482619");
    expect(normalizeJoinCode("482.619")).toBe("482619");
    expect(normalizeJoinCode("４８２６１９")).toBe("482619");
  });

  it("lehnt leere, zu kurze, zu lange und nicht numerische Eingaben verständlich ab", () => {
    expect(() => normalizeJoinCode("")).toThrow("Bitte gib einen Quiz-Code ein.");
    expect(() => normalizeJoinCode(undefined)).toThrow("Bitte gib einen Quiz-Code ein.");
    expect(() => normalizeJoinCode("12345")).toThrow("genau 6 Ziffern");
    expect(() => normalizeJoinCode("1234567")).toThrow("genau 6 Ziffern");
    expect(() => normalizeJoinCode("12a456")).toThrow("nur aus 6 Ziffern");
  });
});

describe("Quiz-Code: Vergabe beim Veröffentlichen", () => {
  it("reserviert den Code dauerhaft in derselben Transaktion wie die Runde", async () => {
    const receipt = await publish(sequence("004281"));
    expect(receipt.joinCode).toBe("004281");
    expect(codeItem("004281")).toEqual({ pk: "CODE#004281", sk: "META", publicationId: receipt.publicationId,
      kind: "ASYNC", createdAt: expect.any(Number) });
    expect(codeItem("004281")).not.toHaveProperty("ttl");
    expect(codeItem("004281")).not.toHaveProperty("expiresAt");
    expect(records.get(`ASYNC#${receipt.publicationId}#META`)?.joinCode).toBe("004281");
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toContain("CODE#004281#META");
    expect(transactions[0]).toContain(`ASYNC#${receipt.publicationId}#META`);
  });

  it("liefert beim idempotenten Retry dieselbe Runde und denselben Code", async () => {
    const first = await publish(sequence("004281"));
    const retry = await publish(sequence("999999"));
    expect(retry).toEqual(first);
    expect(codeItem("999999")).toBeUndefined();
  });

  it("weicht bei Kollision mit Quizrunden- oder aktivem Live-Code auf einen neuen Kandidaten aus", async () => {
    records.set("CODE#111111#META", { pk: "CODE#111111", sk: "META", publicationId: legacyId, kind: "ASYNC", createdAt: 1 });
    records.set("CODE#222222#META", { pk: "CODE#222222", sk: "META", sessionId: "live", expiresAt: Date.now() + 60_000, ttl: 1 });
    const receipt = await publish(sequence("111111", "222222", "333333"));
    expect(receipt.joinCode).toBe("333333");
    expect(codeItem("111111")?.publicationId).toBe(legacyId);
    expect(codeItem("222222")?.sessionId).toBe("live");
  });

  it("zwei gleichzeitige Veröffentlichungen mit demselben Kandidaten erhalten verschiedene Codes", async () => {
    const [first, second] = await Promise.all([
      publish(sequence("123123", "456456"), "11111111-1111-4111-8111-111111111111"),
      publish(sequence("123123", "789789"), "22222222-2222-4222-8222-222222222222"),
    ]);
    expect(first.publicationId).not.toBe(second.publicationId);
    expect(new Set([first.joinCode, second.joinCode]).size).toBe(2);
    expect([first.joinCode, second.joinCode]).toContain("123123");
    for (const receipt of [first, second]) expect(codeItem(receipt.joinCode)?.publicationId).toBe(receipt.publicationId);
  });

  it("übernimmt einen abgelaufenen Live-Code, aber nie einen Code einer Quizrunde", async () => {
    records.set("CODE#444444#META", { pk: "CODE#444444", sk: "META", sessionId: "old-live", expiresAt: Date.now() - 1, ttl: 1 });
    const receipt = await publish(sequence("444444"));
    expect(receipt.joinCode).toBe("444444");
    expect(codeItem("444444")).toMatchObject({ publicationId: receipt.publicationId, kind: "ASYNC" });
    expect(codeItem("444444")).not.toHaveProperty("expiresAt");
  });

  it("bricht nach begrenzten Versuchen mit klarem Fehler ab, ohne halbe Runde", async () => {
    records.set("CODE#777777#META", { pk: "CODE#777777", sk: "META", publicationId: legacyId, kind: "ASYNC", createdAt: 1 });
    let calls = 0;
    await expect(publish(() => { calls++; return "777777"; })).rejects.toBeInstanceOf(JoinCodeSpaceExhaustedError);
    expect(calls).toBe(MAX_JOIN_CODE_ATTEMPTS);
    expect([...records.keys()].some((key) => key.startsWith("ASYNC#"))).toBe(false);
    expect([...records.keys()].some((key) => key.startsWith("ASYNC_TOKEN#"))).toBe(false);
  });
});

describe("Quiz-Code: gemeinsamer Codebereich mit Live-Quiz", () => {
  it("ein neues Live-Quiz überschreibt nie den Code einer Quizrunde – auch nicht nach deren Löschung", async () => {
    const receipt = await publish(sequence("555555"));
    const live = await createSession(db, "table", { quizId }, principal, {}, Date.now(), sequence("555555", "666666"));
    expect(live.joinCode).toBe("666666");
    expect(codeItem("555555")?.publicationId).toBe(receipt.publicationId);

    // Simuliert das TTL-Löschen der Runde: Der minimale Reservierungseintrag bleibt und sperrt den Code weiter.
    for (const key of [...records.keys()]) if (key.startsWith(`ASYNC#${receipt.publicationId}`)) records.delete(key);
    const later = await createSession(db, "table", { quizId }, principal, {}, Date.now(), sequence("555555", "888888"));
    expect(later.joinCode).toBe("888888");
    expect(codeItem("555555")?.publicationId).toBe(receipt.publicationId);
    await expect(resolveJoinCode(db, "table", "555555", Date.now())).rejects.toThrow("nicht mehr verfügbar");
  });

  it("ordnet Codes eindeutig Live-Quiz oder Quizrunde zu", async () => {
    const receipt = await publish(sequence("004281"));
    const live = await createSession(db, "table", { quizId }, principal, {}, Date.now(), sequence("123456"));
    expect(await resolveJoinCode(db, "table", "004 281", Date.now())).toEqual({ mode: "ASYNC", joinCode: "004281" });
    expect(await resolveJoinCode(db, "table", live.joinCode, Date.now())).toEqual({ mode: "LIVE", joinCode: "123456" });
    await expect(resolveJoinCode(db, "table", "999999", Date.now())).rejects.toThrow("Diesen Quiz-Code gibt es nicht");
    await expect(resolveJoinCode(db, "table", "12 34", Date.now())).rejects.toThrow("genau 6 Ziffern");
    records.set("CODE#123456#META", { ...codeItem("123456"), expiresAt: Date.now() - 1 });
    await expect(resolveJoinCode(db, "table", "123456", Date.now())).rejects.toThrow("Diesen Quiz-Code gibt es nicht");
    const info = await getAsyncPublicInfo(db, "table", "004281", Date.now());
    expect(info).toMatchObject({ title: "Tierisch unglaubliche Fakten", joinCode: "004281", status: "ACTIVE" });
    expect(JSON.stringify(await resolveJoinCode(db, "table", "004281", Date.now()))).not.toContain(receipt.publicationId);
  });
});

describe("Quiz-Code: Nachvergabe für Runden ohne Code", () => {
  it("vergibt einmalig einen stabilen Code; alter Link und Code führen zur selben Runde", async () => {
    seedLegacyPublication();
    const first = await ensureAsyncJoinCode(db, "table", { publicationId: legacyId }, principal, Date.now(), sequence("482619"));
    const again = await ensureAsyncJoinCode(db, "table", { publicationId: legacyId }, principal, Date.now(), sequence("000001"));
    expect(first).toEqual({ publicationId: legacyId, joinCode: "482619" });
    expect(again.joinCode).toBe("482619");
    expect(codeItem("000001")).toBeUndefined();
    const viaToken = await getAsyncPublicInfo(db, "table", legacyToken, Date.now());
    const viaCode = await getAsyncPublicInfo(db, "table", "482619", Date.now());
    expect({ ...viaCode, serverTime: 0 }).toEqual({ ...viaToken, serverTime: 0 });
    expect(records.get(`ASYNC#${legacyId}#META`)?.startedCount).toBe(0);
  });

  it("liefert bei parallelen Aufrufen (zwei Admin-Tabs) denselben Code und reserviert keinen zweiten", async () => {
    seedLegacyPublication();
    const results = await Promise.all([
      ensureAsyncJoinCode(db, "table", { publicationId: legacyId }, principal, Date.now(), sequence("100001")),
      ensureAsyncJoinCode(db, "table", { publicationId: legacyId }, principal, Date.now(), sequence("200002")),
    ]);
    expect(results[0].joinCode).toBe(results[1].joinCode);
    const reserved = [...records.values()].filter((item) => String(item.pk).startsWith("CODE#") && item.publicationId === legacyId);
    expect(reserved).toHaveLength(1);
    expect(records.get(`ASYNC#${legacyId}#META`)?.joinCode).toBe(results[0].joinCode);
  });

  it("verweigert die Nachvergabe für fremde Runden", async () => {
    seedLegacyPublication({ ownerId: "someone-else" });
    await expect(ensureAsyncJoinCode(db, "table", { publicationId: legacyId }, principal, Date.now(), sequence("300003")))
      .rejects.toThrow("gehört nicht zu diesem Konto");
    expect(codeItem("300003")).toBeUndefined();
  });

  it("lässt einen Code ohne passende Runde nicht auf eine andere Runde zeigen", async () => {
    seedLegacyPublication({ joinCode: "482619" });
    records.set("CODE#482619#META", { pk: "CODE#482619", sk: "META", publicationId: "6b0b8a59-8f2e-4ad8-8a73-5d0d32b7a0c1",
      kind: "ASYNC", createdAt: 1 });
    await expect(getAsyncPublicInfo(db, "table", "482619", Date.now())).rejects.toThrow("nicht mehr verfügbar");
  });
});
