import { useState, type SyntheticEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { AsyncStandingParticipant } from "../../cloud";
import type { AsyncScoringRule } from "../../domain/scoring";
import { formatDateTimeInZone, formatDateTimeWithZone } from "../../domain/localTime";
import { ASYNC_DETAIL_PAGE_SIZE, matchesAsyncDetail, useAsyncParticipantDetails, useAsyncStandings } from "../../hooks/useAsyncStandings";
import { useNoIndex } from "../../hooks/useNoIndex";
import { ErrorNotice, LoadingNotice, Notice } from "../common/Notices";
import { AnimatedPoints } from "../game/AnimatedPoints";
import { Avatar } from "../game/Avatar";
import { useFinaleTransition } from "../game/events";
import { Leaderboard, Podium } from "../game/Ranking";
import { Finale, RankRise } from "../game/Rewards";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import { asyncStatusText, attemptStatusText, pointsText, scoringRuleOf, secondsText } from "./asyncFormat";
import { StandingsPresentation } from "./StandingsPresentation";
import "../quizzes.css";
import "./async.css";

function AsyncLeaderRow({ player, rule, questionCount }: { player: AsyncStandingParticipant; rule: AsyncScoringRule | null; questionCount: number }) {
  const reduced = useReducedMotion();
  return <motion.li layout={reduced ? false : "position"} className="async-leader">
    <span className={`async-leader-rank${(player.rankChange ?? 0) > 0 ? " is-gained" : ""}`}
      aria-label={`Rang ${player.rank}`}>{player.rank}.</span>
    <Avatar avatarId={player.avatarId} />
    <span className="async-leader-name">{player.displayName}</span>
    <strong className="async-leader-points"><AnimatedPoints value={player.points}
      from={player.previousPoints ?? player.points} />{rule ? " P." : `/${questionCount}`}</strong>
    <span className="async-leader-status">{attemptStatusText(player.status)}</span>
  </motion.li>;
}

export function AsyncResultsPage() {
  useNoIndex();
  const { publicationId = "" } = useParams();
  return <AsyncResults key={publicationId} publicationId={publicationId} />;
}

function AsyncResults({ publicationId }: { publicationId: string }) {
  const { standings: results, loading, error, expired, refreshing, refresh } = useAsyncStandings(publicationId);
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "PARTIAL">("ALL");
  const [sort, setSort] = useState<"RANK" | "NAME" | "START">("RANK");
  const [rankingLimit, setRankingLimit] = useState(ASYNC_DETAIL_PAGE_SIZE);
  const [detailLimit, setDetailLimit] = useState(ASYNC_DETAIL_PAGE_SIZE);
  const [presenting, setPresenting] = useState(false);
  const [open, setOpen] = useState({ questions: false, players: false, info: false });
  usePageTitle(results ? `Ergebnisse: ${results.title}` : "Ergebnisse");
  const celebrateFinal = useFinaleTransition(results?.isFinal, !presenting && !error);
  const participantDetails = useAsyncParticipantDetails(publicationId, results, open.players && !presenting, detailLimit);
  const toggle = (key: keyof typeof open) => (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    setOpen((current) => current[key] === isOpen ? current : { ...current, [key]: isOpen });
  };
  const rule = scoringRuleOf(results);
  const leaders = results?.participants.slice(0, 3) ?? [];
  const others = results?.participants.slice(3, rankingLimit) ?? [];
  const total = results?.totalParticipants ?? 0;
  const formatPoints = !rule && results ? (points: number) => `${points}/${results.questions.length}` : pointsText;
  const rankingPlayers = (players: AsyncStandingParticipant[]) => players.map((player) => ({ ...player, participantId: player.attemptId }));
  const moreRanks = results && rankingLimit < total && <button type="button" className="rl-btn rl-btn-secondary async-more-ranks" onClick={() =>
    setRankingLimit((value) => value + ASYNC_DETAIL_PAGE_SIZE)}>Weitere Plätze anzeigen</button>;
  return <div className="async-admin-page async-results-page">
    <Link className="async-back" to={routes.admin}><ArrowLeft aria-hidden="true" /> Zur Übersicht</Link>
    <ErrorNotice error={error} />
    {loading && !results ? <LoadingNotice>Ergebnisse werden geladen …</LoadingNotice> : !results ? <div className="rl-card async-card">
      <p>Ergebnisse nicht verfügbar.</p>
      {!expired && <p><button type="button" className="rl-btn rl-btn-secondary" disabled={refreshing} onClick={refresh}>Erneut versuchen</button></p>}
    </div> : <div className="async-admin-results">
      <header className="async-admin-head">
        <div className="async-admin-head-text">
          <span className="rl-eyebrow">Quiz zum Mitmachen</span>
          {!results.isFinal && <h1 className="rl-h1">{results.title}</h1>}
        </div>
        <div className="async-admin-head-actions">
          {!results.isFinal && <span className={`rl-pill ${results.status === "ACTIVE" ? "rl-pill-green" : "rl-pill-gray"} async-status-${results.status.toLowerCase()}`}>
            {asyncStatusText(results.status)}</span>}
          <StandingsPresentation standings={results} statusText={asyncStatusText(results.status)} formatPoints={formatPoints}
            error={error} refreshing={refreshing} onRefresh={refresh} onPresentationChange={setPresenting} />
          <button type="button" className="rl-btn rl-btn-secondary rl-btn-small" disabled={refreshing} onClick={refresh}>
            <RefreshCw aria-hidden="true" />{refreshing ? "Wird aktualisiert …" : "Aktualisieren"}</button>
        </div>
      </header>
      {results.isFinal ? <div className="rl-card async-card async-final-view">
        <header className="async-final-head">
          <p className="async-final-title">{results.title}</p>
          <span className="rl-pill rl-pill-orange async-phase-badge" role="status">{asyncStatusText(results.status)}</span>
        </header>
        <section className="async-final" aria-labelledby="async-ranking-title">
          <span className="rl-eyebrow">Das war eure Runde</span>
          <h1 id="async-ranking-title" className="rl-h1">Endstand</h1>
          {leaders.length > 0 && <Finale shared celebrate={celebrateFinal} eventId={`${publicationId}:admin:finale`} />}
          <p className="async-final-intro">Zusammen gerätselt. Gemeinsam gefeiert.</p>
          {leaders.length === 0 ? <p>Noch keine Teilnehmenden.</p> : <>
            <Podium players={rankingPlayers(leaders)} formatPoints={formatPoints} />
            {others.length > 0 && <Leaderboard players={rankingPlayers(others)} formatPoints={formatPoints} />}
          </>}
          {moreRanks}
        </section>
        <p className="async-final-footnote">{total} Teilnehmende · Gemeinsam rätseln, gemeinsam staunen.</p>
      </div> : <section className="rl-card async-card async-leaders" aria-labelledby="async-leaders-title">
        <div className="async-leaders-head">
          <h2 id="async-leaders-title" className="rl-h2">Zwischenstand</h2>
          <span className="rl-pill rl-pill-green">Vorläufig</span>
        </div>
        {(leaders[0]?.rankChange ?? 0) > 0 && (leaders[0]?.previousRank ?? 0) > 1 &&
          <RankRise change={leaders[0].rankChange ?? 0} eventId={`${publicationId}:leader:${results.updatedAt}`} celebrate />}
        {leaders.length === 0 ? <p className="rl-hint">Noch keine Teilnahmen. Sobald jemand startet, erscheint hier die Rangliste.</p> :
          <>
            <Podium players={rankingPlayers(leaders).map((player) => ({
              ...player, detail: player.status === "COMPLETED" ? "fertig" : attemptStatusText(player.status),
            }))}
              final={false} formatPoints={formatPoints} />
            {others.length > 0 && <ol className="async-leader-list" aria-label="Weitere Plätze">
              {others.map((player) =>
                <AsyncLeaderRow key={player.attemptId} player={player} rule={rule} questionCount={results.questions.length} />)}
            </ol>}
          </>}
        {moreRanks}
      </section>}
      <p className="async-summary-line">{results.participantCount} von {results.maxParticipants} gestartet ·
        {" "}{results.completedCount} abgeschlossen · {results.partialCount} unvollständig ·
        {" "}{results.isFinal ? "Endergebnis" : "weitere Antworten möglich"} ·
        {" "}Aktualisiert: {new Date(results.updatedAt).toLocaleTimeString("de-DE")}</p>
      <details className="rl-details async-admin-section" open={open.questions} onToggle={toggle("questions")}>
        <summary><h2>Fragenauswertung</h2></summary>
        <div className="rl-details-body async-question-stats">
          {results.questions.map((question) => <article className="async-question-stat" key={question.questionIndex}>
            <h3>Frage {question.questionIndex + 1}: {question.text}</h3>
            <p className="rl-hint">{question.answeredCount} Antworten · {results.participantCount - question.answeredCount} nicht beantwortet</p>
            {question.answeredCount === 0 ? <p>Noch keine Antworten.</p> : <ul className="async-option-stats">
              {question.options.map((option) => {
                const percent = Math.round(option.count / question.answeredCount * 100);
                return <li key={option.id} className={option.correct ? "async-correct-option" : ""}>
                  <span>{option.text}: {option.count} ({percent}%){option.correct && " · richtig"}</span>
                  <span className="async-option-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                </li>;
              })}
            </ul>}
          </article>)}
        </div>
      </details>
      <details className="rl-details async-admin-section" open={open.players} onToggle={toggle("players")}>
        <summary><h2>Teilnehmerdetails</h2></summary>
        <div className="rl-details-body">
          <div className="async-filters">
            <label className="rl-field"><span className="rl-field-label">Anzeigen</span>
              <select className="rl-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="ALL">Alle</option><option value="COMPLETED">Abgeschlossen</option><option value="PARTIAL">Unvollständig</option>
              </select></label>
            <label className="rl-field"><span className="rl-field-label">Sortieren nach</span>
              <select className="rl-select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="RANK">Rang</option><option value="NAME">Name</option><option value="START">Startzeit</option>
              </select></label>
          </div>
          {filter !== "ALL" && <p className="rl-hint">Die Ränge beziehen sich immer auf alle Teilnahmen.</p>}
          {participantDetails.error && <Notice tone="warning"><span>{participantDetails.error}</span>
            {" "}<button type="button" className="rl-btn rl-btn-secondary rl-btn-small" onClick={participantDetails.retry}>Erneut versuchen</button></Notice>}
          {participantDetails.loading && <p className="rl-hint" role="status">Teilnehmerdetails werden aktualisiert …</p>}
          {results.participants.length === 0 ? <p>Noch keine Teilnehmer.</p> :
          <div className="async-result-players">{results.participants.slice(0, detailLimit)
            .filter((player) => filter === "ALL" || (filter === "COMPLETED") === (player.status === "COMPLETED"))
            .sort((left, right) => sort === "NAME" ? left.displayName.localeCompare(right.displayName, "de")
              : sort === "START" ? left.startedAt - right.startedAt : left.rank - right.rank)
            .map((player) => {
            const cached = participantDetails.details.get(player.attemptId);
            const detail = matchesAsyncDetail(cached, player) ? cached : undefined;
            const correctCount = detail?.answers.filter((answer) => answer.correct).length ?? 0;
            const wrongCount = (detail?.answers.length ?? 0) - correctCount;
            const answerByIndex = new Map(detail?.answers.map((answer) => [answer.questionIndex, answer]) ?? []);
            return <details className="async-result-player" key={player.attemptId}><summary>
              <span className="async-player-identity"><Avatar avatarId={player.avatarId} />
                <strong>Rang {player.rank} · {player.displayName}</strong></span>
              <span>{rule ? `${pointsText(player.points)} Punkte` : `${player.points}/${player.questionCount} Punkte`} · {attemptStatusText(player.status)}</span>
              <span>{detail ? `${correctCount} richtig · ${wrongCount} falsch · ${player.questionCount - detail.answers.length} nicht beantwortet`
                : participantDetails.loading ? "Antwortdetails werden aktualisiert …" : "Antwortdetails nicht aktuell."}</span>
              <span className="rl-hint">Start: {formatDateTimeInZone(player.startedAt, results.timeZone)}
                {player.completedAt ? ` · Abschluss: ${formatDateTimeInZone(player.completedAt, results.timeZone)}` : ""}</span>
            </summary>{detail ? <ol>{results.questions.map((question) => {
              const answer = answerByIndex.get(question.questionIndex);
              const correct = question.options.find((item) => item.correct);
              if (!answer) return <li key={question.questionIndex}><strong>{question.text}</strong><p>Nicht beantwortet
                (richtig: {correct?.text ?? "unbekannt"})</p></li>;
              const option = question.options.find((item) => item.id === answer.choiceId);
              return <li key={question.questionIndex} className={answer.correct ? "is-correct" : "is-wrong"}>
                <strong>{question.text}</strong><p>Antwort: {option?.text ?? "Unbekannt"}
                {answer.correct ? " · richtig" : ` · falsch (richtig: ${correct?.text ?? "unbekannt"})`}</p>
                {rule && <p className="async-score-line">Grundpunkte {pointsText(answer.basePoints ?? 0)} · Tempo-Bonus {pointsText(answer.bonusPoints ?? 0)} ·
                  Streak-Bonus {pointsText(answer.streakBonusPoints ?? 0)} ·
                  Gesamt <strong>{pointsText(answer.points ?? 0)}</strong>
                  {answer.elapsedMs != null && ` · Antwortzeit ${secondsText(answer.elapsedMs)}`}</p>}
                <p className="rl-hint">{formatDateTimeInZone(answer.acceptedAt, results.timeZone)}</p></li>;
            })}</ol> : <p className="rl-hint">Die Antwortdetails sind noch nicht aktuell.</p>}</details>;
          })}</div>}
          {detailLimit < total && <button type="button" className="rl-btn rl-btn-secondary" disabled={participantDetails.loading}
            onClick={() => setDetailLimit((value) => value + ASYNC_DETAIL_PAGE_SIZE)}>Weitere Teilnehmer laden</button>}
        </div>
      </details>
      <details className="rl-details async-admin-section" open={open.info} onToggle={toggle("info")}>
        <summary><h2>Quizinformationen</h2></summary>
        <div className="rl-details-body">
          <p>Veröffentlicht: {formatDateTimeInZone(results.createdAt, results.timeZone)} ·
            Mitspielen bis: {formatDateTimeWithZone(results.expiresAt, results.timeZone)} ({results.timeZone})
            {results.endedAt && results.endedAt !== results.expiresAt &&
              ` · Tatsächliches Ende: ${formatDateTimeInZone(results.endedAt, results.timeZone)}`}</p>
          <p>Aktualisiert: {new Date(results.updatedAt).toLocaleString("de-DE")}</p>
          <p>{rule ? `Wertung: ${pointsText(rule.basePoints)} Grundpunkte je richtiger Antwort plus bis zu ${pointsText(rule.maxBonusPoints)} Punkte Tempo-Bonus, linear fallend in den ersten ${Math.round(rule.bonusWindowMs / 1000)} Sekunden ab serverseitiger Freigabe der Frage. Kein hartes Zeitlimit pro Frage.`
            : "Wertung: ein Punkt je richtiger Antwort (ältere Veröffentlichung ohne Tempo-Bonus)."}</p>
          <p className="rl-hint">Gleich viele Punkte ergeben denselben Rang. Innerhalb eines Gleichstands wird nur zur Anzeige alphabetisch nach Spielname sortiert.</p>
        </div>
      </details>
    </div>}
  </div>;
}
