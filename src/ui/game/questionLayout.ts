import { useEffect, useRef } from "react";

/** Answers up to this length count as "short" and may be shown in two columns on phones. */
export const SHORT_ANSWER_MAX_LENGTH = 18;

/** Shared column rule for live and async: two columns only for 2 or 4 short answers. */
export function answerColumns(answers: ReadonlyArray<{ text: string }>): 1 | 2 {
  return (answers.length === 2 || answers.length === 4) &&
    answers.every((answer) => answer.text.trim().length <= SHORT_ANSWER_MAX_LENGTH) ? 2 : 1;
}

/**
 * On question change jump to the top and focus the new question heading.
 * Instant jump without animation (so it also respects `prefers-reduced-motion`).
 */
export function useQuestionFocus<T extends HTMLElement = HTMLHeadingElement>(questionKey: string | number | null | undefined) {
  const headingRef = useRef<T>(null);
  const previousRef = useRef(questionKey);
  useEffect(() => {
    const changed = previousRef.current !== questionKey;
    previousRef.current = questionKey;
    if (!changed || questionKey === null || questionKey === undefined) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    headingRef.current?.focus({ preventScroll: true });
  }, [questionKey]);
  return headingRef;
}
