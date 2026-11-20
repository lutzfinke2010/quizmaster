export const GAMIFICATION_VERSION = "STREAK_V1";
export const STREAK_RULE_TEXT = "Ab 3 richtigen Antworten in Folge: +100 Punkte, bei 4 +150, ab 5 jeweils +200. Falsche oder fehlende Antworten unterbrechen die Serie.";

export const badgeLabels: Record<string, string> = {
  FIRST_CORRECT: "Erstes Aha!",
  STREAK_3: "Dreier-Serie",
  STREAK_5: "Unaufhaltsam",
  PERFECT: "Perfekte Runde",
};

export function streakBonus(streak: number, enabled: boolean): number {
  if (!enabled || streak < 3) return 0;
  return streak === 3 ? 100 : streak === 4 ? 150 : 200;
}

export function earnedBadges(correctAnswers: number, maxStreak: number, perfect = false): string[] {
  return [
    ...(correctAnswers > 0 ? ["FIRST_CORRECT"] : []),
    ...(maxStreak >= 3 ? ["STREAK_3"] : []),
    ...(maxStreak >= 5 ? ["STREAK_5"] : []),
    ...(perfect ? ["PERFECT"] : []),
  ];
}

export function advanceStreak(streak: number, maxStreak: number, correct: boolean) {
  const next = correct ? streak + 1 : 0;
  return { streak: next, maxStreak: Math.max(maxStreak, next) };
}
