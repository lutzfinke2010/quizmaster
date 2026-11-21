import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { cloud, type MyResult, type Participation } from "../../cloud";
import { useLiveState } from "../../hooks/useLiveState";
import { message } from "../common/message";
import { resultStatuses, type PersonalStanding } from "./phaseLabels";

type Choice = { questionId: string; choiceId: string };

/**
 * Personal live session: own participation, the stored answer of the current question, sending/changing an
 * answer and the personal result. The server stays the source of truth – after every send or failed confirmation
 * the stored answer is restored from the backend before another change is possible.
 */
export function usePlayerSession(sessionId: string) {
  const [participant, setParticipant] = useState<Participation | null>(null);
  const [error, setError] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [selection, setSelection] = useState<Choice | null>(null);
  const [pending, setPending] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringAnswer, setRestoringAnswer] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoredQuestion, setRestoredQuestion] = useState<string | null>(null);
  const [result, setResult] = useState<MyResult | null>(null);
  const [resultError, setResultError] = useState("");
  const [standing, setStanding] = useState<PersonalStanding | null>(null);
  const [deleted, setDeleted] = useState(false);
  const sendingRef = useRef(false);
  const answerRequestRef = useRef(0);
  const unconfirmedRef = useRef<Choice | null>(null);
  const participationRequestRef = useRef("");
  const live = useLiveState(sessionId, "guest");
  const { state, offset, error: liveError, refresh, recoveryVersion } = live;
  const questionId = state?.questionId ?? null;
  const status = state?.status ?? "";
  const currentQuestionRef = useRef(questionId);

  // A new question starts without selection, pending answer or answer error.
  const [trackedQuestion, setTrackedQuestion] = useState(questionId);
  if (trackedQuestion !== questionId) {
    setTrackedQuestion(questionId);
    setSelection(null); setPending(null); setBusy(false); setAnswerError(""); setRestoredQuestion(null);
  }
  useLayoutEffect(() => {
    currentQuestionRef.current = questionId;
    answerRequestRef.current++;
    sendingRef.current = false;
    unconfirmedRef.current = null;
  }, [questionId]);
  useEffect(() => () => { answerRequestRef.current++; }, []);

  const participationRequest = `${sessionId}:${recoveryVersion}:${restoreAttempt}`;
  useEffect(() => {
    participationRequestRef.current = participationRequest;
    const isCurrent = () => participationRequestRef.current === participationRequest;
    cloud.myParticipation(sessionId).then((value) => { if (isCurrent()) { setParticipant(value); setError(""); } },
      (caught) => { if (isCurrent()) setError(message(caught)); });
    return () => { participationRequestRef.current = ""; };
  }, [sessionId, participationRequest]);

  // Keep the last known own entry so the header can show "Zuletzt Platz N" during the next question.
  const ownPlayer = state?.leaderboard.find((item) => item.participantId === participant?.participantId);
  if (state && ownPlayer && (standing?.player !== ownPlayer || standing.questionIndex !== state.questionIndex)) {
    setStanding({ questionIndex: state.questionIndex, player: ownPlayer });
  }

  // Restore the stored answer whenever question, phase, connection or attempt change (and no answer is sending).
  const restoreKey = questionId && !["LOBBY", "CANCELLED"].includes(status)
    ? `${questionId}|${status}|${restoreAttempt}|${recoveryVersion}` : null;
  const restoreTrigger = restoreKey === null ? null : `${restoreKey}|${busy}`;
  const [trackedRestore, setTrackedRestore] = useState<string | null>(null);
  if (trackedRestore !== restoreTrigger) {
    setTrackedRestore(restoreTrigger);
    if (restoreKey === null) { setRestoringAnswer(false); setRestoreError(""); }
    else if (!busy) { setRestoringAnswer(true); setRestoreError(""); }
  }
  const onQuestionChanged = useEffectEvent(() => refresh());
  useEffect(() => {
    if (restoreKey === null || !questionId || busy) return;
    let active = true;
    const request = answerRequestRef.current;
    const isCurrent = () => active && request === answerRequestRef.current && currentQuestionRef.current === questionId;
    cloud.myAnswer(sessionId).then((value) => {
      if (!isCurrent()) return;
      if (value.questionId === questionId) {
        setSelection(value.choiceId ? { questionId, choiceId: value.choiceId } : null);
        setRestoredQuestion(questionId);
        if (!unconfirmedRef.current || (unconfirmedRef.current.questionId === questionId &&
            unconfirmedRef.current.choiceId === value.choiceId)) {
          unconfirmedRef.current = null;
          setAnswerError("");
        }
      } else {
        setRestoreError("Die Frage wurde inzwischen geändert. Bitte den Spielstand erneut prüfen.");
        onQuestionChanged();
      }
    }, (caught) => { if (isCurrent()) setRestoreError(message(caught)); })
      .finally(() => { if (isCurrent()) setRestoringAnswer(false); });
    return () => { active = false; };
  }, [sessionId, questionId, restoreKey, busy]);

  // Personal result of the current question – only after the quizmaster revealed it.
  const resultKey = questionId && resultStatuses.includes(status)
    ? `${questionId}|${status}|${restoreAttempt}|${recoveryVersion}` : null;
  const [trackedResultActive, setTrackedResultActive] = useState(resultKey !== null);
  if (trackedResultActive !== (resultKey !== null)) {
    setTrackedResultActive(resultKey !== null);
    if (resultKey === null) setResultError("");
  }
  useEffect(() => {
    if (resultKey === null) return;
    let active = true;
    cloud.result(sessionId).then((value) => {
      if (active && value.questionId === questionId) { setResult(value); setResultError(""); }
    }, (caught) => { if (active) setResultError(message(caught)); });
    return () => { active = false; };
  }, [sessionId, questionId, resultKey]);

  async function answer(choiceId: string) {
    if (!state?.questionId || state.status !== "QUESTION_OPEN" || sendingRef.current || restoringAnswer ||
        restoreError || restoredQuestion !== state.questionId || state.closesAt == null ||
        Date.now() + offset >= state.closesAt ||
        (selection?.questionId === state.questionId && selection.choiceId === choiceId)) return;
    const answeredQuestion = state.questionId;
    const request = ++answerRequestRef.current;
    const isCurrent = () => request === answerRequestRef.current && currentQuestionRef.current === answeredQuestion;
    sendingRef.current = true;
    unconfirmedRef.current = null;
    setBusy(true); setAnswerError(""); setPending({ questionId: answeredQuestion, choiceId });
    try {
      await cloud.answer(sessionId, answeredQuestion, choiceId);
      if (isCurrent()) { setSelection({ questionId: answeredQuestion, choiceId }); refresh(); }
    } catch (caught) {
      if (!isCurrent()) return;
      unconfirmedRef.current = { questionId: answeredQuestion, choiceId };
      setAnswerError(`Antwort nicht bestätigt: ${message(caught)} Deine gespeicherte Antwort wird erneut geprüft. ` +
        "Solange die Frage offen ist, kannst du danach erneut antworten.");
      setRestoredQuestion(null); setRestoreAttempt((attempt) => attempt + 1); refresh();
    } finally {
      if (isCurrent()) { sendingRef.current = false; setBusy(false); setPending(null); }
    }
  }

  return {
    state, offset, participant, standing, deleted,
    markDeleted: () => setDeleted(true),
    error: liveError || restoreError || resultError || error || answerError,
    retry: restoreError || resultError || error || liveError ? {
      label: restoreError ? "Gespeicherte Antwort erneut prüfen" : "Spielstand erneut prüfen",
      run: () => { setError(""); setRestoreAttempt((attempt) => attempt + 1); refresh(); },
    } : null,
    selected: selection && selection.questionId === questionId ? selection.choiceId : null,
    pendingChoice: pending?.questionId === questionId ? pending.choiceId : null,
    answerBusy: busy || restoringAnswer || Boolean(restoreError) || restoredQuestion !== questionId,
    answerRestoreFailed: Boolean(restoreError),
    result: result?.questionId === questionId && resultStatuses.includes(status) ? result : null,
    answer: (choiceId: string) => void answer(choiceId),
  };
}
