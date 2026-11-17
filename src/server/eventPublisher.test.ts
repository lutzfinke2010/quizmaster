import { describe, expect, it } from "vitest";
import type { DynamoDBStreamEvent } from "aws-lambda";
import { collectGameEvents } from "../../amplify/functions/events/publisher";

function meta(sessionId: string, version: number, answerCount: number, extra: Record<string, unknown> = {}) {
  return {
    eventName: "MODIFY",
    dynamodb: { NewImage: {
      pk: { S: `SESSION#${sessionId}` }, sk: { S: "META" }, version: { N: String(version) },
      expiresAt: { N: "9999999999999" }, status: { S: "QUESTION_OPEN" },
      participantCount: { N: "50" }, answerCount: { N: String(answerCount) }, ...extra,
    } },
  };
}

describe("collectGameEvents", () => {
  it("verdichtet viele Antworten einer Sitzung auf ein Event mit aktuellen Zählern", () => {
    const records = [meta("a", 3, 1), meta("a", 3, 2), meta("b", 7, 1), meta("a", 3, 3),
      { eventName: "INSERT", dynamodb: { NewImage: { pk: { S: "SESSION#a" }, sk: { S: "ANSWER#q#p" } } } }];
    const events = collectGameEvents({ Records: records } as unknown as DynamoDBStreamEvent, 1000);
    expect(events).toEqual([
      { sessionId: "a", version: 3, participantCount: 50, answerCount: 3 },
      { sessionId: "b", version: 7, participantCount: 50, answerCount: 1 },
    ]);
  });

  it("überspringt abgelaufene und unfertige Sitzungen", () => {
    const records = [meta("a", 1, 0, { status: { S: "PREPARING" } }), meta("b", 1, 0, { expiresAt: { N: "10" } })];
    expect(collectGameEvents({ Records: records } as unknown as DynamoDBStreamEvent, 1000)).toEqual([]);
  });
});
