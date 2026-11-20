import { BookOpen } from "lucide-react";

/** Unterscheidet Quizkarten optisch, ohne Kategorien oder einen Spielstand vorzugeben. */
export function QuizCover({ questionCount }: { questionCount: number }) {
  return <div className="quiz-cover">
    <span className="cover-icon" aria-hidden="true"><BookOpen size={29} /></span>
    <span className="badge">{questionCount} {questionCount === 1 ? "Frage" : "Fragen"}</span>
  </div>;
}
