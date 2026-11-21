import { useState } from "react";
import type { GameState, MyResult, Participation } from "../../cloud";
import { Avatar } from "../game/Avatar";
import { useQuestionFocus } from "../game/questionLayout";
import { LiveCancelled, LiveCountdown } from "./LiveCountdown";
import { LiveLobby } from "./LiveLobby";
import { PersonalQuestion, SharedQuestion } from "./LiveQuestion";
import { LiveRanking } from "./LiveRanking";
import { LiveReveal } from "./LiveReveal";
import { activeStatuses, resultStatuses, standingInfo, type PersonalStanding } from "./phaseLabels";
import { useTimeRemaining } from "./useTimeRemaining";
import "./live.css";

/**
 * One live phase in three variants: `personal` (phone of a participant), `presentation` (shared screen)
 * and `preview` (quizmaster console – like the shared screen, but without join details).
 */
export function LiveGameView({ state, offset, variant, participant, onAnswer, answerBusy = false, answerRestoreFailed = false,
  selected, pendingChoice, result, standing, joinCode }: {
  state: GameState; offset: number; variant: "personal" | "presentation" | "preview"; participant?: Participation | null;
  onAnswer?: (choiceId: string) => void; answerBusy?: boolean; answerRestoreFailed?: boolean; selected?: string | null;
  pendingChoice?: string | null; result?: MyResult | null; standing?: PersonalStanding | null; joinCode?: string;
}) {
  const personal = variant === "personal";
  const phase = state.status;
  const [initial] = useState(() => ({ phase, questionId: state.questionId }));
  const celebrate = !resultStatuses.includes(initial.phase) || initial.questionId !== state.questionId;
  const timeRemaining = useTimeRemaining(phase === "QUESTION_OPEN", state.closesAt, offset);
  const { standingLabel } = standingInfo(state, participant, result, standing);
  const active = activeStatuses.includes(phase);
  const compactQuestion = personal && active && Boolean(state.question);
  const headingRef = useQuestionFocus(personal && phase === "QUESTION_OPEN" ? state.questionId : null);
  return <div className={`rl-live-view is-${variant}`}>
    {personal && !compactQuestion && <div className={`rl-live-identity${resultStatuses.includes(phase) ? " is-result" : ""}`}>
      {participant ? <><Avatar avatarId={participant.avatarId} /><div><strong>{participant.displayName}</strong>
        <span>{standingLabel}</span></div></> : <span role="status">Deine Teilnahme wird geladen …</span>}
    </div>}
    <div className="rl-live-phase-content" key={active ? `question-${state.questionId}` : `${phase}-${state.questionId}`}>
      {phase === "LOBBY" && <LiveLobby state={state} personal={personal} joinCode={joinCode}
        showJoinDetails={variant === "presentation"} />}
      {phase === "COUNTDOWN" && <LiveCountdown state={state} offset={offset} />}
      {active && state.question && !personal && <SharedQuestion state={state} offset={offset} timeRemaining={timeRemaining} />}
      {compactQuestion && <PersonalQuestion state={state} offset={offset} participant={participant} standingLabel={standingLabel}
        timeRemaining={timeRemaining} selected={selected} pendingChoice={pendingChoice} answerBusy={answerBusy}
        answerRestoreFailed={answerRestoreFailed} onAnswer={onAnswer} headingRef={headingRef} />}
      {phase === "REVEAL" && <LiveReveal state={state} result={result} personal={personal} selected={selected} celebrate={celebrate}
        eventScope={`${state.sessionId}:${participant?.participantId ?? "presentation"}`} />}
      {(phase === "LEADERBOARD" || phase === "FINISHED") && <LiveRanking state={state} participant={participant}
        personal={personal} celebrate={celebrate}
        celebrateFinal={initial.phase !== "FINISHED" && (!personal || Boolean(result?.answered && result.correct))} />}
      {phase === "CANCELLED" && <LiveCancelled />}
    </div>
    {phase !== "LOBBY" && !compactQuestion && <p className="rl-live-footnote">
      {state.participantCount} Teilnehmende · Gemeinsam rätseln, gemeinsam staunen.</p>}
  </div>;
}
