import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3, Timer, Zap } from "lucide-react";
import { cloud, type AsyncAnswerReceipt, type AsyncGuestState } from "../../cloud";
import { formatDateTimeWithZone } from "../../domain/localTime";
import { useNoIndex } from "../../hooks/useNoIndex";
import { AnswerCards } from "../AnswerCards";
import { ExplanationCard, ScorePill } from "../Feedback";
import { LlamaCharacter } from "../LlamaCharacter";
import { message } from "../common/message";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { AnimatedPoints } from "../game/AnimatedPoints";
import { Avatar } from "../game/Avatar";
import { answerColumns, useQuestionFocus } from "../game/questionLayout";
import { Achievements, Encouragement, Finale, RankRise, ScoreAward } from "../game/Rewards";
import { DeadlineTimer, QuestionPosition, SpeedBonus } from "../game/Timers";
import { ScreenLayout } from "../shell/ScreenLayout";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import { pointsText, scoringRuleOf, secondsText, speedIntro } from "./asyncFormat";
import "../quizPlay.css";
import "./async.css";

type PublicInfo = Awaited<ReturnType<typeof cloud.asyncPublicInfo>>;
type Choice = { id: string; text: string };
/** Confirmed answer that paused the quiz; keeps the tapped cards so the reveal can show them. */
type PausedAfter = { answeredCount: number; answer: string; questionIndex: number; choiceId: string; answers: Choice[] };

function AsyncProgress({ answered, total }: { answered: number; total: number }) {
  return <div className="async-progress">
    <p><strong>{answered} von {total}</strong> Fragen beantwortet</p>
    <progress className="rl-meter" value={Math.min(answered, total)} max={Math.max(1, total)}
      aria-label={`${answered} von ${total} Fragen beantwortet`} />
  </div>;
}

function Identity({ avatarId, name }: { avatarId: string; name: string }) {
  return <span className="async-identity"><Avatar avatarId={avatarId} /><span>{name}</span></span>;
}

export function AsyncPlayerPage() {
  useNoIndex();
  const { token = "" } = useParams();
  return <AsyncPlayer key={token} token={token} />;
}

function AsyncPlayer({ token }: { token: string }) {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [state, setState] = useState<AsyncGuestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Tapped answer (sending or failed); always belongs to exactly one question.
  const [choice, setChoice] = useState<{ questionIndex: number; id: string } | null>(null);
  // After a confirmed answer the quiz pauses until the player opens the next question.
  const [pausedAfter, setPausedAfter] = useState<PausedAfter | null>(null);
  const [reviewedFinal, setReviewedFinal] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);
  const [rankBeforeAnswer, setRankBeforeAnswer] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  // Server time decides; the offset corrects a wrong client clock for display and button state.
  const [clockOffset, setClockOffset] = useState(0);
  // Discards late responses of older requests (double click, retry, multiple tabs).
  const requestSeqRef = useRef(0);
  usePageTitle(info?.title ?? "Quiz zum Mitmachen");
  const syncClock = useCallback((serverTime?: number | null) => {
    if (typeof serverTime === "number") setClockOffset(serverTime - Date.now());
    setClock(Date.now());
  }, []);
  const applyState = useCallback((next: AsyncGuestState) => {
    syncClock(next.serverTime);
    setState(next);
  }, [syncClock]);
  const now = clock + clockOffset;
  const expiresAt = info?.expiresAt;
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (expiresAt === undefined) return;
    const remaining = expiresAt - (Date.now() + clockOffset);
    if (remaining <= 0 || remaining > 2_147_000_000) return;
    const timer = window.setTimeout(() => setClock(Date.now()), remaining + 250);
    return () => window.clearTimeout(timer);
  }, [expiresAt, clockOffset]);
  const deadlinePassed = expiresAt !== undefined && now >= expiresAt;
  const canAnswer = info?.status === "ACTIVE" && !deadlinePassed;
  const stateActive = state?.status === "ACTIVE";
  useEffect(() => {
    if (!deadlinePassed || !stateActive) return;
    let active = true;
    cloud.myAsyncState(token).then((latest) => {
      if (!active || !latest) return;
      setState(latest);
      setInfo((current) => current && ({ ...current, status: latest.status, endedAt: latest.endedAt }));
    }, (caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [deadlinePassed, stateActive, token]);
  useEffect(() => {
    let active = true;
    cloud.asyncPublicInfo(token).then(async (value) => {
      if (!active) return;
      syncClock(value.serverTime);
      setInfo(value);
      try {
        const existing = await cloud.myAsyncState(token);
        if (active && existing) {
          await cloud.extendGuestIdentityUntil(existing.retentionAt);
          applyState(existing);
        }
      } catch (caught) { if (active) setError(message(caught)); }
    }, (caught) => { if (active) setError(message(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, syncClock, applyState]);
  const inProgress = Boolean(state && state.status === "ACTIVE" && canAnswer && state.attemptStatus === "IN_PROGRESS");
  // Pause: next question not opened yet (speed scoring) or an answer was just confirmed (also without speed scoring).
  const finalReview = Boolean(state?.immediateReveal && state.attemptStatus === "COMPLETED" && !reviewedFinal &&
    pausedAfter?.answeredCount === state.answeredCount);
  const paused = (inProgress && (!state?.question || pausedAfter?.answeredCount === state.answeredCount)) || finalReview;
  const question = inProgress && !paused ? state?.question ?? null : null;
  const headingRef = useQuestionFocus(question ? question.questionIndex : null);
  const pauseHeadingRef = useQuestionFocus(paused && state ? `pause-${state.answeredCount}` : null);
  const tappedChoice = choice && question && choice.questionIndex === question.questionIndex ? choice.id : null;
  const rule = scoringRuleOf(state ?? info);
  function roundEnded(latest: AsyncGuestState) {
    setInfo((current) => current && ({ ...current, status: latest.status, endedAt: latest.endedAt }));
  }
  async function start() {
    setBusy(true); setError("");
    try {
      if (!info) throw new Error("Quizinformationen fehlen.");
      await cloud.extendGuestIdentityUntil(info.retentionAt);
      applyState(await cloud.startAsyncQuiz(token));
    }
    catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }
  /** Opens the next question after the pause; only now does the server start its speed bonus. */
  async function continueQuiz() {
    if (busy) return;
    if (finalReview) { setReviewedFinal(true); setPausedAfter(null); return; }
    const request = ++requestSeqRef.current;
    setBusy(true); setError(""); setAnnouncement("");
    try {
      const next = await cloud.startAsyncQuiz(token);
      if (request !== requestSeqRef.current) return;
      setPausedAfter(null);
      applyState(next);
      if (next.status !== "ACTIVE") roundEnded(next);
    } catch (caught) {
      if (request === requestSeqRef.current) setError(`Die nächste Frage konnte nicht geöffnet werden: ${message(caught)}`);
    } finally { if (request === requestSeqRef.current) setBusy(false); }
  }
  /** Applies the confirmed progress from the answer receipt as one coherent state change. */
  function applyReceipt(receipt: AsyncAnswerReceipt, answered: number, choiceId: string) {
    if (receipt.state) { applyState(receipt.state); roundEnded(receipt.state); return; }
    syncClock(receipt.serverTime);
    setState((current) => {
      if (!current || current.answeredCount > receipt.answeredCount) return current;
      return {
        ...current,
        answeredCount: receipt.answeredCount,
        nextQuestionIndex: receipt.nextQuestionIndex ?? current.nextQuestionIndex,
        attemptStatus: receipt.attemptStatus ?? current.attemptStatus,
        status: receipt.status ?? current.status,
        question: receipt.question ?? null,
        answers: [...current.answers.filter((answer) => answer.questionIndex !== answered),
          { questionIndex: answered, choiceId, acceptedAt: receipt.acceptedAt }],
      };
    });
  }
  /** A tap on a card submits the answer immediately and finally – just like in the live quiz. */
  async function submitAnswer(choiceId: string) {
    if (!question || busy || !canAnswer) return;
    const answered = question.questionIndex;
    const answers = question.answers.map(({ id, text }) => ({ id, text }));
    const choiceIndex = question.answers.findIndex((answer) => answer.id === choiceId);
    const answerLabel = `${String.fromCharCode(65 + choiceIndex)} · ${question.answers[choiceIndex]?.text ?? ""}`;
    const pauseAfter = (latest: { answeredCount: number; attemptStatus?: string | null }) => {
      if (latest.attemptStatus === "COMPLETED") setCompletedLocally(true);
      if (latest.attemptStatus === "IN_PROGRESS" || (info?.immediateReveal && latest.attemptStatus === "COMPLETED")) {
        setPausedAfter({ answeredCount: latest.answeredCount, answer: answerLabel, questionIndex: answered, choiceId, answers });
      }
    };
    const request = ++requestSeqRef.current;
    setChoice({ questionIndex: answered, id: choiceId });
    setRankBeforeAnswer(state?.rank ?? null);
    setBusy(true); setError(""); setAnnouncement("");
    try {
      const receipt = await cloud.submitAsyncAnswer(token, answered, choiceId);
      if (request !== requestSeqRef.current) return;
      if (receipt.attemptStatus && (receipt.state || (receipt.status === "ACTIVE" && !info?.immediateReveal))) {
        applyReceipt(receipt, answered, choiceId);
        pauseAfter(receipt);
        if (receipt.attemptStatus === "COMPLETED") setAnnouncement("Antwort gespeichert. Quiz abgeschlossen.");
      } else {
        // Older backends or round end: load the actually saved state instead of faking a question.
        const latest = await cloud.myAsyncState(token);
        if (request !== requestSeqRef.current || !latest) return;
        applyState(latest);
        if (latest.status !== "ACTIVE") roundEnded(latest);
        pauseAfter(latest);
        setAnnouncement("Antwort gespeichert.");
      }
    } catch (caught) {
      if (request !== requestSeqRef.current) return;
      try {
        const latest = await cloud.myAsyncState(token);
        if (request !== requestSeqRef.current) return;
        const saved = latest?.answers.find((answer) => answer.questionIndex === answered);
        if (latest) applyState(latest);
        if (latest && saved?.choiceId === choiceId) {
          pauseAfter(latest);
          setAnnouncement("Antwort gespeichert.");
        } else if (latest && latest.status !== "ACTIVE") {
          roundEnded(latest);
          setError("Die Runde ist beendet. Deine Antwort wurde nicht mehr angenommen.");
        } else {
          setError(saved
            ? "Ein anderer Tab hat bereits eine Antwort bestätigt. Der Serverstand wurde geladen."
            : `Antwort nicht bestätigt: ${message(caught)} Tippe noch einmal auf deine Antwort.`);
        }
      } catch {
        setError(`Antwort nicht bestätigt: ${message(caught)} Prüfe die Verbindung und tippe dann noch einmal auf deine Antwort.`);
      }
    } finally { if (request === requestSeqRef.current) setBusy(false); }
  }
  const status = <p className="rl-visually-hidden" role="status" aria-live="polite">{announcement}</p>;
  const nearDeadline = state ? state.expiresAt - now <= 10 * 60 * 1000 : false;
  const deadlineWarning = nearDeadline && state && <div className="async-deadline-warning">
    <p role="status">Weniger als zehn Minuten bis zum Ende.</p>
    <DeadlineTimer deadline={state.expiresAt} offset={clockOffset} />
  </div>;
  const resultAvailable = Boolean(state && (state.status !== "ACTIVE" || state.immediateReveal) &&
    state.points != null && state.answers.length >= state.answeredCount &&
    state.answers.every((answer) => answer.correct != null) &&
    state.results.filter((result) => result.answered && result.correct != null).length >= state.answeredCount);
  const lastAnswerCorrect = state?.answers.find((answer) => answer.questionIndex === state.answeredCount - 1)?.correct === true;
  // Only show the score once the server revealed it – hidden scores must never leak into the header.
  const aside = resultAvailable && state?.points != null ? <ScorePill score={state.points} /> : undefined;

  if (!loading && info && state && paused) {
    const justAnswered = pausedAfter?.answeredCount === state.answeredCount ? pausedAfter : null;
    const nextQuestion = state.answeredCount + 1;
    const lastAnswer = state.immediateReveal ? state.answers.find((answer) => answer.questionIndex === state.answeredCount - 1) : null;
    const answerResult = lastAnswer?.correct == null ? null : lastAnswer;
    const revealCards = answerResult && justAnswered?.questionIndex === answerResult.questionIndex ? justAnswered : null;
    const correctId = revealCards && answerResult
      ? answerResult.correctChoiceId ?? revealCards.answers.find((answer) => answer.text === answerResult.correctText)?.id
      : undefined;
    const mood = answerResult ? answerResult.correct ? "cheering" : "surprised" : "curious";
    const momentClass = answerResult ? answerResult.correct ? "is-correct" : "is-wrong"
      : justAnswered ? "async-moment-saved" : "async-moment-ready";
    return <ScreenLayout size="play" aside={aside} className="async-screen">
      <section className="async-pause" key={`pause-${state.answeredCount}`} aria-labelledby="async-pause-title">
        <div className="async-meta">
          <Identity avatarId={state.avatarId} name={state.displayName} />
          <span className="rl-pill rl-pill-gray async-meta-pause">Pause</span>
        </div>
        {deadlineWarning}
        <div className={`async-moment ${momentClass}`}>
          <LlamaCharacter mood={mood} className="async-moment-llama" />
          <h1 id="async-pause-title" className="async-pause-title" ref={pauseHeadingRef} tabIndex={-1}>
            {answerResult ? answerResult.correct ? "Richtig!" : "Leider daneben" :
              justAnswered ? "Antwort gespeichert" : `Bereit für Frage ${nextQuestion}?`}</h1>
        </div>
        {justAnswered && <p className="async-pause-answer">Deine Antwort: <strong>{justAnswered.answer}</strong></p>}
        {revealCards && correctId && <AnswerCards answers={revealCards.answers} selectedId={revealCards.choiceId}
          correctId={correctId} columns={answerColumns(revealCards.answers)} label="Auflösung" />}
        {answerResult && <div className="personal-result">
          {answerResult.correct === false && <Encouragement />}
          <ScoreAward key={answerResult.questionIndex} points={answerResult.points ?? 0}
            extra={answerResult.streakBonusPoints} streak={answerResult.streak} badges={state.badges}
            celebrate={Boolean(justAnswered) && answerResult.correct === true}
            eventId={`${token}:${state.startedAt}:points:${answerResult.questionIndex}`} />
          <p className="result-total"><strong><AnimatedPoints value={state.points ?? 0}
            from={justAnswered && answerResult.correct ? (state.points ?? 0) - (answerResult.points ?? 0) : state.points ?? 0} /> Punkte</strong> insgesamt</p>
          {state.rank != null && <p className="async-rank">Aktuell Platz <strong>{state.rank}</strong></p>}
          {rankBeforeAnswer != null && state.rank != null && <RankRise change={rankBeforeAnswer - state.rank}
            eventId={`${token}:${state.startedAt}:rank:${answerResult.questionIndex}`}
            celebrate={Boolean(justAnswered) && answerResult.correct === true} />}
          <Achievements streak={state.streak} maxStreak={state.maxStreak} badges={state.badges} />
          {answerResult.correct === false && answerResult.correctText
            ? <ExplanationCard correctText={answerResult.correctText} explanation={answerResult.explanation ?? undefined} timedOut={false} />
            : <>
              {answerResult.correctText && <p className="async-correct-answer">Richtige Antwort: <strong>{answerResult.correctText}</strong></p>}
              {answerResult.explanation && <p className="async-explanation">{answerResult.explanation}</p>}
            </>}
          {rule && <p className="async-score-line">Grundpunkte {pointsText(answerResult.basePoints ?? 0)} · Tempo-Bonus {pointsText(answerResult.bonusPoints ?? 0)}
            {" · "}Streak-Bonus {pointsText(answerResult.streakBonusPoints ?? 0)}</p>}
        </div>}
        <AsyncProgress answered={state.answeredCount} total={state.questionCount} />
        <ErrorNotice error={error} />
        <button type="button" className="rl-btn rl-btn-primary rl-btn-large async-continue" disabled={busy} onClick={() => void continueQuiz()}>
          {busy ? "Frage wird geöffnet …" : <>{finalReview ? "Zum persönlichen Abschluss" : `Weiter zu Frage ${nextQuestion}`}<ArrowRight aria-hidden="true" /></>}
        </button>
        <p className="async-pause-hint">Du kannst hier eine Pause machen und bis {formatDateTimeWithZone(state.expiresAt, state.timeZone)} weiterspielen
          – auf diesem Gerät über diesen Link oder den Quiz-Code.{rule && " Der Tempo-Bonus startet erst, wenn du die nächste Frage öffnest."}
          {" "}{state.immediateReveal ? "Dein Ergebnis siehst du direkt nach jeder Antwort." : "Ob du richtig liegst, siehst du nach Ende der Runde."}</p>
        {status}
      </section>
    </ScreenLayout>;
  }
  if (!loading && info && state && question) {
    const failed = !busy && error ? tappedChoice : null;
    const tappedIndex = question.answers.findIndex((answer) => answer.id === tappedChoice);
    const tappedLabel = tappedIndex >= 0 ? `${String.fromCharCode(65 + tappedIndex)} · ${question.answers[tappedIndex].text}` : "";
    return <ScreenLayout size="play" aside={aside} className="async-screen">
      <section className="async-question" key={`question-${question.questionIndex}`} aria-labelledby="async-question-title">
        <div className="async-meta">
          <Identity avatarId={state.avatarId} name={state.displayName} />
          <QuestionPosition index={question.questionIndex} total={state.questionCount} />
          {rule && question.startedAt != null &&
            <SpeedBonus key={`${question.questionIndex}-${question.startedAt}`} startedAt={question.startedAt} offset={clockOffset} rule={rule} />}
        </div>
        {deadlineWarning}
        <h1 id="async-question-title" className="rl-question async-question-title" ref={headingRef} tabIndex={-1}>{question.text}</h1>
        <AnswerCards answers={question.answers} columns={answerColumns(question.answers)}
          pendingId={busy ? tappedChoice : null} locked={busy || !canAnswer} onSelect={(id) => void submitAnswer(id)} />
        <ErrorNotice error={error} />
        <div className={`answer-feedback${busy && tappedChoice ? " is-pending" : failed ? " is-failed" : ""}`} role="status" aria-atomic="true">
          <Timer aria-hidden="true" />
          <span>{busy && tappedChoice ? <><strong>Wird gesendet …</strong> {tappedLabel}</> :
            failed ? <><strong>Nicht gespeichert:</strong> {tappedLabel} · Tippe erneut auf eine Antwort.</> :
            "Tippe auf eine Antwort – sie wird direkt abgegeben."}</span>
        </div>
        {status}
        <details className="rl-details async-help">
          <summary>Hinweise und Fortschritt</summary>
          <div className="rl-details-body">
            <AsyncProgress answered={state.answeredCount} total={state.questionCount} />
            <p>Deine Antwort zählt sofort und lässt sich danach nicht mehr ändern. {state.immediateReveal
              ? "Lösung und Punkte siehst du direkt nach der Antwort." : "Ob du richtig liegst, siehst du nach Ende der Runde."}</p>
            <p>Nach jeder Antwort kannst du eine Pause machen und später auf diesem Gerät weiterspielen.</p>
            {rule && <p>{speedIntro(rule)} Der Tempo-Bonus sinkt in den ersten {Math.round(rule.bonusWindowMs / 1000)} Sekunden
              je Frage auf null; die Zeit misst der Server ab dem Öffnen der Frage, einschließlich Übertragung.</p>}
            <p>{info.title} · Mitspielen bis {formatDateTimeWithZone(info.expiresAt, info.timeZone)}</p>
          </div>
        </details>
      </section>
    </ScreenLayout>;
  }
  return <ScreenLayout size="play" aside={aside} className="async-screen">
    <div className="async-start">
      <Link className="async-back" to={routes.home}><ArrowLeft aria-hidden="true" /> Zur Startseite</Link>
      {loading ? <LoadingNotice>Quiz wird geladen …</LoadingNotice> : !info ? <div className="rl-card async-card async-unavailable">
        <LlamaCharacter mood="surprised" className="async-unavailable-llama" />
        <h1 className="rl-h1">Quizrunde nicht verfügbar</h1>
        <p>{error || "Dieser Link oder Quiz-Code ist ungültig oder die Ergebnisse wurden bereits gelöscht."}</p>
        <p><Link className="rl-btn rl-btn-secondary" to={routes.join()}>Quiz-Code eingeben</Link></p>
      </div> : <>
        <header className="async-quiz-heading">
          <span className="rl-eyebrow">Quiz zum Mitmachen · Spiele in deinem Tempo</span>
          <h1 className="rl-h1">{info.title}</h1>
          {info.description && <p className="rl-lead">{info.description}</p>}
          <p className="async-deadline"><Clock3 aria-hidden="true" /> Mitspielen bis {formatDateTimeWithZone(info.expiresAt, info.timeZone)}</p>
          <p>{info.questionCount} Fragen. Deine Antworten werden einzeln gespeichert. Maximal {info.maxParticipants} Teilnahmen.</p>
        </header>
        <ErrorNotice error={error} />
        {status}
        {state ? <section className="rl-card async-card async-player-card">
          <div className="async-player-identity"><Avatar avatarId={state.avatarId} /><strong>{state.displayName}</strong></div>
          <h2 className="rl-h2">{state.attemptStatus === "COMPLETED" ? "Quiz abgeschlossen" : "Quiz beendet"}</h2>
          {state.attemptStatus === "COMPLETED" && <Finale winner={resultAvailable && state.status !== "ACTIVE" && state.rank === 1}
            celebrate={completedLocally && resultAvailable && lastAnswerCorrect} eventId={`${token}:${state.startedAt}:finale`} />}
          <p>{state.answeredCount} von {state.questionCount} Fragen beantwortet.
            {state.attemptStatus === "EXPIRED_PARTIAL" && " Nicht beantwortete Fragen zählen als 0 Punkte."}</p>
          {state.status === "ACTIVE" && !state.immediateReveal && <p>Deine Antworten sind gespeichert. Auflösung und Ergebnis siehst du nach Ende der Runde
            ({formatDateTimeWithZone(state.expiresAt, state.timeZone)}) über diesen Link oder denselben Quiz-Code.</p>}
          {(state.status !== "ACTIVE" || state.immediateReveal) && !resultAvailable &&
            <p role="status">Dein Ergebnis ist noch nicht vollständig verfügbar.</p>}
          {resultAvailable && <>
            <p className="async-own-total">Dein Ergebnis: <strong>
              <AnimatedPoints value={state.points ?? 0} />{rule ? " Punkte" : ` von ${state.questionCount} Punkten`}</strong></p>
            {state.rank != null && <p className="async-rank">{state.status === "ACTIVE" ? "Vorläufig" : "Endstand"}: Platz <strong>{state.rank}</strong></p>}
            <Achievements streak={state.streak} maxStreak={state.maxStreak} badges={state.badges} />
            {rule && <p className="rl-hint">Wertung: {pointsText(rule.basePoints)} Grundpunkte je richtiger Antwort plus bis zu
              {" "}{pointsText(rule.maxBonusPoints)} Punkte Tempo-Bonus.</p>}
            <ol className="async-own-results">{state.results.map((result) => <li key={result.questionIndex}
              className={result.answered ? result.correct ? "is-correct" : "is-wrong" : "is-missing"}>
              <strong>Frage {result.questionIndex + 1}: {result.questionText}</strong>
              <p>{result.answered ? result.correct ? "Richtig." : "Falsch." : "Nicht beantwortet."}</p>
              {result.selectedText && <p>Deine Antwort: {result.selectedText}.</p>}
              {result.correctText && <p>Richtige Antwort: {result.correctText}.</p>}
              {rule && result.answered && <p className="async-score-line">
                Grundpunkte {pointsText(result.basePoints ?? 0)} · Tempo-Bonus {pointsText(result.bonusPoints ?? 0)} ·
                Streak-Bonus {pointsText(result.streakBonusPoints ?? 0)} ·
                Gesamt <strong>{pointsText(result.points ?? 0)}</strong>
                {result.elapsedMs != null && ` · Antwortzeit ${secondsText(result.elapsedMs)}`}</p>}
              {result.explanation && <p>{result.explanation}</p>}
            </li>)}</ol>
          </>}
        </section> : info.status === "ACTIVE" && canAnswer ? <section className="rl-card async-card async-player-card">
          <h2 className="rl-h2">Du spielst in deinem Tempo</h2>
          <p>Deine Antworten werden gespeichert. Du kannst bis {formatDateTimeWithZone(info.expiresAt, info.timeZone)} mitspielen.</p>
          {rule && <p className="async-speed-intro"><Zap aria-hidden="true" /> {speedIntro(rule)}</p>}
          <p>{info.immediateReveal ? "Lösung, Punkte und Serie siehst du sofort nach jeder Antwort." : "Die Auflösung folgt nach Ende der Runde."}
            {" "}{info.streakBonusEnabled ? "Streak-Bonuspunkte sind aktiv." : "Streak-Bonuspunkte sind aus; sammle trotzdem Serien und Abzeichen."}</p>
          <button type="button" className="rl-btn rl-btn-primary rl-btn-large async-start-button" disabled={busy} onClick={() => void start()}>
            {busy ? "Quiz wird geöffnet …" : "Quiz starten"}
          </button>
        </section> : <section className="rl-card async-card async-player-card">
          <LlamaCharacter mood="proud" className="async-ended-llama" />
          <h2 className="rl-h2">Diese Quizrunde ist beendet</h2>
          <p>Die Quizrunde endete am {formatDateTimeWithZone(info.endedAt ?? info.expiresAt, info.timeZone)}.</p>
        </section>}
      </>}
    </div>
  </ScreenLayout>;
}
