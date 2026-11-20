import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, TransactGetCommand, TransactWriteCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { finalizeQuestion } from "./finalizeQuestion";

const database = mockClient(DynamoDBDocumentClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const request = { sessionId: "session", questionId: "q1", timerId: "timer" };
let items: Record<string, Record<string, unknown>>;

describe("Scoring the final stored answer", () => {
  beforeEach(() => {
    database.reset();
    items = {
      META: { status: "QUESTION_OPEN", currentQuestionId: "q1", timerId: "timer",
        opensAt: 1000, closesAt: 2000, expiresAt: 10000, answerCount: 2, version: 4 },
      "QUESTION#q1": { answerIds: ["a1", "a2"], correctChoiceId: "a1", explanation: "Solution" },
      "ANSWER#q1#p1": { sk: "ANSWER#q1#p1", choiceId: "a1", receivedAt: 1750 },
      "ANSWER#q1#p2": { sk: "ANSWER#q1#p2", choiceId: "a2", receivedAt: 1900 },
      "PARTICIPANT#p1": { totalPoints: 100, correctAnswers: 1, correctElapsedMs: 200 },
      "PARTICIPANT#p2": { totalPoints: 0, correctAnswers: 0, correctElapsedMs: 0 },
    };
    database.on(TransactGetCommand).callsFake((input) => ({
      Responses: input.TransactItems.map((entry: { Get: { Key: { sk: string } } }) => ({
        Item: items[entry.Get.Key.sk] ? { ...items[entry.Get.Key.sk] } : undefined,
      })),
    }));
    database.on(GetCommand).callsFake((input) => ({ Item: items[input.Key.sk] }));
    database.on(UpdateCommand).callsFake((input) => {
      expect(input.Key.sk).toBe("META");
      const values = input.ExpressionAttributeValues;
      expect(items.META.status).toBe(values[":scoring"] ? "QUESTION_CLOSED" : "QUESTION_OPEN");
      items.META.status = values[":scoring"] ?? values[":closed"];
      return {};
    });
    database.on(QueryCommand).callsFake((input) => {
      expect(items.META.status).toBe("SCORING");
      expect(input.ConsistentRead).toBe(true);
      const prefix = input.ExpressionAttributeValues[":prefix"];
      return { Items: Object.entries(items).filter(([key]) => key.startsWith(prefix)).map(([sk, item]) => ({ ...item, sk })) };
    });
    database.on(TransactWriteCommand).callsFake((input) => {
      expect(items.META.status).toBe("SCORING");
      if (input.TransactItems.some((entry: { Put?: { Item: { sk: string } } }) => entry.Put && items[entry.Put.Item.sk])) {
        throw Object.assign(new Error("already scored"), { name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "ConditionalCheckFailed" }] });
      }
      for (const entry of input.TransactItems) {
        if (entry.Put?.Item.sk.startsWith("RESULT#")) {
          expect(input.TransactItems.some((other: { ConditionCheck?: unknown }) => other.ConditionCheck)).toBe(false);
        }
        if (entry.Put) {
          expect(items[entry.Put.Item.sk]).toBeUndefined();
          items[entry.Put.Item.sk] = entry.Put.Item;
        }
        if (entry.Update) {
          const item = items[entry.Update.Key.sk];
          const values = entry.Update.ExpressionAttributeValues;
          if (values[":reveal"]) item.status = values[":reveal"];
          else {
            item.totalPoints = Number(item.totalPoints) + values[":points"];
            item.correctAnswers = Number(item.correctAnswers) + values[":correct"];
            item.correctElapsedMs = Number(item.correctElapsedMs) + values[":elapsed"];
            if (values[":streak"] !== undefined) Object.assign(item, {
              streak: values[":streak"], maxStreak: values[":maxStreak"], lastAnsweredIndex: values[":index"],
            });
          }
        }
      }
      return {};
    });
  });

  it("uses the last change time for points, elapsed time and ranking totals, once per person", async () => {
    await expect(finalizeQuestion(db, "table", request, 1999)).rejects.toThrow("noch nicht abgelaufen");
    expect(database.commandCalls(QueryCommand)).toHaveLength(0);
    await finalizeQuestion(db, "table", request, 2000);
    expect(items["RESULT#q1#p1"]).toMatchObject({ correct: true, points: 625, elapsedMs: 750 });
    expect(items["PARTICIPANT#p1"]).toMatchObject({ totalPoints: 725, correctAnswers: 2, correctElapsedMs: 950 });
    expect(items["RESULT#q1#p2"]).toMatchObject({ correct: false, points: 0, elapsedMs: 900 });
    expect(items["REVEAL#q1"]).toMatchObject({
      distribution: [{ choiceId: "a1", count: 1 }, { choiceId: "a2", count: 1 }],
    });
    expect(items.META).toMatchObject({ status: "REVEAL", answerCount: 2 });
    const writes = database.commandCalls(TransactWriteCommand).length;
    await finalizeQuestion(db, "table", request, 2500);
    expect(database.commandCalls(TransactWriteCommand)).toHaveLength(writes);
    expect(items["PARTICIPANT#p1"].totalPoints).toBe(725);
  });

  it("awards no points when the final choice is wrong, regardless of earlier choices", async () => {
    items["ANSWER#q1#p1"] = { sk: "ANSWER#q1#p1", choiceId: "a2", receivedAt: 1999 };
    await finalizeQuestion(db, "table", request, 2000);
    expect(items["RESULT#q1#p1"]).toMatchObject({ correct: false, points: 0, elapsedMs: 999 });
    expect(items["PARTICIPANT#p1"].totalPoints).toBe(100);
    expect(items["REVEAL#q1"]).toMatchObject({
      distribution: [{ choiceId: "a1", count: 0 }, { choiceId: "a2", count: 2 }],
    });
  });

  it.each([[2, 100], [3, 150], [4, 200], [5, 200]])("scores a series of %i prior correct answers with +%i once", async (prior, extra) => {
    Object.assign(items.META, { gamificationVersion: "STREAK_V1", streakBonusEnabled: true, questionIndex: prior });
    for (let index = 0; index < prior; index++) {
      items[`RESULT#old${index}#p1`] = { correct: true, points: 1000, elapsedMs: 0, questionIndex: index };
    }
    await finalizeQuestion(db, "table", request, 2000);
    expect(items["RESULT#q1#p1"]).toMatchObject({ points: 625 + extra, streakBonusPoints: extra, streak: prior + 1, maxStreak: prior + 1 });
    expect(items["PARTICIPANT#p1"].totalPoints).toBe(725 + extra);
    await finalizeQuestion(db, "table", request, 2500);
    expect(items["PARTICIPANT#p1"].totalPoints).toBe(725 + extra);
  });

  it.each([true, false])("breaks a series after an incorrect or missing prior answer (missing=%s)", async (missing) => {
      Object.assign(items.META, { gamificationVersion: "STREAK_V1", streakBonusEnabled: true, questionIndex: 3 });
      for (let index = 0; index < 2; index++) {
        items[`RESULT#old${index}#p1`] = { correct: true, points: 1000, elapsedMs: 0, questionIndex: index };
      }
      if (!missing) items["RESULT#old2#p1"] = { correct: false, points: 0, elapsedMs: 0, questionIndex: 2 };
      await finalizeQuestion(db, "table", request, 2000);
      expect(items["RESULT#q1#p1"]).toMatchObject({ points: 625, streakBonusPoints: 0, streak: 1, maxStreak: 2 });
    });

  it("tracks streaks without changing points when bonuses are off", async () => {
      Object.assign(items.META, { gamificationVersion: "STREAK_V1", streakBonusEnabled: false, questionIndex: 2 });
      for (let index = 0; index < 2; index++) items[`RESULT#old${index}#p1`] = { correct: true, points: 1000, elapsedMs: 0, questionIndex: index };
      await finalizeQuestion(db, "table", request, 2000);
      expect(items["RESULT#q1#p1"]).toMatchObject({ points: 625, streakBonusPoints: 0, streak: 3 });
    });

  it.each([false, true])("resumes partial scoring without a double bonus and rejects inconsistent saved bonuses (corrupt=%s)", async (corrupt) => {
    Object.assign(items.META, { status: "SCORING", gamificationVersion: "STREAK_V1", streakBonusEnabled: true, questionIndex: 3 });
    for (let index = 0; index < 3; index++) items[`RESULT#old${index}#p1`] = { correct: true, points: 1000, elapsedMs: 0, questionIndex: index };
    items["RESULT#q1#p1"] = { correct: true, points: 775, elapsedMs: 750, questionIndex: 3,
      streak: 4, maxStreak: 4, streakBonusPoints: corrupt ? 999 : 150 };
    Object.assign(items["PARTICIPANT#p1"], { totalPoints: 875, streak: 4, maxStreak: 4, lastAnsweredIndex: 3 });
    const [outcome] = await Promise.allSettled([finalizeQuestion(db, "table", request, 2000)]);
    expect(outcome).toMatchObject(corrupt
      ? { status: "rejected", reason: new Error("Widersprüchliches Frageergebnis.") } : { status: "fulfilled" });
    expect(items.META.status).toBe(corrupt ? "SCORING" : "REVEAL");
    expect(items["PARTICIPANT#p1"].totalPoints).toBe(875);
  });
});
