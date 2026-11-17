import { describe, expect, it } from "vitest";
import { ASYNC_SPEED_V1, asyncSpeedBonus, rankScores, scoreAnswer, scoreAsyncSpeedAnswer } from "./scoring";

describe("Punkte", () => {
  it("vergibt 500 bis 1000 Punkte für richtige Antworten", () => {
    expect(scoreAnswer(true, 1_000, 1_000, 20_000)).toEqual({ points: 1000, elapsedMs: 0 });
    expect(scoreAnswer(true, 11_000, 1_000, 20_000)).toEqual({ points: 750, elapsedMs: 10_000 });
    expect(scoreAnswer(true, 21_000, 1_000, 20_000)).toEqual({ points: 500, elapsedMs: 20_000 });
    expect(scoreAnswer(true, -10, 0, 1000)).toEqual({ points: 1000, elapsedMs: 0 });
    expect(scoreAnswer(true, 5000, 0, 1000)).toEqual({ points: 500, elapsedMs: 1000 });
  });

  it("vergibt keine Punkte für falsche Antworten", () => {
    expect(scoreAnswer(false, 500, 0, 1000).points).toBe(0);
  });

  it("vergibt bei zunehmender Dauer nie mehr Punkte", () => {
    let previous = 1001;
    for (let elapsed = 0; elapsed <= 20_000; elapsed += 17) {
      const { points } = scoreAnswer(true, elapsed, 0, 20_000);
      expect(points).toBeLessThanOrEqual(previous);
      previous = points;
    }
  });

  it("lehnt ungültige Zeiten ab", () => {
    expect(() => scoreAnswer(true, 0, 0, 0)).toThrow();
    expect(() => scoreAnswer(true, NaN, 0, 100)).toThrow();
  });
});

describe("Rangfolge", () => {
  it("sortiert nach Punkten, korrekten Antworten und deren Dauer; Gleichstand teilt den Rang", () => {
    const result = rankScores([
      { participantId: "z", points: 900, correctAnswers: 2, correctElapsedMs: 50 },
      { participantId: "c", points: 1000, correctAnswers: 2, correctElapsedMs: 30 },
      { participantId: "b", points: 1000, correctAnswers: 3, correctElapsedMs: 20 },
      { participantId: "a", points: 1000, correctAnswers: 3, correctElapsedMs: 20 },
      { participantId: "d", points: 1000, correctAnswers: 3, correctElapsedMs: 40 },
    ]);
    expect(result.map(({ participantId, rank }) => [participantId, rank])).toEqual([
      ["a", 1], ["b", 1], ["d", 3], ["c", 4], ["z", 5],
    ]);
  });
});

describe("Async-Wertung ASYNC_SPEED_V1", () => {
  it("vergibt 1000 Grundpunkte plus linear fallenden Tempo-Bonus", () => {
    expect(scoreAsyncSpeedAnswer(true, 10_000, 10_000)).toEqual({ elapsedMs: 0, basePoints: 1000, bonusPoints: 500, points: 1500 });
    expect(scoreAsyncSpeedAnswer(true, 10_000, 25_000)).toEqual({ elapsedMs: 15_000, basePoints: 1000, bonusPoints: 250, points: 1250 });
    expect(scoreAsyncSpeedAnswer(true, 10_000, 40_000)).toEqual({ elapsedMs: 30_000, basePoints: 1000, bonusPoints: 0, points: 1000 });
    expect(scoreAsyncSpeedAnswer(true, 10_000, 70_000)).toEqual({ elapsedMs: 60_000, basePoints: 1000, bonusPoints: 0, points: 1000 });
  });

  it("vergibt für falsche Antworten keine Punkte und keinen Bonus", () => {
    expect(scoreAsyncSpeedAnswer(false, 10_000, 10_000)).toEqual({ elapsedMs: 0, basePoints: 0, bonusPoints: 0, points: 0 });
  });

  it("behandelt Uhrabweichungen ohne negative Antwortzeit und rundet den Bonus", () => {
    expect(scoreAsyncSpeedAnswer(true, 10_000, 9_000).elapsedMs).toBe(0);
    expect(asyncSpeedBonus(1)).toBe(500);
    expect(asyncSpeedBonus(29_999)).toBe(0);
    expect(asyncSpeedBonus(10_000)).toBe(333);
    expect(ASYNC_SPEED_V1).toMatchObject({ basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30_000 });
  });
});
