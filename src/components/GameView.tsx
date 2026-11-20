import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import avatars from "../domain/avatars.json";
import type { GameState, MyResult, Participation } from "../cloud";
import { Achievements, AnimatedPoints, Encouragement, Finale, RankRise, ScoreAward } from "./Gamification";
import { GameIcon, GameIllustration, MomentVisual } from "./GameAssets";
import { STREAK_RULE_TEXT } from "../domain/gamification";
import { answerColumns, QuestionPosition, useQuestionFocus } from "./QuestionLayout";
import "./game.css";

export const phaseLabels: Record<string, string> = {
  LOBBY: "Warten auf die Runde", COUNTDOWN: "Gleich geht’s los", QUESTION_OPEN: "Du bist gefragt",
  QUESTION_CLOSED: "Antworten geschlossen", SCORING: "Wird ausgewertet", REVEAL: "Die Auflösung",
  LEADERBOARD: "Der Zwischenstand", FINISHED: "Geschafft!", CANCELLED: "Runde abgebrochen",
};

const avatarById = new Map(avatars.avatars.map((avatar) => [avatar.id, avatar]));
type RankedPlayer = GameState["leaderboard"][number];
type RankingPlayer = Pick<RankedPlayer, "participantId" | "avatarId" | "displayName" | "points" | "rank"> &
  Partial<Pick<RankedPlayer, "streak" | "badges" | "rankChange" | "previousRank" | "previousPoints">> & { detail?: string };
export type PersonalStanding = { questionIndex: number; player: RankedPlayer };
const number = (value: number) => value.toLocaleString("de-DE");

export function Avatar({ avatarId }: { avatarId: string }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const avatar = avatarById.get(avatarId);
  if (!avatar || failedId === avatarId) {
    return <svg className="avatar avatar-fallback" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="3" y="3" width="58" height="58" rx="18" fill="#eaf0df" stroke="#9cad9f" strokeWidth="2" />
      <path d="M22 28h.01M42 28h.01M23 41c5 5 13 5 18 0" fill="none" stroke="#31594e" strokeWidth="4" strokeLinecap="round" />
    </svg>;
  }
  const path256 = `${import.meta.env.BASE_URL}${avatar.path256}`;
  const path512 = `${import.meta.env.BASE_URL}${avatar.path512}`;
  return <img className="avatar" src={path256} srcSet={`${path256} 1x, ${path512} 2x`} alt="" aria-hidden="true"
    onError={() => setFailedId(avatarId)} />;
}

export function Timer({ deadline, offset, now, compact = false }: { deadline: number; offset: number; now: number; compact?: boolean }) {
  const seconds = Math.max(0, Math.ceil((deadline - now - offset) / 1000));
  if (compact) return <span className={`timer-pill${seconds > 0 && seconds <= 3 ? " timer-urgent" : ""}`} role="timer" aria-live="off" aria-label={`Noch ${seconds} Sekunden`}>
    <GameIcon name="timer" size={15} />{seconds} s</span>;
  return <span className={`timer${seconds > 0 && seconds <= 3 ? " timer-urgent" : ""}`} role="timer" aria-live="off" aria-label={`Noch ${seconds} Sekunden`}>
    <span key={seconds} className="timer-digit">{seconds}</span><small>Sekunden</small></span>;
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
  return <span className="rank-change"><GameIcon name={change > 0 ? "rank-up" : change < 0 ? "rank-down" : "rank-steady"} size={16} />
    {change > 0 ? `${change} ${change === 1 ? "Platz" : "Plätze"} gutgemacht` :
      change < 0 ? `${-change} ${change === -1 ? "Platz" : "Plätze"} zurück` : "Platz gehalten"}</span>;
}

export function Podium({ players, final = true, formatPoints = number, animateChanges = false }: {
  players: RankingPlayer[]; final?: boolean; formatPoints?: (points: number) => string; animateChanges?: boolean;
}) {
  const top = players.slice(0, 3);
  const reduced = useReducedMotion();
  const podium = top.length > 1 ? [top[1], top[0], ...top.slice(2)] : top;
  return <div className={`podium${final ? " podium-final" : ""}`} aria-label={final ? "Siegerpodest" : "Führende der Runde"}>
    {podium.map((player) => <motion.div layout={reduced ? false : "position"} initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .45, delay: reduced ? 0 : player.rank === 1 ? .35 : player.rank === 2 ? .15 : 0 }}
      className={`podium-player podium-rank-${Math.min(player.rank, 3)}`} key={player.participantId}>
      {player.rank === 1 && <GameIcon name="crown" className="podium-crown" size={28} />}
      <Avatar avatarId={player.avatarId} /><strong>{player.displayName}</strong><span><AnimatedPoints value={player.points}
        from={animateChanges ? player.previousPoints ?? player.points : player.points} format={formatPoints} /> Punkte</span>
      {(player.streak ?? 0) >= 3 && <small className="podium-streak"><GameIcon name="streak-active" size={16} />{player.streak} in Folge</small>}
      {player.detail && <small className="podium-detail">{player.detail}</small>}
      <div className="pedestal"><span className="sr-only">Platz </span>{player.rank}</div>
    </motion.div>)}
  </div>;
}

export function Leaderboard({ players, participantId, label = "Weitere Plätze", formatPoints = number, animateChanges = false }: {
  players: RankingPlayer[]; participantId?: string; label?: string; formatPoints?: (points: number) => string; animateChanges?: boolean;
}) {
  const reduced = useReducedMotion();
  return <ol className="leaderboard" aria-label={label}>
    {players.map((player, index) => <motion.li layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, x: -12,
        y: animateChanges && (player.previousRank ?? 0) > 0 ? Math.max(-100, Math.min(100, ((player.previousRank ?? player.rank) - player.rank) * 50)) : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: reduced ? 0 : .35, delay: reduced ? 0 : Math.min(index, 5) * .06 }}
      key={player.participantId} className={player.participantId === participantId ? "is-you" : undefined}>
      <span className={`rank-number${animateChanges && (player.rankChange ?? 0) > 0 ? " rank-gained" : ""}`}
        aria-label={`Platz ${player.rank}${animateChanges && (player.rankChange ?? 0) > 0 ? `, ${player.rankChange} Plätze gutgemacht` : ""}`}>{player.rank}</span>
      <Avatar avatarId={player.avatarId} /><span className="rank-name">{player.displayName}{player.participantId === participantId && " (du)"}</span>
      <strong><AnimatedPoints value={player.points} from={animateChanges ? player.previousPoints ?? player.points : player.points}
        format={formatPoints} /> <span>Punkte</span></strong>
    </motion.li>)}
  </ol>;
}

function Ranking({ state, participant, personal, celebrate, celebrateFinal }: {
  state: GameState; participant?: Participation | null; personal: boolean; celebrate: boolean; celebrateFinal: boolean;
}) {
  const final = state.status === "FINISHED";
  const ownIndex = state.leaderboard.findIndex((player) => player.participantId === participant?.participantId);
  const own = state.leaderboard[ownIndex];
  const rows = personal
    ? state.leaderboard.slice(Math.max(0, ownIndex - 1), Math.max(0, ownIndex - 1) + 3)
    : state.leaderboard.slice(3, 8);
  return <section className="ranking-phase" aria-labelledby="ranking-title">
    <span className="eyebrow">{final ? "DAS WAR EURE RUNDE" : `ZWISCHENSTAND · NACH FRAGE ${state.questionIndex + 1}`}</span>
    <h1 id="ranking-title">{final ? "Endstand" : "Zwischenstand"}</h1>
    {final && (personal ? Boolean(own) : state.leaderboard.length > 0) &&
      <Finale winner={personal && own?.rank === 1} shared={!personal} celebrate={celebrateFinal}
        eventId={`${state.sessionId}:${personal ? participant?.participantId ?? "personal" : "shared"}:finale`} />}
    {personal ? own ? <div className="personal-ranking">
      <div className="result-sticker" aria-hidden="true"><GameIcon name="trophy" size={32} /></div>
      <h2><span className="sr-only">Dein {final ? "Endstand" : "Zwischenstand"}: </span>Platz {own.rank}</h2>
      <div className="points"><AnimatedPoints value={own.points} from={celebrate ? own.previousPoints ?? own.points : own.points} /></div><p>Punkte insgesamt</p>
      {final && <p>{own.correctAnswers} von {state.questionCount} Fragen richtig beantwortet</p>}
      <RankChange player={own} questionIndex={state.questionIndex} />
      {state.questionIndex > 0 && own.previousRank > 0 && <RankRise change={own.rankChange}
        eventId={`${state.sessionId}:${own.participantId}:rank:${state.questionIndex}`} celebrate={celebrate} />}
      <Achievements streak={own.streak} maxStreak={own.maxStreak} badges={own.badges} />
    </div> : <p role="status">Deine Platzierung ist noch nicht verfügbar.</p> : <>
      <p className="ranking-intro">{final ? "Zusammen gerätselt. Gemeinsam gefeiert." : "Da geht noch was."}</p>
      {!final && state.questionIndex > 0 && (state.leaderboard[0]?.previousRank ?? 0) > 1 && celebrate &&
        <RankRise change={state.leaderboard[0].rankChange} eventId={`${state.sessionId}:leader:${state.questionIndex}`} celebrate />}
      <Podium players={state.leaderboard} final={final} animateChanges={celebrate && state.questionIndex > 0} />
    </>}
    {state.leaderboard.length === 0 ? <p>Noch keine Teilnehmenden.</p> : rows.length > 0 &&
      <Leaderboard players={rows} participantId={participant?.participantId} animateChanges={celebrate && state.questionIndex > 0}
        label={personal ? "Deine benachbarten Plätze" : "Weitere Plätze"} />}
    {!personal && state.leaderboard.length > 8 && <p className="hint ranking-count">
      Die ersten 8 von {state.leaderboard.length} Teilnehmenden · Deine Position siehst du auf deinem Handy.</p>}
    {!final && <p className="game-hint">Die nächste Frage startet der Quizmaster.</p>}
  </section>;
}

export type AnswerOption = { id: string; text: string };

/** Antwortkacheln A–D, gemeinsam für Live-Fragen und das Quiz zum Mitmachen. */
export function AnswerTiles({ answers, selected, pendingChoice, locked, onAnswer, columns }: {
  answers: ReadonlyArray<AnswerOption>; selected?: string | null; pendingChoice?: string | null; locked: boolean;
  onAnswer?: (choiceId: string) => void; columns?: 1 | 2;
}) {
  return <div className={`answer-grid${columns ? ` answer-columns-${columns}` : ""}`}>{answers.map((answer, index) => {
    const isSelected = selected === answer.id;
    const isPending = pendingChoice === answer.id;
    const content = <><span className="answer-letter">{String.fromCharCode(65 + index)}</span>
      <span className="answer-content"><span className="answer-text">{answer.text}</span>
        {isSelected && <span className="answer-state"><GameIcon name="answer-saved" size={15} />Deine Antwort · abgegeben</span>}
        {isPending && <span className="answer-state"><GameIcon name="timer" size={15} />Wird gesendet …</span>}
      </span></>;
    const className = `answer-tile${isSelected ? " is-selected" : ""}${isPending ? " is-pending" : ""}`;
    return onAnswer ? <button key={answer.id} type="button" className={className}
      aria-disabled={locked} aria-pressed={pendingChoice ? isPending : isSelected}
      onClick={() => { if (!locked) onAnswer(answer.id); }}>{content}</button> :
      <div key={answer.id} className={className}>{content}</div>;
  })}</div>;
}

function QuestionAnswers({ state, compact = false, ...tiles }: {
  state: GameState; selected?: string | null; pendingChoice?: string | null; locked: boolean;
  onAnswer?: (choiceId: string) => void; compact?: boolean;
}) {
  const answers = state.question?.answers ?? [];
  return <AnswerTiles answers={answers} columns={compact && state.question ? answerColumns(answers) : undefined} {...tiles} />;
}

function Reveal({ state, result, personal, selected, celebrate, eventScope }: {
  state: GameState; result?: MyResult | null; personal: boolean; selected?: string | null; celebrate: boolean; eventScope: string;
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
      <MomentVisual icon={!result.answered ? "timer" : result.correct ? "answer-correct" : "answer-incorrect"}
        illustration={result.answered && result.correct ? "answer-celebrate" : "answer-encourage"}
        subdued={!result.answered || !result.correct} />
      <h2 className="result-message" role="status">{!result.answered ? "Zeit abgelaufen · Keine Antwort" :
        result.correct ? "Richtig!" : "Leider daneben"}</h2>
      {result.answered && !result.correct && <Encouragement />}
      <ScoreAward key={result.questionId} points={result.points} extra={result.streakBonusPoints}
        streak={result.streak} badges={result.badges} celebrate={celebrate && result.answered && result.correct}
        eventId={`${eventScope}:points:${result.questionId}`} />
      <p className="result-total"><strong><AnimatedPoints value={result.totalPoints}
        from={celebrate && result.answered && result.correct ? result.totalPoints - result.points : result.totalPoints} /> Punkte</strong> insgesamt</p>
      <Achievements streak={result.streak} maxStreak={result.maxStreak} badges={result.badges} />
      {result.answered && result.elapsedMs != null &&
        <p className="result-time">Geantwortet in {(result.elapsedMs / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Sekunden</p>}
    </div> : <p role="status">Dein Ergebnis wird geladen …</p>)}
    {personal && correct && <p className="correct-answer"><GameIcon name="answer-correct" size={21} />
      <span>Richtige Antwort: <strong>{String.fromCharCode(65 + correctIndex)} · {correct.text}</strong></span></p>}
    <h2 className="reveal-question">{question.text}</h2>
    <div className="results-grid">{question.answers.map((answer, index) => {
      const count = reveal.distribution.find((item) => item.choiceId === answer.id)?.count ?? 0;
      const isCorrect = answer.id === reveal.correctChoiceId;
      return <div className={`result-option${isCorrect ? " correct" : ""}`} key={answer.id}>
        <div className="result-option-heading"><span className="answer-letter">{String.fromCharCode(65 + index)}</span>
          <strong>{answer.text}</strong></div>
        {isCorrect && <span className="answer-state"><GameIcon name="answer-correct" size={17} />Richtige Antwort</span>}
        {selected === answer.id && <span className="answer-state"><GameIcon name="answer-saved" size={16} />Deine Antwort</span>}
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
  const [initial] = useState(() => ({ phase, questionId: state.questionId }));
  const celebrate = !["REVEAL", "LEADERBOARD", "FINISHED"].includes(initial.phase) ||
    initial.questionId !== state.questionId;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (phase !== "QUESTION_OPEN" && phase !== "COUNTDOWN") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [phase, state.questionId]);
  const timeRemaining = phase === "QUESTION_OPEN" && state.closesAt != null && now + offset < state.closesAt;
  const currentPlayer = state.leaderboard.find((player) => player.participantId === participant?.participantId);
  const score = currentPlayer?.points ?? result?.totalPoints ?? standing?.player.points;
  const rank = currentPlayer?.rank ?? standing?.player.rank;
  const scoreLabel = score != null ? `${number(score)} Punkte` :
    state.questionIndex < 1 ? "Noch keine Wertung" : "Wertung nach der Auflösung";
  const standingLabel = scoreLabel + (rank != null ? ` · ${currentPlayer ? "Platz" : "Zuletzt Platz"} ${rank}` : "");
  const choiceIndex = state.question?.answers.findIndex((answer) => answer.id === (pendingChoice ?? selected)) ?? -1;
  const choice = choiceIndex >= 0 ? state.question?.answers[choiceIndex] : undefined;
  const active = ["QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"].includes(phase);
  const compactQuestion = personal && active && Boolean(state.question);
  const headingRef = useQuestionFocus(personal && phase === "QUESTION_OPEN" ? state.questionId : null);
  return <div className={`game-view${personal ? " game-personal" : ""}${presentation ? " game-presentation" : ""}`}>
    {!compactQuestion && <header className="game-heading">
      <p className="game-title">{state.title}</p>
      <span className="phase-badge" role="status">{phaseLabels[phase] ?? phase}</span>
    </header>}
    {personal && !compactQuestion && <div className={`player-identity${["REVEAL", "LEADERBOARD", "FINISHED"].includes(phase) ? " player-identity-result" : ""}`}>
      {participant ? <><Avatar avatarId={participant.avatarId} /><div><strong>{participant.displayName}</strong>
        <span>{standingLabel}</span></div></> :
        <span role="status">Deine Teilnahme wird geladen …</span>}
    </div>}
    <div className="game-phase" key={active ? `question-${state.questionId}` : `${phase}-${state.questionId}`}>
      {phase === "LOBBY" && <section className="lobby-phase">
        <div className="lobby-intro"><div>
          <span className="eyebrow">ZUSAMMEN WIRD’S EINE RUNDE</span>
          <h1>{personal ? "Du bist dabei." : "Ein Platz für dein Aha."}</h1>
          <p>Die Runde beginnt, sobald der Quizmaster startet.</p>
        </div><GameIllustration name="lobby-welcome" className="lobby-illustration" /></div>
        {!personal && (joinCode || state.joinCode) && <JoinDetails code={(joinCode || state.joinCode)!} />}
        <p className="lobby-count"><strong><AnimatedPoints value={state.participantCount} /></strong> Teilnehmende</p>
        {state.participants.length > 0 ? <div className="players">
          {state.participants.slice(0, personal ? 6 : 12).map((player) => <div className="player-tag" key={player.participantId}>
            <Avatar avatarId={player.avatarId} /><span>{player.displayName}</span></div>)}
          {state.participantCount > (personal ? 6 : 12) && <span className="more-players">+ {state.participantCount - (personal ? 6 : 12)} weitere</span>}
        </div> : !personal && <p>Noch niemand dabei. Teile den Spielcode!</p>}
        <p className="game-hint">{state.streakBonusEnabled ? STREAK_RULE_TEXT : "Sammle richtige Antworten, Serien und Abzeichen. Streak-Bonuspunkte sind in dieser Runde aus."}</p>
      </section>}
      {phase === "COUNTDOWN" && <section className="countdown-phase">
        <span className="eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount}</span>
        <MomentVisual icon="ready" illustration="countdown-ready" />
        <h1>Gleich geht’s los!</h1>
        {state.opensAt != null && <Timer deadline={state.opensAt} offset={offset} now={now} />}
        <p>Mach dich bereit für die nächste Frage.</p>
      </section>}
      {active && state.question && !personal && <section className="question-phase" aria-labelledby="question-title">
        <div className="question-meta"><span className="eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount}</span>
          {phase === "QUESTION_OPEN" && state.closesAt != null && <Timer deadline={state.closesAt} offset={offset} now={now} />}</div>
        <h1 id="question-title">{state.question.text}</h1>
        <QuestionAnswers state={state} selected={selected} pendingChoice={pendingChoice}
          locked={!timeRemaining || Boolean(answerBusy)} onAnswer={onAnswer} />
        {phase !== "QUESTION_OPEN" && <p className="game-hint" role="status">Kurz durchatmen. Die Antworten werden ausgewertet …</p>}
        <AnswerProgress state={state} />
      </section>}
      {compactQuestion && state.question && <section className="question-phase compact-question" aria-labelledby="question-title">
        <div className="question-metabar">
          {participant ? <div className="player-identity question-meta-player"><Avatar avatarId={participant.avatarId} />
            <div><strong>{participant.displayName}</strong><small>{standingLabel}</small></div></div> :
            <span role="status">Teilnahme wird geladen …</span>}
          <QuestionPosition index={state.questionIndex} total={state.questionCount} />
          {phase === "QUESTION_OPEN" && state.closesAt != null && <Timer compact deadline={state.closesAt} offset={offset} now={now} />}
        </div>
        <span className="phase-badge" role="status">{phaseLabels[phase] ?? phase}</span>
        <h1 id="question-title" ref={headingRef} tabIndex={-1}>{state.question.text}</h1>
        <QuestionAnswers compact state={state} selected={selected} pendingChoice={pendingChoice}
          locked={!timeRemaining || Boolean(answerBusy)} onAnswer={onAnswer} />
        <div className={`answer-feedback${pendingChoice ? " pending" : ""}`} role="status" aria-atomic="true">
          <GameIcon name={selected && !pendingChoice ? "answer-saved" : "timer"} size={18} />
          <span>{pendingChoice ? <><strong>Wird gesendet …</strong> {choice ? `${String.fromCharCode(65 + choiceIndex)} · ${choice.text}` : ""}</> :
            selected ? <><strong>Antwort ist drin:</strong> {choice ? `${String.fromCharCode(65 + choiceIndex)} · ${choice.text}` : "wird geladen …"}
              {timeRemaining ? " · bis Zeitablauf änderbar" : ""}</> :
            answerRestoreFailed ? "Deine gespeicherte Antwort ist gerade nicht verfügbar. Bitte erneut prüfen." :
            answerBusy ? "Deine gespeicherte Antwort wird geprüft …" :
            timeRemaining ? "Tippe auf eine Antwort – sie wird direkt abgegeben." :
            phase !== "QUESTION_OPEN" ? "Kurz durchatmen. Die Antworten werden ausgewertet …" :
            "Keine Antwort abgegeben. Die Auflösung folgt gleich."}</span>
        </div>
        <details className="question-help">
          <summary>Hinweise und Fortschritt</summary>
          <AnswerProgress state={state} />
          {pendingChoice && selected && <p>Bis zur Bestätigung bleibt deine bisherige Antwort gespeichert.</p>}
          <p>Bis zum Zeitablauf kannst du deine Antwort ändern; für die Punkte zählt deine letzte Änderung.
            Die Antwortzeit wird auf dem Server gemessen. Der Netzwerkweg zählt mit.</p>
          <p>{state.title} · {state.participantCount} Teilnehmende</p>
        </details>
      </section>}
      {phase === "REVEAL" && <Reveal state={state} result={result} personal={personal} selected={selected} celebrate={celebrate}
        eventScope={`${state.sessionId}:${participant?.participantId ?? "presentation"}`} />}
      {["LEADERBOARD", "FINISHED"].includes(phase) && <Ranking state={state} participant={participant} personal={personal}
        celebrate={celebrate}
        celebrateFinal={initial.phase !== "FINISHED" && (!personal || Boolean(result?.answered && result.correct))} />}
      {phase === "CANCELLED" && <section className="countdown-phase"><h1>Runde abgebrochen</h1><p>Diese Sitzung wurde vom Quizmaster beendet.</p></section>}
    </div>
    {phase !== "LOBBY" && !compactQuestion && <p className="game-footnote">{state.participantCount} Teilnehmende · Gemeinsam rätseln, gemeinsam staunen.</p>}
  </div>;
}
