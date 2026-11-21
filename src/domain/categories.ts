/** Quiz categories. The id is stored in the backend; label and tone are presentation only. */
export const QUIZ_CATEGORIES = ["allgemeinwissen", "geografie", "wissenschaft", "tiere-natur", "team-freunde"] as const;

export type QuizCategory = typeof QUIZ_CATEGORIES[number];

export const DEFAULT_CATEGORY: QuizCategory = "allgemeinwissen";

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  allgemeinwissen: "Allgemeinwissen",
  geografie: "Geografie",
  wissenschaft: "Wissenschaft",
  "tiere-natur": "Tiere & Natur",
  "team-freunde": "Team & Freunde",
};

export function isQuizCategory(value: unknown): value is QuizCategory {
  return typeof value === "string" && (QUIZ_CATEGORIES as readonly string[]).includes(value);
}

/** Quizzes saved before categories existed have none; they are shown as general knowledge. */
export function categoryOf(value: unknown): QuizCategory {
  return isQuizCategory(value) ? value : DEFAULT_CATEGORY;
}
