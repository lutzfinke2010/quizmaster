import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactGetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminGameState, getMyAnswer, getMyResult } from "./gameState";

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
      streak: 0, maxStreak: 0, streakBonusPoints: 0, badges: [],
    });
    expect(database.commandCalls(GetCommand).every((call) => call.args[0].input.ConsistentRead)).toBe(true);
  });

  it("erhält vorherige Punkte bei fehlender Antwort und erfindet keine Antwortzeit", async () => {
    delete items["RESULT#q2#me"];
    expect(await getMyResult(db, "table", "session", "guest", 50_000)).toEqual({
      questionId: "q2", answered: false, correct: false, points: 0, totalPoints: 1650, elapsedMs: null,
      streak: 0, maxStreak: 0, streakBonusPoints: 0, badges: [],
    });
  });

  it("ranks stored totals with bonuses, subtracts the whole award for previous ranks, and preserves ties", async () => {
    Object.assign(items.META, { ownerId: "admin", status: "LEADERBOARD", currentQuestionId: "q3",
      questionIndex: 2, questionCount: 3, participantCount: 3, streakBonusEnabled: true });
    items["QUESTION#q3"] = { text: "Frage", answers: [{ id: "a", text: "Ja" }, { id: "b", text: "Nein" }] };
    items["REVEAL#q3"] = { correctChoiceId: "a", explanation: "", distribution: [{ choiceId: "a", count: 3 }] };
    Object.assign(items["PARTICIPANT#me"], { correctAnswers: 2, correctElapsedMs: 1200 });
    items["RESULT#q3#me"] = { correct: true, points: 775, elapsedMs: 750, streakBonusPoints: 150 };
    for (const participantId of ["b", "c"]) {
      items[`PARTICIPANT#${participantId}`] = { participantId, displayName: participantId, avatarId: "fox",
        totalPoints: 1700, correctAnswers: 3, correctElapsedMs: 1000,
        streak: 3, maxStreak: 3, lastAnsweredIndex: 2 };
      items[`RESULT#q3#${participantId}`] = { correct: true, points: 950, elapsedMs: 100, streakBonusPoints: 100 };
    }
    database.on(QueryCommand).callsFake((input) => ({
      Items: Object.entries(items).filter(([sk]) => sk.startsWith(input.ExpressionAttributeValues[":prefix"]))
        .map(([sk, item]) => ({ sk, ...item })),
    }));
    const state = await getAdminGameState(db, "table", "session", { subject: "admin", groups: ["Quizmasters"] }, 50_000);
    expect(state.leaderboard.map((player) => [player.participantId, player.rank, player.previousRank, player.previousPoints]))
      .toEqual([["b", 1, 2, 750], ["c", 1, 2, 750], ["me", 3, 1, 875]]);
    expect(state.leaderboard[0]).toMatchObject({ rankChange: 1, badges: ["FIRST_CORRECT", "STREAK_3"] });
  });

  it("returns stored bonus, badges and a broken streak for an unanswered question", async () => {
    Object.assign(items["PARTICIPANT#me"], { correctAnswers: 3, streak: 3, maxStreak: 3, lastAnsweredIndex: 1 });
    items["RESULT#q2#me"].streakBonusPoints = 100;
    expect(await getMyResult(db, "table", "session", "guest", 50_000)).toMatchObject({
      streak: 3, maxStreak: 3, streakBonusPoints: 100, badges: ["FIRST_CORRECT", "STREAK_3"],
    });
    items.META.questionIndex = 2;
    items.META.currentQuestionId = "q3";
    expect(await getMyResult(db, "table", "session", "guest", 50_000)).toMatchObject({
      answered: false, streak: 0, maxStreak: 3, streakBonusPoints: 0, badges: ["FIRST_CORRECT", "STREAK_3"],
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

  it("liest bei einem Antwortwechsel während der Abfrage den neuen Stand", async () => {
    items.META.status = "QUESTION_OPEN";
    items["ANSWER#q2#me"] = { choiceId: "a1" };
    let reads = 0;
    database.on(GetCommand, { Key: { pk: "SESSION#session", sk: "ANSWER#q2#me" } }).callsFake(() => {
      const previous = { ...items["ANSWER#q2#me"] };
      if (reads++ === 0) {
        items["ANSWER#q2#me"] = { choiceId: "a2" };
        items.META.version = 6;
      }
      return { Item: previous };
    });
    expect(await getMyAnswer(db, "table", "session", "guest", 50_000))
      .toEqual({ questionId: "q2", choiceId: "a2" });
    expect(reads).toBe(2);
  });

  it("holt nach einem gleichzeitigen Phasen- und Fragenwechsel einen neuen Antwort-Snapshot", async () => {
    items["ANSWER#q2#me"] = { choiceId: "a1" };
    items["ANSWER#q3#me"] = { choiceId: "a2" };
    database.on(GetCommand, { Key: { pk: "SESSION#session", sk: "ANSWER#q2#me" } }).callsFake(() => {
      items.META = { ...items.META, version: 6, status: "QUESTION_OPEN", currentQuestionId: "q3" };
      return { Item: items["ANSWER#q2#me"] };
    });
    expect(await getMyAnswer(db, "table", "session", "guest", 50_000))
      .toEqual({ questionId: "q3", choiceId: "a2" });
  });

  it("begrenzt Wiederholungen bei ständig verändertem Antwort-Snapshot", async () => {
    database.on(GetCommand).callsFake(() => {
      items.META.version = Number(items.META.version) + 1;
      return { Item: { choiceId: "a1" } };
    });
    await expect(getMyAnswer(db, "table", "session", "guest", 50_000)).rejects.toThrow("gleichzeitig geändert");
    expect(database.commandCalls(GetCommand)).toHaveLength(4);
  });

  it("unterscheidet keine Antwort von fehlender Teilnahme", async () => {
    expect(await getMyAnswer(db, "table", "session", "guest", 50_000))
      .toEqual({ questionId: "q2", choiceId: null });
    await expect(getMyAnswer(db, "table", "session", "stranger", 50_000)).rejects.toThrow("Keine gültige Teilnahme");
  });
});
