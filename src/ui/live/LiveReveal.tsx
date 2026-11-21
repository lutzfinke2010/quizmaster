import { Check, CheckCircle2, Lightbulb } from "lucide-react";
import type { GameState, MyResult } from "../../cloud";
import { AnimatedPoints } from "../game/AnimatedPoints";
import { Achievements, Encouragement, ScoreAward } from "../game/Rewards";
import { RateLamaMascot } from "../RateLamaMascot";
import { letter } from "./phaseLabels";

/** Vote distribution: share of all submitted answers, correct answer highlighted. */
export function VoteResults({ state, selected }: { state: GameState; selected?: string | null }) {
  const reveal = state.reveal!;
  const question = state.question!;
  const votes = reveal.distribution.reduce((sum, option) => sum + option.count, 0);
  return <>
    <ul className="rl-live-votes" aria-label="Stimmenverteilung">{question.answers.map((answer, index) => {
      const count = reveal.distribution.find((item) => item.choiceId === answer.id)?.count ?? 0;
      const isCorrect = answer.id === reveal.correctChoiceId;
      return <li className={`rl-live-vote rl-live-vote-${index % 4}${isCorrect ? " is-correct" : ""}`} key={answer.id}>
        <div className="rl-live-vote-heading">
          <span className="rl-live-vote-letter" aria-hidden="true">{letter(index)}</span>
          <strong className="rl-live-vote-text">{answer.text}</strong>
          <span className="rl-live-vote-count">{count} {count === 1 ? "Stimme" : "Stimmen"}</span>
        </div>
        {(isCorrect || selected === answer.id) && <div className="rl-live-vote-tags">
          {isCorrect && <span className="rl-live-vote-tag is-correct"><Check aria-hidden="true" strokeWidth={3} />Richtige Antwort</span>}
          {selected === answer.id && <span className="rl-live-vote-tag">Deine Antwort</span>}
        </div>}
        <div className="rl-live-vote-bar" aria-hidden="true">
          <span style={{ width: `${votes > 0 ? Math.min(100, count / votes * 100) : 0}%` }} /></div>
      </li>;
    })}</ul>
    <p className="rl-live-distribution-note">{votes} abgegebene Antworten · {Math.max(0, state.eligibleParticipantCount - votes)} ohne
      Antwort. Balken: Anteil an allen abgegebenen Antworten.</p>
  </>;
}

function PersonalResult({ result, celebrate, eventScope }: { result: MyResult; celebrate: boolean; eventScope: string }) {
  const correct = result.answered && result.correct;
  return <div className={`rl-live-result${correct ? " is-correct" : " is-wrong"}`}>
    <RateLamaMascot state={correct ? "correct" : "wrong"} size={112} decorative className="rl-live-result-llama" />
    <h2 className="rl-live-result-message" role="status">{!result.answered ? "Zeit abgelaufen · Keine Antwort" :
      result.correct ? "Richtig!" : "Leider daneben"}</h2>
    {result.answered && !result.correct && <Encouragement />}
    <ScoreAward key={result.questionId} points={result.points} extra={result.streakBonusPoints}
      streak={result.streak} badges={result.badges} celebrate={celebrate && correct}
      eventId={`${eventScope}:points:${result.questionId}`} />
    <p className="rl-live-total"><strong><AnimatedPoints value={result.totalPoints}
      from={celebrate && correct ? result.totalPoints - result.points : result.totalPoints} /> Punkte</strong> insgesamt</p>
    <Achievements streak={result.streak} maxStreak={result.maxStreak} badges={result.badges} />
    {result.answered && result.elapsedMs != null && <p className="rl-live-time">Geantwortet in {(result.elapsedMs / 1000)
      .toLocaleString("de-DE", { maximumFractionDigits: 1 })} Sekunden</p>}
  </div>;
}

/** Reveal after the quizmaster's go: personal result first on the phone, distribution for everyone. */
export function LiveReveal({ state, result, personal, selected, celebrate, eventScope }: {
  state: GameState; result?: MyResult | null; personal: boolean; selected?: string | null; celebrate: boolean; eventScope: string;
}) {
  const reveal = state.reveal;
  const question = state.question;
  if (!reveal || !question) return <p role="status" className="rl-hint">Die Auflösung wird geladen …</p>;
  const correctIndex = question.answers.findIndex((answer) => answer.id === reveal.correctChoiceId);
  const correct = question.answers[correctIndex];
  return <section className={`rl-live-reveal${personal ? " is-personal" : " is-shared"}`} aria-labelledby="reveal-title">
    <div className="rl-live-reveal-head">
      <span className="rl-eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount} · AUFLÖSUNG</span>
      <h1 id="reveal-title" className="rl-h1">Auflösung</h1>
    </div>
    {personal && (result ? <PersonalResult result={result} celebrate={celebrate} eventScope={eventScope} /> :
      <p role="status" className="rl-hint">Dein Ergebnis wird geladen …</p>)}
    <div className="rl-live-reveal-body">
      {personal && correct && <p className="rl-live-correct"><CheckCircle2 aria-hidden="true" strokeWidth={2.6} />
        <span>Richtige Antwort: <strong>{letter(correctIndex)} · {correct.text}</strong></span></p>}
      <h2 className="rl-live-reveal-question">{question.text}</h2>
      <VoteResults state={state} selected={selected} />
      {reveal.explanation && <div className="rl-live-explanation">
        <Lightbulb aria-hidden="true" strokeWidth={2.4} />
        <p><strong>Gut zu wissen:</strong> {reveal.explanation}</p>
      </div>}
    </div>
  </section>;
}
