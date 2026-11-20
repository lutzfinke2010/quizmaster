import { describe, expect, it } from "vitest";
import { defaultGenerationRequest, generatedQuizJsonSchema, generationRequestSchema, normalizeGeneratedQuiz } from "./quizGeneration";

const request = { ...defaultGenerationRequest(), title: "Weltraum", topic: "Planeten", questionCount: 2, answerCount: 3, durationSeconds: 30 };
const question = (text: string, correctIndex = 0) => ({ text, answers: ["Mars", "Venus", "Jupiter"], correctIndex, explanation: "Weil." });

describe("KI-Quizgenerierung: Eingaben", () => {
  it("akzeptiert die Standardwerte mit Titel und Thema", () => {
    expect(generationRequestSchema.parse(request)).toEqual(request);
  });

  it("begrenzt Fragen- und Antwortanzahl", () => {
    expect(generationRequestSchema.safeParse({ ...request, questionCount: 51 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...request, answerCount: 1 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...request, answerCount: 9 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...request, extra: true }).success).toBe(false);
  });

  it("fordert im JSON-Schema genau die gewünschte Antwortanzahl an", () => {
    const answers = generatedQuizJsonSchema(5).properties.questions.items.properties.answers;
    expect(answers).toMatchObject({ minItems: 5, maxItems: 5 });
  });
});

describe("KI-Quizgenerierung: Normalisierung", () => {
  it("übernimmt Titel und Antwortzeit aus der Anfrage und markiert genau eine richtige Antwort", () => {
    const quiz = normalizeGeneratedQuiz({ description: "Ein Quiz", questions: [question("A?", 2), question("B?")] }, request, () => 0);
    expect(quiz.title).toBe("Weltraum");
    expect(quiz.questions).toHaveLength(2);
    for (const item of quiz.questions) {
      expect(item.durationSeconds).toBe(30);
      expect(item.answers).toHaveLength(3);
      expect(item.answers.filter((answer) => answer.correct)).toHaveLength(1);
    }
    expect(quiz.questions[0].answers.find((answer) => answer.correct)?.text).toBe("Jupiter");
  });

  it("verwirft unbrauchbare Fragen und kürzt auf die gewünschte Anzahl", () => {
    const quiz = normalizeGeneratedQuiz({ description: "", questions: [
      question("Ungültiger Index", 7),
      { ...question("Doppelte Antworten"), answers: ["Mars", "mars", "Venus"] },
      question("Gut 1"), question("Gut 2"), question("Gut 3"),
    ] }, request);
    expect(quiz.questions.map((item) => item.text)).toEqual(["Gut 1", "Gut 2"]);
  });

  it("entfernt Erklärungen, wenn keine gewünscht sind", () => {
    const quiz = normalizeGeneratedQuiz({ description: "", questions: [question("A?")] }, { ...request, includeExplanations: false });
    expect(quiz.questions[0].explanation).toBe("");
  });

  it("meldet einen verständlichen Fehler, wenn keine Frage verwendbar ist", () => {
    expect(() => normalizeGeneratedQuiz({ description: "", questions: [question("", 0)] }, request))
      .toThrow("keine verwendbaren Fragen");
  });
});
