import { describe, expect, it } from "vitest";
import { exampleQuiz } from "./exampleQuiz";
import { createSnapshot, newQuestion, quizSchema } from "./quiz";

describe("Quizvalidierung", () => {
  it("validiert das Beispielquiz mit zehn Fragen", () => {
    expect(quizSchema.parse(exampleQuiz).questions).toHaveLength(10);
  });

  it("nimmt einen unabhängigen, bereinigten Snapshot", () => {
    const source = structuredClone(exampleQuiz);
    source.title = "  Mein Quiz  ";
    const snapshot = createSnapshot(source);
    source.questions[0].answers[0].text = "Geändert";
    expect(snapshot.title).toBe("Mein Quiz");
    expect(snapshot.questions[0].answers[0].text).toBe("Pferd");
  });

  it("lehnt leere Texte und eine fehlende Lösung ab", () => {
    const quiz = { title: " ", description: "", questions: [newQuestion()] };
    expect(quizSchema.safeParse(quiz).success).toBe(false);
  });

  it("fordert genau eine richtige Antwort", () => {
    const quiz = structuredClone(exampleQuiz);
    quiz.questions[0].answers[1].correct = true;
    expect(quizSchema.safeParse(quiz).success).toBe(false);
    quiz.questions[0].answers.forEach((answer) => { answer.correct = false; });
    expect(quizSchema.safeParse(quiz).success).toBe(false);
  });

  it("begrenzt Fragen, Antworten und Antwortzeit", () => {
    const quiz = structuredClone(exampleQuiz);
    quiz.questions = [];
    expect(quizSchema.safeParse(quiz).success).toBe(false);
    quiz.questions = Array.from({ length: 101 }, () => structuredClone(exampleQuiz.questions[0]));
    expect(quizSchema.safeParse(quiz).success).toBe(false);
    quiz.questions = [structuredClone(exampleQuiz.questions[0])];
    quiz.questions[0].answers = [quiz.questions[0].answers[0]];
    expect(quizSchema.safeParse(quiz).success).toBe(false);
    quiz.questions[0].answers = Array.from({ length: 9 }, (_, i) => ({ text: `${i}`, correct: i === 0 }));
    expect(quizSchema.safeParse(quiz).success).toBe(false);
    quiz.questions[0].answers = structuredClone(exampleQuiz.questions[0].answers);
    for (const duration of [4, 121, 5.5]) {
      quiz.questions[0].durationSeconds = duration;
      expect(quizSchema.safeParse(quiz).success).toBe(false);
    }
    for (const duration of [5, 120]) {
      quiz.questions[0].durationSeconds = duration;
      expect(quizSchema.safeParse(quiz).success).toBe(true);
    }
  });
});
