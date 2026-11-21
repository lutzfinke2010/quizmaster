import { z } from "zod";
import { QUIZ_CATEGORIES } from "./categories";

const requiredText = (max: number) =>
  z.string().trim().min(1, "Bitte ausfüllen.").max(max, `Höchstens ${max} Zeichen.`);

export const answerSchema = z.object({
  text: requiredText(200),
  correct: z.boolean(),
});

export const questionSchema = z.object({
  text: requiredText(500),
  answers: z.array(answerSchema).min(2, "Mindestens zwei Antworten sind erforderlich.")
    .max(8, "Höchstens acht Antworten sind erlaubt.")
    .refine((answers) => answers.filter((answer) => answer.correct).length === 1, {
      message: "Bitte genau eine richtige Antwort auswählen.",
    }),
  durationSeconds: z.number().int().min(5, "Mindestens 5 Sekunden.")
    .max(120, "Höchstens 120 Sekunden."),
  explanation: z.string().trim().max(1000, "Höchstens 1000 Zeichen."),
});

export const quizSchema = z.object({
  title: requiredText(120),
  description: z.string().trim().max(500, "Höchstens 500 Zeichen."),
  /** Optional for backwards compatibility: quizzes saved earlier have no category. */
  category: z.enum(QUIZ_CATEGORIES, "Bitte eine Kategorie auswählen.").optional(),
  questions: z.array(questionSchema).min(1, "Mindestens eine Frage ist erforderlich.")
    .max(100, "Höchstens 100 Fragen sind erlaubt."),
});

export type Quiz = z.infer<typeof quizSchema>;
export type Question = Quiz["questions"][number];

export function newQuestion(): Question {
  return {
    text: "",
    answers: [{ text: "", correct: false }, { text: "", correct: false }],
    durationSeconds: 20,
    explanation: "",
  };
}

export function createSnapshot(quiz: Quiz): Quiz {
  return structuredClone(quizSchema.parse(quiz));
}
