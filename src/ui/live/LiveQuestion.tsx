import type { Ref } from "react";
import { Check, Hourglass, LoaderCircle } from "lucide-react";
import type { GameState, Participation } from "../../cloud";
import { AnswerCards } from "../AnswerCards";
import { Avatar } from "../game/Avatar";
import { answerColumns } from "../game/questionLayout";
import { DeadlineTimer, QuestionPosition } from "../game/Timers";
import { RateLamaMascot } from "../RateLamaMascot";
import { AnswerProgress } from "./AnswerProgress";
import { letter } from "./phaseLabels";

const WAITING_TEXT = "Kurz durchatmen. Die Antworten werden ausgewertet …";

/** Large question for the shared screen and the quizmaster preview – answers are not interactive. */
export function SharedQuestion({ state, offset, timeRemaining }: { state: GameState; offset: number; timeRemaining: boolean }) {
  const question = state.question!;
  return <section className="rl-live-question is-shared" aria-labelledby="question-title">
    <div className="rl-live-question-meta">
      <span className="rl-eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount}</span>
      {state.status === "QUESTION_OPEN" && state.closesAt != null &&
        <DeadlineTimer deadline={state.closesAt} offset={offset} size="stage" />}
    </div>
    <h1 id="question-title" className="rl-live-question-title">{question.text}</h1>
    <AnswerCards answers={question.answers} locked={!timeRemaining} />
    {state.status !== "QUESTION_OPEN" && <p className="rl-live-hint" role="status">{WAITING_TEXT}</p>}
    <AnswerProgress state={state} />
  </section>;
}

/** Compact personal question: everything needed to answer fits on one phone screen. */
export function PersonalQuestion({ state, offset, participant, standingLabel, timeRemaining, selected, pendingChoice,
  answerBusy, answerRestoreFailed, onAnswer, headingRef }: {
  state: GameState; offset: number; participant?: Participation | null; standingLabel: string; timeRemaining: boolean;
  selected?: string | null; pendingChoice?: string | null; answerBusy: boolean; answerRestoreFailed: boolean;
  onAnswer?: (choiceId: string) => void; headingRef: Ref<HTMLHeadingElement>;
}) {
  const question = state.question!;
  const choiceIndex = question.answers.findIndex((answer) => answer.id === (pendingChoice ?? selected));
  const choice = choiceIndex >= 0 ? `${letter(choiceIndex)} · ${question.answers[choiceIndex].text}` : "";
  const previousIndex = pendingChoice && selected && selected !== pendingChoice
    ? question.answers.findIndex((answer) => answer.id === selected) : -1;
  const previous = previousIndex >= 0 ? `${letter(previousIndex)} · ${question.answers[previousIndex].text}` : "";
  const saved = Boolean(selected && !pendingChoice);
  const Icon = pendingChoice ? LoaderCircle : saved ? Check : Hourglass;
  return <section className="rl-live-question is-personal" aria-labelledby="question-title">
    <div className="rl-live-metabar">
      {participant ? <div className="rl-live-identity is-compact"><Avatar avatarId={participant.avatarId} />
        <div><strong>{participant.displayName}</strong><small>{standingLabel}</small></div></div> :
        <span className="rl-live-identity is-compact" role="status">Teilnahme wird geladen …</span>}
      <QuestionPosition index={state.questionIndex} total={state.questionCount} />
      {state.status === "QUESTION_OPEN" && state.closesAt != null && <DeadlineTimer deadline={state.closesAt} offset={offset} />}
    </div>
    <div className="rl-live-question-head">
      <RateLamaMascot state="intro" size={64} decorative className="rl-live-question-llama" />
      <h1 id="question-title" className="rl-live-question-title" ref={headingRef} tabIndex={-1}>{question.text}</h1>
    </div>
    <AnswerCards answers={question.answers} columns={answerColumns(question.answers)} selectedId={selected}
      pendingId={pendingChoice} locked={!timeRemaining || answerBusy} onSelect={onAnswer} />
    <div className={`rl-live-feedback${pendingChoice ? " is-pending" : saved ? " is-saved" : ""}`} role="status" aria-atomic="true">
      <Icon className={pendingChoice ? "rl-spin" : undefined} aria-hidden="true" strokeWidth={2.6} />
      <span>{pendingChoice ? <><strong>Wird gesendet …</strong> {choice}{previous && ` · bisher gespeichert: ${previous}`}</> :
        selected ? <><strong>Antwort ist drin</strong>: {choice || "wird geladen …"}
          {timeRemaining ? " · bis Zeitablauf änderbar" : ""}</> :
        answerRestoreFailed ? "Deine gespeicherte Antwort ist gerade nicht verfügbar. Bitte erneut prüfen." :
        answerBusy ? "Deine gespeicherte Antwort wird geprüft …" :
        timeRemaining ? "Tippe auf eine Antwort – sie wird direkt abgegeben." :
        state.status !== "QUESTION_OPEN" ? WAITING_TEXT :
        "Keine Antwort abgegeben. Die Auflösung folgt gleich."}</span>
    </div>
    <details className="rl-details rl-live-help">
      <summary>Hinweise und Fortschritt</summary>
      <div className="rl-details-body">
        <AnswerProgress state={state} />
        {pendingChoice && selected && <p>Bis zur Bestätigung bleibt deine bisherige Antwort gespeichert.</p>}
        <p>Bis zum Zeitablauf kannst du deine Antwort ändern; für die Punkte zählt deine letzte Änderung.
          Die Antwortzeit wird auf dem Server gemessen. Der Netzwerkweg zählt mit.</p>
        <p>{state.title} · {state.participantCount} Teilnehmende</p>
      </div>
    </details>
  </section>;
}
