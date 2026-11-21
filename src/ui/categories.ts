import { categoryOf, type QuizCategory } from "../domain/categories";

export type CategoryTone = "yellow" | "blue" | "pink" | "green" | "peach";

const TONES: Record<QuizCategory, CategoryTone> = {
  allgemeinwissen: "yellow",
  geografie: "blue",
  wissenschaft: "pink",
  "tiere-natur": "green",
  "team-freunde": "peach",
};

/** CSS class (`rl-tone-*` from quizzes.css) for a category id; unknown ids use the default category. */
export function categoryToneClass(category: string | null | undefined) {
  return `rl-tone-${TONES[categoryOf(category)]}`;
}
