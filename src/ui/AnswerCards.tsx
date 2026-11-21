import { Check, LoaderCircle, X } from "lucide-react";
import { answerColumns } from "./game/questionLayout";
import "./quizPlay.css";

export type AnswerOption = { id: string; text: string };

type CardStatus = "idle" | "selected" | "pending" | "correct" | "wrong" | "muted";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function cardStatus(id: string, selectedId?: string | null, pendingId?: string | null, correctId?: string | null): CardStatus {
  if (correctId) return id === correctId ? "correct" : id === selectedId ? "wrong" : "muted";
  if (pendingId) return id === pendingId ? "pending" : "idle";
  return id === selectedId ? "selected" : "idle";
}

const HIDDEN_TEXT: Partial<Record<CardStatus, string>> = {
  correct: "richtige Antwort",
  wrong: "deine Antwort, leider falsch",
};

/**
 * Large, playful answer cards – purely presentational and shared by live, async and presentation.
 * Without `onSelect` the cards are not interactive (shared screen). While not `locked` an answer can be changed.
 * As soon as `correctId` is set the reveal is shown: correct green, own wrong answer red, others muted.
 */
export function AnswerCards({ answers, selectedId, pendingId, correctId, locked = false, onSelect, columns, label = "Antwortmöglichkeiten" }: {
  answers: ReadonlyArray<AnswerOption>;
  selectedId?: string | null;
  pendingId?: string | null;
  correctId?: string | null;
  locked?: boolean;
  onSelect?: (answerId: string) => void;
  columns?: 1 | 2;
  label?: string;
}) {
  const cols = columns ?? answerColumns(answers);
  const interactive = Boolean(onSelect) && !correctId;
  return <ul className={`rl-answers${cols === 2 ? " is-cols-2" : ""}`} aria-label={label}>
    {answers.map((answer, index) => {
      const status = cardStatus(answer.id, selectedId, pendingId, correctId);
      const wasMine = answer.id === selectedId && Boolean(correctId);
      const content = <>
        <span className="rl-answer-letter" aria-hidden="true">{LETTERS[index] ?? index + 1}</span>
        <span className="rl-answer-body">
          <span className="rl-answer-text">{answer.text}</span>
          {status === "selected" && <span className="rl-answer-state"><Check aria-hidden="true" strokeWidth={3} />Deine Antwort · abgegeben</span>}
          {status === "pending" && <span className="rl-answer-state"><LoaderCircle className="rl-spin" aria-hidden="true" strokeWidth={3} />Wird gesendet …</span>}
          {wasMine && status === "correct" && <span className="rl-answer-state">Deine Antwort</span>}
        </span>
        {HIDDEN_TEXT[status] && <span className="rl-visually-hidden">({HIDDEN_TEXT[status]})</span>}
        {status === "correct" && <span className="rl-answer-mark is-correct" aria-hidden="true"><Check strokeWidth={4} /></span>}
        {status === "wrong" && <span className="rl-answer-mark is-wrong" aria-hidden="true"><X strokeWidth={4} /></span>}
      </>;
      const className = `rl-answer rl-answer-${index % 4} is-${status}${locked && !correctId ? " is-locked" : ""}`;
      return <li key={answer.id}>
        {interactive
          ? <button type="button" className={className} aria-disabled={locked}
            aria-pressed={pendingId ? status === "pending" : status === "selected"}
            onClick={() => { if (!locked) onSelect?.(answer.id); }}>{content}</button>
          : <div className={className}>{content}</div>}
      </li>;
    })}
  </ul>;
}
