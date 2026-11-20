import { z } from "zod";
import { quizSchema, type Quiz } from "./quiz";

export const GENERATION_DIFFICULTIES = ["leicht", "mittel", "schwer", "gemischt"] as const;
export const GENERATION_TONES = ["sachlich", "locker", "humorvoll"] as const;
export const GENERATION_MAX_QUESTIONS = 50;

export const generationRequestSchema = z.object({
  title: z.string().trim().min(1, "Bitte ausfüllen.").max(120, "Höchstens 120 Zeichen."),
  topic: z.string().trim().min(3, "Bitte ein Thema mit mindestens 3 Zeichen angeben.").max(300, "Höchstens 300 Zeichen."),
  questionCount: z.number({ error: "Bitte eine Zahl angeben." }).int("Bitte eine ganze Zahl angeben.")
    .min(1, "Mindestens eine Frage.").max(GENERATION_MAX_QUESTIONS, `Höchstens ${GENERATION_MAX_QUESTIONS} Fragen.`),
  answerCount: z.number({ error: "Bitte eine Zahl angeben." }).int("Bitte eine ganze Zahl angeben.")
    .min(2, "Mindestens zwei Antworten.").max(8, "Höchstens acht Antworten."),
  difficulty: z.enum(GENERATION_DIFFICULTIES),
  audience: z.string().trim().max(120, "Höchstens 120 Zeichen."),
  language: z.string().trim().min(2, "Bitte eine Sprache angeben.").max(40, "Höchstens 40 Zeichen."),
  durationSeconds: z.number({ error: "Bitte eine Zahl angeben." }).int("Bitte eine ganze Zahl angeben.")
    .min(5, "Mindestens 5 Sekunden.").max(120, "Höchstens 120 Sekunden."),
  includeExplanations: z.boolean(),
  tone: z.enum(GENERATION_TONES),
  notes: z.string().trim().max(4000, "Höchstens 4000 Zeichen."),
}).strict();

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export function defaultGenerationRequest(): GenerationRequest {
  return {
    title: "", topic: "", questionCount: 10, answerCount: 4, difficulty: "mittel", audience: "", language: "Deutsch",
    durationSeconds: 20, includeExplanations: true, tone: "locker", notes: "",
  };
}

/** JSON-Schema für OpenAI Structured Outputs (strict). Längen werden zusätzlich serverseitig erzwungen. */
export function generatedQuizJsonSchema(answerCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["description", "questions"],
    properties: {
      description: { type: "string", description: "Kurze Beschreibung des Quiz, höchstens 300 Zeichen." },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "answers", "correctIndex", "explanation"],
          properties: {
            text: { type: "string", description: "Fragetext, höchstens 400 Zeichen." },
            answers: {
              type: "array", minItems: answerCount, maxItems: answerCount,
              description: `Genau ${answerCount} unterschiedliche Antwortmöglichkeiten, je höchstens 150 Zeichen.`,
              items: { type: "string" },
            },
            correctIndex: { type: "integer", description: "Nullbasierter Index der einzigen richtigen Antwort." },
            explanation: { type: "string", description: "Kurze Erklärung der richtigen Lösung oder leerer Text." },
          },
        },
      },
    },
  } as const;
}

const generatedQuizSchema = z.object({
  description: z.string(),
  questions: z.array(z.object({
    text: z.string(),
    answers: z.array(z.string()),
    correctIndex: z.number().int(),
    explanation: z.string(),
  })),
});

const clip = (value: string, max: number) => value.trim().slice(0, max).trim();

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * Wandelt die KI-Antwort in ein gültiges Quiz um: Titel und Antwortzeit kommen aus der Anfrage, unbrauchbare Fragen
 * (leer, falscher Lösungsindex, doppelte Antworten) werden verworfen und Antworten gemischt, da Sprachmodelle die
 * richtige Lösung häufig an dieselbe Position setzen.
 */
export function normalizeGeneratedQuiz(raw: unknown, request: GenerationRequest, random: () => number = Math.random): Quiz {
  const generated = generatedQuizSchema.parse(raw);
  const questions = generated.questions.flatMap((question) => {
    const text = clip(question.text, 500);
    const answers = question.answers.slice(0, request.answerCount).map((answer) => clip(answer, 200));
    const unique = new Set(answers.map((answer) => answer.toLocaleLowerCase()));
    if (!text || answers.length < 2 || answers.some((answer) => !answer) || unique.size !== answers.length ||
        question.correctIndex < 0 || question.correctIndex >= answers.length) return [];
    return [{
      text,
      answers: shuffle(answers.map((answer, index) => ({ text: answer, correct: index === question.correctIndex })), random),
      durationSeconds: request.durationSeconds,
      explanation: request.includeExplanations ? clip(question.explanation, 1000) : "",
    }];
  }).slice(0, request.questionCount);
  if (questions.length === 0) throw new Error("Die KI hat keine verwendbaren Fragen geliefert. Bitte versuche es erneut.");
  return quizSchema.parse({ title: request.title, description: clip(generated.description, 500), questions });
}
