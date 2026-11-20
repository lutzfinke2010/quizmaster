import { describe, expect, it } from "vitest";
import { advanceStreak, earnedBadges, streakBonus } from "./gamification";

describe("gamification", () => {
  it("awards the exact optional bonus ladder", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => streakBonus(n, true))).toEqual([0, 0, 0, 100, 150, 200, 200]);
    expect([1, 3, 4, 5, 100].map((n) => streakBonus(n, false))).toEqual([0, 0, 0, 0, 0]);
  });
  it("breaks the current streak but keeps the best streak", () => {
    expect(advanceStreak(4, 4, true)).toEqual({ streak: 5, maxStreak: 5 });
    expect(advanceStreak(4, 5, false)).toEqual({ streak: 0, maxStreak: 5 });
  });
  it("only earns reached milestones and an explicitly completed perfect round", () => {
    expect(earnedBadges(0, 0)).toEqual([]);
    expect(earnedBadges(3, 3)).toEqual(["FIRST_CORRECT", "STREAK_3"]);
    expect(earnedBadges(5, 5, true)).toEqual(["FIRST_CORRECT", "STREAK_3", "STREAK_5", "PERFECT"]);
    expect(earnedBadges(2, 2, true)).toEqual(["FIRST_CORRECT", "PERFECT"]);
  });
});
