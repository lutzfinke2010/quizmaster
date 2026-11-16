import { describe, expect, it, vi } from "vitest";
import {
  AnswerError, buildAnswerTransaction, submitAnswer,
  type AnswerContext, type AnswerInput, type AnswerStore,
} from "./submitAnswer";

class MemoryStore implements AnswerStore {
  context: AnswerContext = {
    meta: { status: "QUESTION_OPEN", currentQuestionId: "q1", opensAt: 1000, closesAt: 2000, expiresAt: 5000 },
    participant: { participantId: "p1" },
    answer: null,
  };
  count = 0;
  version = 1;
  async read(input: AnswerInput, identityId: string): Promise<AnswerContext> {
    if (identityId !== "eu-central-1:guest" || input.sessionId !== "s1") {
      return { meta: null, participant: null, answer: null };
    }
    return structuredClone(this.context);
  }
  async accept(input: AnswerInput, identityId: string, participantId: string, receivedAt: number, expiresAt: number,
    previousAnswer: AnswerContext["answer"]) {
    const { meta, participant, answer } = this.context;
    if (!meta || meta.status !== "QUESTION_OPEN" || meta.currentQuestionId !== input.questionId ||
        meta.opensAt == null || meta.closesAt == null || receivedAt < meta.opensAt || receivedAt >= meta.closesAt ||
        expiresAt !== meta.expiresAt || receivedAt >= expiresAt || participant?.participantId !== participantId ||
        identityId !== "eu-central-1:guest" || !["a1", "a2"].includes(input.choiceId) ||
        answer?.choiceId !== previousAnswer?.choiceId || answer?.receivedAt !== previousAnswer?.receivedAt ||
        (answer && receivedAt <= answer.receivedAt)) {
      throw Object.assign(new Error("conditional failure"), {
        name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
      });
    }
    if (!answer) this.count++;
    this.context.answer = { choiceId: input.choiceId, receivedAt };
    this.version++;
  }
}

const request = { sessionId: "s1", questionId: "q1", choiceId: "a1" };
const identity = "eu-central-1:guest";

describe("Antwortannahme", () => {
  it("bestätigt eine Wiederholung derselben Antwort ohne erneutes Zählen", async () => {
    const store = new MemoryStore();
    expect(await submitAnswer(store, request, identity, 1000)).toEqual({ acceptedAt: 1000 });
    expect(await submitAnswer(store, request, identity, 2500)).toEqual({ acceptedAt: 1000 });
    expect(store.count).toBe(1);
    expect(store.version).toBe(2);
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 2500))
      .rejects.toMatchObject({ code: "NOT_OPEN" });
  });

  it("speichert bei A -> B -> A die letzte Änderung, ohne erneut zu zählen", async () => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1000);
    expect(await submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500)).toEqual({ acceptedAt: 1500 });
    expect(await submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1600)).toEqual({ acceptedAt: 1500 });
    expect(await submitAnswer(store, request, identity, 1999)).toEqual({ acceptedAt: 1999 });
    expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1999 });
    expect(store.count).toBe(1);
    expect(store.version).toBe(4);
  });

  it("zählt parallele identische Antworten höchstens einmal", async () => {
    const store = new MemoryStore();
    const results = await Promise.all(Array.from({ length: 20 }, () => submitAnswer(store, request, identity, 1001)));
    expect(results).toEqual(Array.from({ length: 20 }, () => ({ acceptedAt: 1001 })));
    expect(store.count).toBe(1);
  });

  it("akzeptiert bei konkurrierenden unterschiedlichen Antworten nur eine", async () => {
    const store = new MemoryStore();
    const results = await Promise.allSettled([
      submitAnswer(store, request, identity, 1001),
      submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1001),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(store.count).toBe(1);
  });

  it("wiederholt einen konkurrierenden Write mit dem neuen Stand und übernimmt die spätere Auswahl", async () => {
    const store = new MemoryStore();
    await Promise.all([
      submitAnswer(store, request, identity, 1100),
      submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500),
    ]);
    expect(store.context.answer).toEqual({ choiceId: "a2", receivedAt: 1500 });
    expect(store.count).toBe(1);
    expect(store.version).toBe(3);
  });

  it("lässt einen verzögerten älteren Write eine neuere Antwort nicht überschreiben", async () => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1000);
    const accept = store.accept.bind(store);
    vi.spyOn(store, "accept").mockImplementationOnce(async (...args) => {
      await submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1400);
      await submitAnswer(store, request, identity, 1600);
      return accept(...args);
    });
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1200))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1600 });
    expect(store.count).toBe(1);
  });

  it.each([1499, 1500])("lehnt einen Wechsel mit älterem oder gleichem Zeitstempel %i ab", async (time) => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1500);
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, time))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1500 });
    expect(store.version).toBe(2);
  });

  it("bestätigt nach verlorenem Beleg die tatsächlich gespeicherte Änderung", async () => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1000);
    const accept = store.accept.bind(store);
    vi.spyOn(store, "accept").mockImplementationOnce(async (...args) => {
      await accept(...args);
      throw new Error("Verbindung unterbrochen");
    });
    expect(await submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500)).toEqual({ acceptedAt: 1500 });
    expect(store.count).toBe(1);
    expect(store.version).toBe(3);
  });

  it("meldet Speicherfehler explizit und behält die bisherige Antwort", async () => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1000);
    vi.spyOn(store, "accept").mockRejectedValueOnce(new Error("Speicher nicht erreichbar"));
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500))
      .rejects.toThrow("Speicher nicht erreichbar");
    expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1000 });
  });

  it("übernimmt keine Änderung, wenn das Schließen die Schreibtransaktion überholt", async () => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1000);
    const accept = store.accept.bind(store);
    vi.spyOn(store, "accept").mockImplementationOnce(async (...args) => {
      store.context.meta!.status = "SCORING";
      return accept(...args);
    });
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500))
      .rejects.toMatchObject({ code: "NOT_OPEN" });
    expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1000 });
  });

  it("lehnt fremde Identitäten und Sitzungen und zusätzliche Teilnehmer-IDs ab", async () => {
    const store = new MemoryStore();
    await expect(submitAnswer(store, request, "eu-central-1:other", 1000)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await expect(submitAnswer(store, { ...request, sessionId: "other" }, identity, 1000)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await expect(submitAnswer(store, { ...request, participantId: "p1" }, identity, 1000)).rejects.toThrow();
  });

  it("prüft Frist und Status und macht abgelaufene Teilnahme sofort ungültig", async () => {
    const store = new MemoryStore();
    for (const time of [999, 2000]) {
      await expect(submitAnswer(store, request, identity, time)).rejects.toMatchObject({ code: "NOT_OPEN" });
    }
    if (!store.context.meta) throw new Error("missing fixture");
    store.context.meta.status = "QUESTION_CLOSED";
    await expect(submitAnswer(store, request, identity, 1500)).rejects.toMatchObject({ code: "NOT_OPEN" });
    await expect(submitAnswer(store, request, identity, 5000)).rejects.toBeInstanceOf(AnswerError);
    expect(store.count).toBe(0);
  });

  it.each(["COUNTDOWN", "QUESTION_CLOSED", "SCORING", "REVEAL", "CANCELLED"])(
    "erlaubt in %s keine Änderung der gespeicherten Antwort", async (status) => {
      const store = new MemoryStore();
      await submitAnswer(store, request, identity, 1000);
      store.context.meta!.status = status;
      await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500))
        .rejects.toMatchObject({ code: "NOT_OPEN" });
      expect(await submitAnswer(store, request, identity, 1500)).toEqual({ acceptedAt: 1000 });
      expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1000 });
      expect(store.count).toBe(1);
    },
  );

  it("behält bei Fristende, falscher Frage, ungültiger Option und fehlender Teilnahme die alte Antwort", async () => {
    const store = new MemoryStore();
    await submitAnswer(store, request, identity, 1000);
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 2000))
      .rejects.toMatchObject({ code: "NOT_OPEN" });
    await expect(submitAnswer(store, { ...request, questionId: "q2", choiceId: "a2" }, identity, 1500))
      .rejects.toMatchObject({ code: "NOT_OPEN" });
    await expect(submitAnswer(store, { ...request, choiceId: "invalid" }, identity, 1500))
      .rejects.toMatchObject({ code: "REJECTED" });
    store.context.participant = null;
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 1500))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    expect(store.context.answer).toEqual({ choiceId: "a1", receivedAt: 1000 });
    expect(store.version).toBe(2);
  });

  it("prüft Mitgliedschaft, Status, Frist, gültige Option und Antwortschlüssel in einer Transaktion", () => {
    const transaction = buildAnswerTransaction("table", request, identity, "p1", 1500, 10000);
    expect(transaction.TransactItems).toHaveLength(4);
    expect(transaction.TransactItems?.[0].Update?.ConditionExpression).toContain("closesAt > :received");
    expect(transaction.TransactItems?.[1].ConditionCheck?.ConditionExpression).toContain("participantId = :participant");
    expect(transaction.TransactItems?.[2].ConditionCheck?.ConditionExpression).toContain("contains(answerIds, :choice)");
    expect(transaction.TransactItems?.[3].Put?.ConditionExpression).toContain("attribute_not_exists");
    expect(transaction.TransactItems?.[3].Put?.Item?.sk).toBe("ANSWER#q1#p1");
  });

  it("ersetzt Antworten bedingt und erhöht nur die Version, nicht den Antwortzähler", () => {
    const transaction = buildAnswerTransaction("table", { ...request, choiceId: "a2" }, identity, "p1", 1500, 10000,
      { choiceId: "a1", receivedAt: 1100 });
    expect(transaction.TransactItems?.[0].Update?.UpdateExpression).toBe("ADD #version :one");
    expect(transaction.TransactItems?.[3].Put).toMatchObject({
      Item: { sk: "ANSWER#q1#p1", choiceId: "a2", receivedAt: 1500, ttl: 10 },
      ConditionExpression: "choiceId = :previousChoice AND receivedAt = :previousReceived AND receivedAt < :received",
      ExpressionAttributeValues: { ":previousChoice": "a1", ":previousReceived": 1100, ":received": 1500 },
    });
  });
});
