import { useEffect, useRef, useState } from "react";
import { asyncSpeedBonus, type AsyncScoringRule } from "../domain/scoring";
import { GameIcon } from "./GameAssets";

/** Antworten bis zu dieser Länge gelten als „kurz“ und dürfen zweispaltig stehen. */
export const SHORT_ANSWER_MAX_LENGTH = 18;

export function QuestionPosition({ index, total }: { index: number; total: number }) {
  return <span className="question-meta-progress">Frage {index + 1}/{total}
    <progress aria-hidden="true" value={index + 1} max={total} />
  </span>;
}

/** Gemeinsame Spaltenregel für Live und Async: zwei Spalten nur bei 2 oder 4 kurzen Antworten. */
export function answerColumns(answers: ReadonlyArray<{ text: string }>): 1 | 2 {
  return (answers.length === 2 || answers.length === 4) &&
    answers.every((answer) => answer.text.trim().length <= SHORT_ANSWER_MAX_LENGTH) ? 2 : 1;
}

/**
 * Bei Fragewechsel an den Seitenanfang springen und den Fokus auf die neue Fragenüberschrift setzen.
 * Sofortiger Sprung ohne Animation (respektiert damit auch `prefers-reduced-motion`).
 */
export function useQuestionFocus<T extends HTMLElement = HTMLHeadingElement>(questionKey: string | number | null | undefined) {
  const ref = useRef<T>(null);
  const previous = useRef(questionKey);
  useEffect(() => {
    const changed = previous.current !== questionKey;
    previous.current = questionKey;
    if (!changed || questionKey === null || questionKey === undefined) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    ref.current?.focus({ preventScroll: true });
  }, [questionKey]);
  return ref;
}

const points = (value: number) => value.toLocaleString("de-DE");

/**
 * Rein informative Tempo-Bonus-Anzeige. Maßgeblich sind ausschließlich die serverseitig gespeicherten Zeitpunkte.
 * Wird nicht laufend vorgelesen (aria-live=off); die Bonusberechnung kommt vom Backend.
 */
export function SpeedBonus({ startedAt, offset, rule }: { startedAt: number; offset: number; rule: AsyncScoringRule }) {
  const [now, setNow] = useState(() => Date.now());
  const elapsed = Math.max(0, now + offset - startedAt);
  const active = elapsed < rule.bonusWindowMs;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);
  if (!active) {
    return <span className="speed-bonus is-over" aria-live="off">
      Kein Tempo-Bonus mehr · richtige Antwort weiterhin {points(rule.basePoints)} Punkte
    </span>;
  }
  const bonus = asyncSpeedBonus(elapsed, rule);
  const seconds = Math.ceil((rule.bonusWindowMs - elapsed) / 1000);
  return <span className="speed-bonus" aria-live="off" title={`Tempo-Bonus noch ${seconds} Sekunden`}>
    <GameIcon name="speed" size={15} />
    <span>Tempo-Bonus <strong>+{points(bonus)}</strong></span>
    <span className="speed-bonus-track" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, bonus / Math.max(1, rule.maxBonusPoints) * 100))}%` }} />
    </span>
    <span className="sr-only">, noch {seconds} Sekunden</span>
  </span>;
}
