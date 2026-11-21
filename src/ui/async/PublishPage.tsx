import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, Presentation as PresentationIcon } from "lucide-react";
import { cloud, type QuizRecord } from "../../cloud";
import { legal } from "../../config/legal";
import { ASYNC_MAX_DURATION_DAYS, ASYNC_MAX_DURATION_MS } from "../../domain/limits";
import { formatDateTimeInZone, formatDateTimeWithZone, possibleInstants } from "../../domain/localTime";
import { displayQuizLink, shortQuizLink } from "../../shareLinks";
import { CopyAction } from "../common/CopyAction";
import { JoinCodeBlock } from "../common/JoinCodeBlock";
import { message } from "../common/message";
import { ErrorNotice, LoadingNotice, Notice } from "../common/Notices";
import { StreakBonusOption } from "../game/Rewards";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import { toLocalInput } from "./asyncFormat";
import "../quizzes.css";
import "./async.css";

type PublishReceipt = Awaited<ReturnType<typeof cloud.publishAsyncQuiz>>;
type PublishRequest = { expiresAt: number; timeZone: string; id: string; streakBonusEnabled: boolean; immediateReveal: boolean };

export function PublishPage() {
  usePageTitle("Quizrunde veröffentlichen");
  const [streakBonusEnabled, setStreakBonusEnabled] = useState(false);
  const [immediateReveal, setImmediateReveal] = useState(true);
  const { quizId = "" } = useParams();
  const [record, setRecord] = useState<QuizRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [pickedInstant, setPickedInstant] = useState("");
  const [publication, setPublication] = useState<PublishReceipt | null>(null);
  const requestIdRef = useRef<PublishRequest | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const instants = useMemo(() => localDate ? possibleInstants(localDate, timeZone) : [], [localDate, timeZone]);
  // A unique local time selects itself; an ambiguous one (DST fall-back) needs an explicit choice among its instants.
  const selectedInstant = instants.length === 1 ? String(instants[0])
    : instants.some((instant) => String(instant) === pickedInstant) ? pickedInstant : "";
  const [bounds] = useState(() => ({ min: toLocalInput(Date.now()), max: toLocalInput(Date.now() + ASYNC_MAX_DURATION_MS) }));
  useEffect(() => {
    let active = true;
    cloud.getQuiz(quizId).then((value) => { if (active) setRecord(value); },
      (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId]);
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!record || !selectedInstant) return;
    const expiresAt = Number(selectedInstant);
    if (expiresAt <= Date.now()) { setError("Das Ende muss in der Zukunft liegen."); return; }
    if (expiresAt > Date.now() + ASYNC_MAX_DURATION_MS) {
      setError(`Das Ende darf höchstens ${ASYNC_MAX_DURATION_DAYS} Tage in der Zukunft liegen.`); return;
    }
    let request = requestIdRef.current;
    if (!request || request.expiresAt !== expiresAt || request.timeZone !== timeZone ||
        request.streakBonusEnabled !== streakBonusEnabled || request.immediateReveal !== immediateReveal) {
      request = { expiresAt, timeZone, id: crypto.randomUUID(), streakBonusEnabled, immediateReveal };
      requestIdRef.current = request;
    }
    setBusy(true); setError("");
    try {
      const result = await cloud.publishAsyncQuiz(record.quizId, request.id, expiresAt, timeZone, streakBonusEnabled, immediateReveal);
      setPublication(result);
      requestIdRef.current = null;
    } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  return <div className="async-admin-page async-publish-page">
    <Link className="async-back" to={routes.admin}><ArrowLeft aria-hidden="true" strokeWidth={2.6} />Zur Übersicht</Link>
    <header className="async-page-head">
      <span className="rl-eyebrow">QUIZ ZUM MITMACHEN</span>
      <h1 className="rl-h1">Quizrunde veröffentlichen</h1>
      <p className="rl-lead">Spiele in deinem Tempo: Alle Gäste spielen unabhängig bis zum angegebenen Ende. Das Live-Quiz bleibt davon unberührt.</p>
    </header>
    <ErrorNotice error={error} />
    {loading ? <LoadingNotice>Quiz wird geladen …</LoadingNotice> : !record ? <p className="rl-lead">Quiz nicht gefunden.</p> : publication
      ? <section className="rl-card async-card async-published" aria-labelledby="async-published-title">
        <span className="rl-pill rl-pill-green">Veröffentlicht</span>
        <h2 id="async-published-title" className="rl-h2">{record.quiz.title}</h2>
        <p className="async-deadline"><Clock3 aria-hidden="true" strokeWidth={2.6} /><span>Mitspielen bis{" "}
          <strong>{formatDateTimeWithZone(publication.expiresAt, publication.timeZone)}</strong></span></p>
        <JoinCodeBlock joinCode={publication.joinCode} title={record.quiz.title} />
        <p className="async-share-link">{displayQuizLink(publication.joinCode)}</p>
        <div className="rl-actions">
          <a className="rl-btn rl-btn-primary" href={routes.invitation(publication.joinCode)} target="_blank" rel="noopener">
            <PresentationIcon aria-hidden="true" />Einladung anzeigen</a>
          <CopyAction text={shortQuizLink(publication.joinCode)} label="Link kopieren" copiedMessage="Link kopiert."
            fieldLabel="Teilnahmelink" className="rl-btn rl-btn-secondary" />
        </div>
        <p className="rl-hint">Maximale Teilnehmerzahl: {publication.maxParticipants}. Ergebnisse werden {publication.retentionDays} Tage nach dem Ende aufbewahrt.</p>
        <p><Link className="rl-link" to={routes.admin}>Zur Übersicht und Ergebnisverwaltung</Link></p>
      </section>
      : <form className="rl-card async-card async-publish-form" onSubmit={(event) => void publish(event)}>
        <span className="rl-pill rl-pill-green">{record.quiz.questions.length} Fragen</span>
        <h2 className="rl-h2">{record.quiz.title}</h2>
        <div className="rl-field">
          <label className="rl-field-label" htmlFor="async-deadline"><Clock3 aria-hidden="true" />Mitspielen bis (Datum und Uhrzeit)</label>
          <input id="async-deadline" className="rl-input" type="datetime-local" required value={localDate} disabled={busy}
            min={bounds.min} max={bounds.max} aria-describedby="async-deadline-hint"
            onChange={(event) => setLocalDate(event.target.value)} />
          <span className="rl-hint" id="async-deadline-hint">Höchstens {ASYNC_MAX_DURATION_DAYS} Tage ab heute. Fragen haben kein hartes Zeitlimit; schnelle richtige Antworten erhalten in den ersten 30 Sekunden bis zu 500 Bonuspunkte zusätzlich zu 1.000 Grundpunkten.</span>
        </div>
        <p className="rl-hint">Zeitzone deines Browsers: <strong>{timeZone}</strong></p>
        {localDate && instants.length === 0 && <Notice tone="error">Diese lokale Uhrzeit existiert wegen der Zeitumstellung nicht.</Notice>}
        {instants.length > 1 && <fieldset className="rl-radio-group async-instants">
          <legend>Diese Uhrzeit kommt zweimal vor. Wähle den eindeutigen Zeitpunkt:</legend>
          {instants.map((instant) => <label className="rl-checkbox" key={instant}>
            <input type="radio" name="async-deadline-instance" value={instant} checked={selectedInstant === String(instant)}
              onChange={() => setPickedInstant(String(instant))} />
            {formatDateTimeInZone(instant, timeZone)} ({new Intl.DateTimeFormat("de-DE", {
              timeZone, timeZoneName: "longOffset", hour: "2-digit",
            }).format(instant).split(" ").at(-1)})
          </label>)}
        </fieldset>}
        <p className="rl-hint">Die Teilnehmerzahl ist begrenzt. Bis zu diesem Zeitpunkt müssen alle Antworten abgegeben sein.
          Danach sind keine neuen Starts oder Antworten möglich.</p>
        <fieldset className="rl-radio-group async-rules">
          <legend>Spielregeln</legend>
          <StreakBonusOption enabled={streakBonusEnabled} onChange={setStreakBonusEnabled} disabled={busy} />
          <label className="rl-checkbox"><input type="checkbox" checked={immediateReveal} disabled={busy}
            onChange={(event) => setImmediateReveal(event.target.checked)} />Sofortige Auflösung</label>
          <p className="rl-hint">{immediateReveal
            ? "Nach jeder Antwort sehen Gäste Lösung, Punkte und Serie. Lösungen können dadurch schon während der Runde weitergegeben werden."
            : "Lösungen, Punkte, Serien und Abzeichen bleiben bis zum Rundenende verborgen."}</p>
        </fieldset>
        <p className="rl-hint">Ergebnisse werden {legal.asyncResultsRetentionDays} Tage nach dem tatsächlichen Rundenende aufbewahrt.</p>
        <button type="submit" className="rl-btn rl-btn-primary async-publish-submit" disabled={busy || !selectedInstant || instants.length === 0}>
          {busy ? "Wird veröffentlicht …" : "Quizrunde veröffentlichen"}
        </button>
      </form>}
  </div>;
}
