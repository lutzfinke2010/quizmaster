import { describe, expect, it } from "vitest";
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
  async read(input: AnswerInput, identityId: string): Promise<AnswerContext> {
    if (identityId !== "eu-central-1:guest" || input.sessionId !== "s1") {
      return { meta: null, participant: null, answer: null };
    }
    return structuredClone(this.context);
  }
  async accept(input: AnswerInput, _identityId: string, _participantId: string, receivedAt: number) {
    if (this.context.answer) {
      const error = new Error("conditional failure");
      error.name = "TransactionCanceledException";
      throw error;
    }
    this.context.answer = { choiceId: input.choiceId, receivedAt };
    this.count++;
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
    await expect(submitAnswer(store, { ...request, choiceId: "a2" }, identity, 2500))
      .rejects.toMatchObject({ code: "ALREADY_ANSWERED" });
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

  it("prüft Mitgliedschaft, Status, Frist, gültige Option und Antwortschlüssel in einer Transaktion", () => {
    const transaction = buildAnswerTransaction("table", request, identity, "p1", 1500, 10000);
    expect(transaction.TransactItems).toHaveLength(4);
    expect(transaction.TransactItems?.[0].Update?.ConditionExpression).toContain("closesAt > :received");
    expect(transaction.TransactItems?.[1].ConditionCheck?.ConditionExpression).toContain("participantId = :participant");
    expect(transaction.TransactItems?.[2].ConditionCheck?.ConditionExpression).toContain("contains(answerIds, :choice)");
    expect(transaction.TransactItems?.[3].Put?.ConditionExpression).toContain("attribute_not_exists");
    expect(transaction.TransactItems?.[3].Put?.Item?.sk).toBe("ANSWER#q1#p1");
  });
});
