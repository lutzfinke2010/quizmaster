import { useEffect, useState } from "react";
import { Check, CheckCircle2, Clock3, Sparkles, Trophy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { GameState, MyResult, Participation } from "../cloud";
import { AnswerCelebration } from "./AnswerCelebration";
import "./game.css";

export const phaseLabels: Record<string, string> = {
  LOBBY: "Warten auf die Runde", COUNTDOWN: "Gleich geht’s los", QUESTION_OPEN: "Du bist gefragt",
  QUESTION_CLOSED: "Antworten geschlossen", SCORING: "Wird ausgewertet", REVEAL: "Die Auflösung",
  LEADERBOARD: "Der Zwischenstand", FINISHED: "Geschafft!", CANCELLED: "Runde abgebrochen",
};

type RankedPlayer = GameState["leaderboard"][number];
export type PersonalStanding = { questionIndex: number; player: RankedPlayer };
const number = (value: number) => value.toLocaleString("de-DE");

export function Avatar({ avatarId }: { avatarId: string }) {
  const hues = ["#88edff", "#ff9fca", "#b7fa63", "#ffd77a", "#c5a6ff"];
  const index = [...avatarId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % hues.length;
  return <svg className="avatar" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill={hues[index]} /><circle cx="22" cy="27" r="4" fill="#211a40" />
    <circle cx="42" cy="27" r="4" fill="#211a40" /><path d="M22 40 Q32 50 42 40" fill="none" stroke="#211a40" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

export function Timer({ deadline, offset }: { deadline: number; offset: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now - offset) / 1000));
  return <span className="timer" role="timer" aria-live="off" aria-label={`Noch ${seconds} Sekunden`}>
    {seconds}<small>Sekunden</small></span>;
}

export function JoinDetails({ code }: { code: string }) {
  return <div className="join-details">
    <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={160} bgColor="#ffffff" title="QR-Code zum Beitreten" />
    <div><span className="eyebrow">DEIN WEG IN DIE RUNDE</span>
      <p>Beitreten unter <strong>{window.location.origin}/join</strong></p>
      <p className="join-code" aria-label={`Spielcode ${code.split("").join(" ")}`}>{code}</p></div>
  </div>;
}

function AnswerProgress({ state }: { state: GameState }) {
  const { answerCount, eligibleParticipantCount } = state;
  return <div className="answer-progress">
    <p><strong>{number(answerCount)} von {number(eligibleParticipantCount)}</strong> haben geantwortet</p>
    <progress value={Math.min(answerCount, eligibleParticipantCount)} max={Math.max(1, eligibleParticipantCount)}
      aria-label={`${answerCount} von ${eligibleParticipantCount} haben geantwortet`} />
  </div>;
}

function RankChange({ player, questionIndex }: { player: RankedPlayer; questionIndex: number }) {
  if (questionIndex < 1 || player.previousRank < 1) return null;
  const change = player.rankChange;
  return <span className="rank-change">{change > 0 ? `↑ ${change} ${change === 1 ? "Platz" : "Plätze"} gutgemacht` :
    change < 0 ? `↓ ${-change} ${change === -1 ? "Platz" : "Plätze"} zurück` : "↔ Platz gehalten"}</span>;
}

function Ranking({ state, participant, personal }: { state: GameState; participant?: Participation | null; personal: boolean }) {
  const final = state.status === "FINISHED";
  const ownIndex = state.leaderboard.findIndex((player) => player.participantId === participant?.participantId);
  const own = state.leaderboard[ownIndex];
  const top = state.leaderboard.slice(0, 3);
  const podium = top.length > 1 ? [top[1], top[0], ...top.slice(2)] : top;
  const rows = personal
    ? state.leaderboard.slice(Math.max(0, ownIndex - 1), Math.max(0, ownIndex - 1) + 3)
    : state.leaderboard.slice(3, 8);
  return <section className="ranking-phase" aria-labelledby="ranking-title">
    <span className="eyebrow">{final ? "DAS WAR EURE RUNDE" : `ZWISCHENSTAND · NACH FRAGE ${state.questionIndex + 1}`}</span>
    <h1 id="ranking-title">{final ? "Endstand" : "Zwischenstand"}</h1>
    {personal ? own ? <div className="personal-ranking">
      <div className="result-sticker" aria-hidden="true"><Trophy size={32} /></div>
      <h2><span className="sr-only">Dein {final ? "Endstand" : "Zwischenstand"}: </span>Platz {own.rank}</h2>
      <div className="points">{number(own.points)}</div><p>Punkte insgesamt</p>
      {final && <p>{own.correctAnswers} von {state.questionCount} Fragen richtig beantwortet</p>}
      <RankChange player={own} questionIndex={state.questionIndex} />
    </div> : <p role="status">Deine Platzierung ist noch nicht verfügbar.</p> : <>
      <p className="ranking-intro">{final ? "Zusammen gerätselt. Gemeinsam gefeiert." : "Da geht noch was."}</p>
      <div className="podium" aria-label={final ? "Siegerpodest" : "Führende der Runde"}>
        {podium.map((player) => <div className={`podium-player podium-rank-${Math.min(player.rank, 3)}`} key={player.participantId}>
          <Avatar avatarId={player.avatarId} /><strong>{player.displayName}</strong><span>{number(player.points)} Punkte</span>
          <div className="pedestal"><span className="sr-only">Platz </span>{player.rank}</div>
        </div>)}
      </div>
    </>}
    {state.leaderboard.length === 0 ? <p>Noch keine Teilnehmenden.</p> : rows.length > 0 &&
      <ol className="leaderboard" aria-label={personal ? "Deine benachbarten Plätze" : "Weitere Plätze"}>
        {rows.map((player) => <li key={player.participantId} className={player.participantId === participant?.participantId ? "is-you" : undefined}>
          <span className="rank-number" aria-label={`Platz ${player.rank}`}>{player.rank}</span>
          <Avatar avatarId={player.avatarId} /><span className="rank-name">{player.displayName}{player.participantId === participant?.participantId && " (du)"}</span>
          <strong>{number(player.points)} <span>Punkte</span></strong>
        </li>)}
      </ol>}
    {!personal && state.leaderboard.length > 8 && <p className="hint ranking-count">
      Die ersten 8 von {state.leaderboard.length} Teilnehmenden · Deine Position siehst du auf deinem Handy.</p>}
    {!final && <p className="game-hint">Die nächste Frage startet der Quizmaster.</p>}
  </section>;
}

function QuestionAnswers({ state, selected, pendingChoice, locked, onAnswer }: {
  state: GameState; selected?: string | null; pendingChoice?: string | null; locked: boolean;
  onAnswer?: (choiceId: string) => void;
}) {
  return <div className="answer-grid">{state.question?.answers.map((answer, index) => {
    const isSelected = selected === answer.id;
    const isPending = pendingChoice === answer.id && !selected;
    const content = <><span className="answer-letter">{String.fromCharCode(65 + index)}</span>
      <span className="answer-content"><span className="answer-text">{answer.text}</span>
        {isSelected && <span className="answer-state"><Check size={15} aria-hidden="true" />Deine Antwort · abgegeben</span>}
        {isPending && <span className="answer-state"><Clock3 size={15} aria-hidden="true" />Wird gesendet …</span>}
      </span></>;
    const className = `answer-tile${isSelected ? " is-selected" : ""}${isPending ? " is-pending" : ""}`;
    return onAnswer ? <button key={answer.id} type="button" className={className}
      aria-disabled={locked} aria-pressed={isSelected || isPending}
      onClick={() => { if (!locked) onAnswer(answer.id); }}>{content}</button> :
      <div key={answer.id} className={className}>{content}</div>;
  })}</div>;
}

function Reveal({ state, result, personal, selected }: {
  state: GameState; result?: MyResult | null; personal: boolean; selected?: string | null;
}) {
  const reveal = state.reveal;
  const question = state.question;
  if (!reveal || !question) return <p role="status">Die Auflösung wird geladen …</p>;
  const votes = reveal.distribution.reduce((sum, option) => sum + option.count, 0);
  const correctIndex = question.answers.findIndex((answer) => answer.id === reveal.correctChoiceId);
  const correct = question.answers[correctIndex];
  return <section className={`reveal-phase${personal ? " personal-reveal" : ""}`} aria-labelledby="reveal-title">
    <span className="eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount} · AUFLÖSUNG</span>
    <h1 id="reveal-title">Auflösung</h1>
    {personal && (result ? <div className="personal-result">
      {result.answered && result.correct && <AnswerCelebration key={result.questionId} />}
      <div className={`result-sticker${result.correct ? "" : " result-sticker-peach"}`} aria-hidden="true">
        {result.correct ? <Sparkles size={34} /> : <Clock3 size={34} />}</div>
      <h2 className="result-message" role="status">{!result.answered ? "Zeit abgelaufen · Keine Antwort" :
        result.correct ? "Richtig!" : "Leider daneben"}</h2>
      <div className="points">+ {number(result.points)}</div><p>Punkte für diese Frage</p>
      <p className="result-total"><strong>{number(result.totalPoints)} Punkte</strong> insgesamt</p>
      {result.answered && result.elapsedMs != null &&
        <p className="result-time">Geantwortet in {(result.elapsedMs / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Sekunden</p>}
    </div> : <p role="status">Dein Ergebnis wird geladen …</p>)}
    {personal && correct && <p className="correct-answer"><CheckCircle2 size={21} aria-hidden="true" />
      <span>Richtige Antwort: <strong>{String.fromCharCode(65 + correctIndex)} · {correct.text}</strong></span></p>}
    <h2 className="reveal-question">{question.text}</h2>
    <div className="results-grid">{question.answers.map((answer, index) => {
      const count = reveal.distribution.find((item) => item.choiceId === answer.id)?.count ?? 0;
      const isCorrect = answer.id === reveal.correctChoiceId;
      return <div className={`result-option${isCorrect ? " correct" : ""}`} key={answer.id}>
        <div className="result-option-heading"><span className="answer-letter">{String.fromCharCode(65 + index)}</span>
          <strong>{answer.text}</strong></div>
        {isCorrect && <span className="answer-state"><CheckCircle2 size={17} aria-hidden="true" />Richtige Antwort</span>}
        {selected === answer.id && <span className="answer-state"><Check size={16} aria-hidden="true" />Deine Antwort</span>}
        <span className="answer-votes">{count} {count === 1 ? "Stimme" : "Stimmen"}</span>
        <div className="vote-track" aria-hidden="true"><span style={{ width: `${votes > 0 ? Math.min(100, count / votes * 100) : 0}%` }} /></div>
      </div>;
    })}</div>
    <p className="distribution-note">{votes} abgegebene Antworten · {Math.max(0, state.eligibleParticipantCount - votes)} ohne Antwort.
      Balken: Anteil an allen abgegebenen Antworten.</p>
    {reveal.explanation && <p className="question-explanation">{reveal.explanation}</p>}
  </section>;
}

export function GameView({ state, offset, participant, personal = false, onAnswer, answerBusy, answerRestoreFailed,
  selected, pendingChoice, result, standing, joinCode, presentation = false }: {
  state: GameState; offset: number; participant?: Participation | null; personal?: boolean;
  onAnswer?: (choiceId: string) => void; answerBusy?: boolean; selected?: string | null;
  pendingChoice?: string | null; answerRestoreFailed?: boolean; result?: MyResult | null;
  standing?: PersonalStanding | null; joinCode?: string; presentation?: boolean;
}) {
  const phase = state.status;
  const currentPlayer = state.leaderboard.find((player) => player.participantId === participant?.participantId);
  const score = currentPlayer?.points ?? result?.totalPoints ?? standing?.player.points;
  const rank = currentPlayer?.rank ?? standing?.player.rank;
  const choiceIndex = state.question?.answers.findIndex((answer) => answer.id === (selected ?? pendingChoice)) ?? -1;
  const choice = choiceIndex >= 0 ? state.question?.answers[choiceIndex] : undefined;
  const active = ["QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"].includes(phase);
  return <div className={`game-view${personal ? " game-personal" : ""}${presentation ? " game-presentation" : ""}`}>
    <header className="game-heading">
      <p className="game-title">{state.title}</p>
      <span className="phase-badge" role="status">{phaseLabels[phase] ?? phase}</span>
    </header>
    {personal && <div className="player-identity">
      {participant ? <><Avatar avatarId={participant.avatarId} /><div><strong>{participant.displayName}</strong>
        <span>{score != null ? `${number(score)} Punkte` : state.questionIndex < 1 ? "Noch keine Wertung" : "Wertung nach der Auflösung"}
          {rank != null && ` · ${currentPlayer ? "Platz" : "Zuletzt Platz"} ${rank}`}</span></div></> :
        <span role="status">Deine Teilnahme wird geladen …</span>}
    </div>}
    <div className="game-phase" key={active ? `question-${state.questionId}` : `${phase}-${state.questionId}`}>
      {phase === "LOBBY" && <section className="lobby-phase">
        <span className="eyebrow">ZUSAMMEN WIRD’S EINE RUNDE</span>
        <h1>{personal ? "Du bist dabei." : "Ein Platz für dein Aha."}</h1>
        <p>Die Runde beginnt, sobald der Quizmaster startet.</p>
        {!personal && (joinCode || state.joinCode) && <JoinDetails code={(joinCode || state.joinCode)!} />}
        <p className="lobby-count"><strong>{state.participantCount}</strong> Teilnehmende</p>
        {state.participants.length > 0 ? <div className="players">
          {state.participants.slice(0, personal ? 6 : 12).map((player) => <div className="player-tag" key={player.participantId}>
            <Avatar avatarId={player.avatarId} /><span>{player.displayName}</span></div>)}
          {state.participantCount > (personal ? 6 : 12) && <span className="more-players">+ {state.participantCount - (personal ? 6 : 12)} weitere</span>}
        </div> : !personal && <p>Noch niemand dabei. Teile den Spielcode!</p>}
      </section>}
      {phase === "COUNTDOWN" && <section className="countdown-phase">
        <span className="eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount}</span>
        <div className="result-sticker" aria-hidden="true"><Sparkles size={32} /></div>
        <h1>Gleich geht’s los!</h1>
        {state.opensAt != null && <Timer deadline={state.opensAt} offset={offset} />}
        <p>Mach dich bereit für die nächste Frage.</p>
      </section>}
      {active && state.question && <section className="question-phase" aria-labelledby="question-title">
        <div className="question-meta"><span className="eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount}</span>
          {phase === "QUESTION_OPEN" && state.closesAt != null && <Timer deadline={state.closesAt} offset={offset} />}</div>
        <h1 id="question-title">{state.question.text}</h1>
        <QuestionAnswers state={state} selected={selected} pendingChoice={pendingChoice}
          locked={phase !== "QUESTION_OPEN" || Boolean(selected) || Boolean(answerBusy)} onAnswer={onAnswer} />
        {personal && <div className={`answer-feedback${pendingChoice && !selected ? " pending" : ""}`} role="status" aria-atomic="true">
          {selected ? <CheckCircle2 size={22} aria-hidden="true" /> : <Clock3 size={22} aria-hidden="true" />}
          <span>{selected ? <><strong>Antwort ist drin</strong>Deine Antwort: {choice ? `${String.fromCharCode(65 + choiceIndex)} · ${choice.text}` : "wird geladen …"}
            <small>Gleich erfährst du, ob du richtig liegst.</small></> :
            pendingChoice ? <><strong>Wird gesendet …</strong>Deine Auswahl: {choice ? `${String.fromCharCode(65 + choiceIndex)} · ${choice.text}` : ""}</> :
            answerRestoreFailed ? "Deine gespeicherte Antwort ist gerade nicht verfügbar. Bitte erneut prüfen." :
            answerBusy ? "Deine gespeicherte Antwort wird geprüft …" :
            phase === "QUESTION_OPEN" ? "Tippe auf eine Antwort. Sie wird direkt abgegeben und kann nicht geändert werden." :
            "Keine Antwort abgegeben. Die Auflösung folgt gleich."}</span>
        </div>}
        {phase !== "QUESTION_OPEN" && <p className="game-hint" role="status">Kurz durchatmen. Die Antworten werden ausgewertet …</p>}
        <AnswerProgress state={state} />
        {personal && phase === "QUESTION_OPEN" && <p className="game-hint">Die Antwortzeit wird auf dem Server gemessen. Der Netzwerkweg zählt mit.</p>}
      </section>}
      {phase === "REVEAL" && <Reveal state={state} result={result} personal={personal} selected={selected} />}
      {["LEADERBOARD", "FINISHED"].includes(phase) && <Ranking state={state} participant={participant} personal={personal} />}
      {phase === "CANCELLED" && <section className="countdown-phase"><h1>Runde abgebrochen</h1><p>Diese Sitzung wurde vom Quizmaster beendet.</p></section>}
    </div>
    {phase !== "LOBBY" && <p className="game-footnote">{state.participantCount} Teilnehmende · Gemeinsam rätseln, gemeinsam staunen.</p>}
  </div>;
}
