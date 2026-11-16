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
      return { Items: Object.entries(items).filter(([key]) => key.startsWith("ANSWER#q1#")).map(([, item]) => item) };
    });
    database.on(TransactWriteCommand).callsFake((input) => {
      expect(items.META.status).toBe("SCORING");
      for (const entry of input.TransactItems) {
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
});
