import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactGetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { getMyResult } from "./gameState";

const database = mockClient(DynamoDBDocumentClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const meta = { status: "REVEAL", version: 5, title: "Quiz", questionIndex: 1, questionCount: 2,
  participantCount: 1, maxParticipants: 100, expiresAt: 100_000, ttl: 100, joinCode: "123456", currentQuestionId: "q2" };
let items: Record<string, Record<string, unknown>>;

describe("Persönliche freigegebene Gesamtpunkte", () => {
  beforeEach(() => {
    database.reset();
    items = {
      META: { ...meta },
      "IDENTITY#guest": { participantId: "me" },
      "PARTICIPANT#me": { participantId: "me", displayName: "Flinker Fuchs", avatarId: "fox", joinedAt: 1, totalPoints: 1650 },
      "RESULT#q2#me": { correct: true, points: 750, elapsedMs: 10_000 },
    };
    database.on(TransactGetCommand).callsFake((input) => ({
      Responses: input.TransactItems.map((entry: { Get: { Key: { sk: string } } }) => ({
        Item: items[entry.Get.Key.sk] ? { ...items[entry.Get.Key.sk] } : undefined,
      })),
    }));
    database.on(GetCommand).callsFake((input) => ({ Item: items[input.Key.sk] }));
  });

  it("liefert den gespeicherten Gesamtstand, nicht nur die Punkte der aktuellen Frage", async () => {
    expect(await getMyResult(db, "table", "session", "guest", 50_000)).toEqual({
      questionId: "q2", answered: true, correct: true, points: 750, totalPoints: 1650, elapsedMs: 10_000,
    });
    expect(database.commandCalls(GetCommand).every((call) => call.args[0].input.ConsistentRead)).toBe(true);
  });

  it("erhält vorherige Punkte bei fehlender Antwort und erfindet keine Antwortzeit", async () => {
    delete items["RESULT#q2#me"];
    expect(await getMyResult(db, "table", "session", "guest", 50_000)).toEqual({
      questionId: "q2", answered: false, correct: false, points: 0, totalPoints: 1650, elapsedMs: null,
    });
  });

  it.each(["COUNTDOWN", "QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"])("veröffentlicht keine Punkte während %s", async (status) => {
    items.META.status = status;
    await expect(getMyResult(db, "table", "session", "guest", 50_000)).rejects.toThrow("noch nicht freigegeben");
    expect(database.commandCalls(GetCommand)).toHaveLength(0);
  });

  it("lehnt fremde Teilnahmen weiterhin ab", async () => {
    await expect(getMyResult(db, "table", "session", "stranger", 50_000)).rejects.toThrow("Keine gültige Teilnahme");
  });

  it("liefert keinen gemischten Stand, wenn während des Lesens die nächste Frage beginnt", async () => {
    database.on(GetCommand, { Key: { pk: "SESSION#session", sk: "PARTICIPANT#me" } }).callsFake(() => {
      items.META.version = 6;
      items.META.currentQuestionId = "q3";
      return { Item: items["PARTICIPANT#me"] };
    });
    await expect(getMyResult(db, "table", "session", "guest", 50_000)).rejects.toThrow("gleichzeitig geändert");
  });

  it("meldet fehlende Gesamtpunkte statt einen Nullstand vorzutäuschen", async () => {
    delete items["PARTICIPANT#me"].totalPoints;
    await expect(getMyResult(db, "table", "session", "guest", 50_000)).rejects.toThrow();
  });
});
