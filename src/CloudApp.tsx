import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { ArrowRight, Check, Clock3, KeyRound, Plus, Presentation as PresentationIcon, Sparkles, Users, Zap } from "lucide-react";
import { cloud, type AsyncAnswerReceipt, type AsyncGuestState, type AsyncStandingParticipant, type AsyncPublicationSummary, type MyResult, type Participation, type QuizRecord, type QuizSummary, type SessionSummary } from "./cloud";
import { exampleQuiz } from "./domain/exampleQuiz";
import { QuizEditor } from "./QuizEditor";
import type { Quiz } from "./domain/quiz";
import { AdminGate } from "./AdminAuth";
import { ErrorBanner, Layout, message } from "./components/Layout";
import { HomeContent } from "./components/HomeContent";
import { AnswerTiles, Avatar, GameView, Leaderboard, Podium, phaseLabels, type PersonalStanding } from "./components/GameView";
import { PrivacyNote } from "./components/Privacy";
import { ImpressumPage, PrivacyPolicyPage } from "./components/LegalPages";
import { formatDateTimeInZone, formatDateTimeWithZone, possibleInstants } from "./domain/localTime";
import { legal } from "./config/legal";
import { useLiveState } from "./hooks/useLiveState";
import { CopyAction } from "./components/CopyLink";
import { displayQuizLink, formatJoinCode, normalizeJoinCodeInput, shortQuizLink } from "./shareLinks";
import { InvitationPage } from "./components/Invitation";
import { useNoIndex } from "./hooks/useNoIndex";
import { ASYNC_MAX_DURATION_DAYS, ASYNC_MAX_DURATION_MS } from "./domain/limits";
import { ASYNC_SPEED_V1, type AsyncScoringRule } from "./domain/scoring";
import { answerColumns, SpeedBonus, useQuestionFocus } from "./components/QuestionLayout";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AsyncStandingsPresentation } from "./components/AsyncStandingsPresentation";
import { ASYNC_DETAIL_PAGE_SIZE, matchesAsyncDetail, useAsyncParticipantDetails, useAsyncStandings } from "./hooks/useAsyncStandings";

/** Format für `<input type="datetime-local">` in der lokalen Zeitzone des Browsers. */
function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Home() {
  return <Layout><HomeContent /></Layout>;
}


const asyncStatusText = (status: string) => status === "ACTIVE" ? "Aktiv" : status === "ENDED" ? "Vorzeitig beendet" : "Abgelaufen";

/** Status einer Quizrunde zum aktuellen Zeitpunkt: Eine abgelaufene Frist zählt sofort als beendet. */
function liveAsyncStatus(status: string, expiresAt: number, now: number): string {
  return status === "ACTIVE" && now >= expiresAt ? "EXPIRED" : status;
}

function JoinCodeBlock({ joinCode, title }: { joinCode: string; title: string }) {
  return <div className="join-code-block">
    <span className="join-code-label">Quiz-Code</span>
    <strong className="join-code-digits" aria-label={`Quiz-Code ${joinCode.split("").join(" ")}`}>{formatJoinCode(joinCode)}</strong>
    <CopyAction text={joinCode} label="Code kopieren" copiedMessage="Code kopiert." fieldLabel={`Quiz-Code für ${title}`} />
  </div>;
}

function AsyncPublicationCard({ publication, busy, onEnd }: {
  publication: AsyncPublicationSummary; busy: boolean; onEnd: () => void;
}) {
  const [assigned, setAssigned] = useState<string | null>(null);
  const [assignError, setAssignError] = useState("");
  const status = liveAsyncStatus(publication.status, publication.expiresAt, Date.now());
  const active = status === "ACTIVE";
  const joinCode = publication.joinCode ?? assigned;
  const requestJoinCode = useCallback(() => {
    let live = true;
    cloud.ensureAsyncJoinCode(publication.publicationId).then((result) => { if (live) setAssigned(result.joinCode); },
      (caught) => { if (live) setAssignError(message(caught)); });
    return () => { live = false; };
  }, [publication.publicationId]);
  // Runden aus der Zeit vor den Quiz-Codes: Code einmalig serverseitig vergeben und erst nach Bestätigung anzeigen.
  useEffect(() => {
    if (!active || joinCode) return;
    return requestJoinCode();
  }, [active, joinCode, requestJoinCode]);
  return <article className={`card async-publication-card${active ? "" : " is-ended"}`}>
    <span className={`badge async-status-${status.toLowerCase()}`}>{asyncStatusText(status)}</span>
    <h3>{publication.title}</h3>
    <p className="async-card-deadline"><Clock3 size={16} aria-hidden="true" />
      {active ? "Mitspielen bis" : "Beendet am"}{" "}
      <strong>{formatDateTimeWithZone(active ? publication.expiresAt : publication.endedAt ?? publication.expiresAt, publication.timeZone)}</strong></p>
    {active && (joinCode ? <>
      <JoinCodeBlock joinCode={joinCode} title={publication.title} />
      <p className="async-card-link">{displayQuizLink(joinCode)}</p>
    </> : assignError ? <div className="error-banner" role="alert">Quiz-Code konnte nicht vergeben werden: {assignError}
      {" "}<button type="button" className="button secondary small" onClick={() => { setAssignError(""); requestJoinCode(); }}>Erneut versuchen</button></div>
      : <p className="hint" role="status">Quiz-Code wird vergeben …</p>)}
    <p className="async-card-participants"><Users size={16} aria-hidden="true" />
      {publication.participantCount}/{publication.maxParticipants} gestartet · {publication.completedCount} fertig · {publication.partialCount} offen</p>
    <div className="actions">
      {active && joinCode && <a className="button primary small" href={`/einladung/${joinCode}`} target="_blank" rel="noopener">
        <PresentationIcon size={16} aria-hidden="true" />Einladung anzeigen</a>}
      {active && joinCode && <CopyAction text={shortQuizLink(joinCode)} label="Link kopieren" copiedMessage="Link kopiert."
        fieldLabel={`Teilnahmelink für ${publication.title}`} />}
      <Link className={`button ${active ? "secondary" : "primary"} small`} to={`/admin/async/${publication.publicationId}`}>Ergebnisse ansehen</Link>
    </div>
    {active && <details className="async-card-more">
      <summary>Weitere Aktionen</summary>
      <ConfirmDialog title="Quizrunde beenden?" variant="warning" confirmLabel="Jetzt beenden"
        description={`„${publication.title}“ jetzt für alle Teilnehmenden beenden? Offene Teilnahmen enden sofort. Weitere Antworten werden nicht mehr angenommen. Link, QR-Code und Quiz-Code zeigen danach nur noch die Endseite mit Ergebnissen.`}
        onConfirm={onEnd} confirmDisabled={busy}
        trigger={<button type="button" className="button danger small" disabled={busy}>Vorzeitig beenden</button>} />
    </details>}
  </article>;
}

const ENDED_SESSION_STATUSES = new Set(["FINISHED", "CANCELLED"]);
const archivedSessionLabel = (status: string) => status === "CANCELLED" ? "Abgebrochen" : "Beendet";

/** Beendete Einträge standardmäßig eingeklappt, damit laufende Runden oben im Blick bleiben. */
function ArchiveSection({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return <details className="archive-section">
    <summary><span className="archive-label">{label}</span><span className="archive-count">{count}</span>
      <span className="archive-toggle" aria-hidden="true" /></summary>
    <ul className="archive-list">{children}</ul>
  </details>;
}

function ArchiveRow({ title, status, to, action, children }: { title: string; status: string; to: string; action: string; children: ReactNode }) {
  return <li className="archive-row">
    <div className="archive-row-main">
      <h3>{title}</h3>
      <div className="archive-row-meta"><span className="badge">{status}</span>{children}</div>
    </div>
    <Link className="button secondary small" to={to}>{action}</Link>
  </li>;
}

function Overview() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [asyncPublications, setAsyncPublications] = useState<AsyncPublicationSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const refresh = useCallback(async () => {
    const [nextQuizzes, nextSessions, nextPublications] = await Promise.all([
      cloud.listQuizzes(), cloud.listSessions(), cloud.listAsyncPublications(),
    ]);
    setQuizzes(nextQuizzes); setSessions(nextSessions); setAsyncPublications(nextPublications);
  }, []);
  useEffect(() => { let live = true; refresh().catch((caught) => { if (live) setError(message(caught)); });
    return () => { live = false; }; }, [refresh]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); await refresh(); } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await signOut(); navigate("/"); } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  const activeSessions = sessions.filter((session) => !ENDED_SESSION_STATUSES.has(session.status));
  const endedSessions = sessions.filter((session) => ENDED_SESSION_STATUSES.has(session.status));
  const now = Date.now();
  const isActivePublication = (publication: AsyncPublicationSummary) =>
    liveAsyncStatus(publication.status, publication.expiresAt, now) === "ACTIVE";
  const activePublications = asyncPublications.filter(isActivePublication);
  const endedPublications = asyncPublications.filter((publication) => !isActivePublication(publication))
    .sort((left, right) => (right.endedAt ?? right.expiresAt) - (left.endedAt ?? left.expiresAt));
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <Layout><div className="section-heading"><div><span className="eyebrow">DEINE IDEEN, DEINE BÜHNE</span><h1>Deine Quizze</h1>
    <p>Eine gute Frage ist der Anfang einer großartigen Runde.</p></div>
    <div className="actions"><Link className="button primary" to="/admin/quizzes/new"><Plus size={18} aria-hidden="true" /> Neues Quiz</Link>
      <button className="button secondary" disabled={busy} onClick={() => void logout()}>Abmelden</button></div></div>
    <ErrorBanner error={error} />
    <ul className="mode-compare" aria-label="Spielmodi">
      <li><strong>Live-Quiz</strong> – alle spielen gleichzeitig</li>
      <li><strong>Quiz zum Mitmachen</strong> – jeder spielt in seinem Tempo</li>
    </ul>
    <div className="grid">
      {quizzes.map((record) => <article className="card" key={record.quizId}><span className="badge">{record.questionCount} Fragen</span>
        <h2>{record.title}</h2><p>{record.description || "Ohne Beschreibung"}</p><div className="actions">
          <Link className="button small secondary" to={`/admin/quizzes/${record.quizId}`}>Bearbeiten</Link>
          <button className="button small primary" disabled={busy} onClick={() => void run(async () => {
            const session = await cloud.createSession(record.quizId); navigate(`/admin/sessions/${session.sessionId}`);
          })}>Live-Quiz starten</button>
          <Link className="button small secondary" to={`/admin/quizzes/${record.quizId}/publish`}>Quizrunde veröffentlichen</Link>
          <button className="button small secondary" disabled={busy} onClick={() => void run(async () => { await cloud.duplicateQuiz(record.quizId); })}>Duplizieren</button>
          <ConfirmDialog title="Quiz löschen?" confirmLabel="Quiz löschen"
            description={`„${record.title}“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
            onConfirm={() => void run(async () => { await cloud.deleteQuiz(record.quizId, record.version); })}
            confirmDisabled={busy}
            trigger={<button className="button small secondary" disabled={busy}>Löschen</button>} />
        </div></article>)}
      <button className="card add-card" disabled={busy} onClick={() => void run(async () => { await cloud.createQuiz(exampleQuiz); })}>
        <Sparkles size={28} aria-hidden="true" />Beispielquiz hinzufügen<span className="hint">10 Fragen als Starthilfe</span></button>
    </div><div className="section-heading"><div><span className="eyebrow">SPIELVERLAUF</span><h2>Sitzungen</h2>
      <p>Laufende Live-Quizze stehen oben, beendete findest du eingeklappt darunter.</p></div></div>
    {sessions.length === 0 ? <p>Noch keine Sitzungen vorhanden.</p> : <>
      {activeSessions.length === 0 ? <p className="archive-empty">Gerade läuft keine Live-Sitzung.</p> : <div className="grid session-grid">
        {activeSessions.map((session) => <article className="card" key={session.sessionId}><h2>{session.title}</h2>
          <span className="badge">{phaseLabels[session.status] ?? session.status}</span><p>Spielcode {session.joinCode}</p>
          <Link className="button secondary small" to={`/admin/sessions/${session.sessionId}`}>Sitzung öffnen</Link></article>)}
      </div>}
      <ArchiveSection label="Beendete Sitzungen" count={endedSessions.length}>
        {endedSessions.map((session) => <ArchiveRow key={session.sessionId} title={session.title}
          status={archivedSessionLabel(session.status)} to={`/admin/sessions/${session.sessionId}`} action="Sitzung öffnen">
          <span className="archive-meta-item"><Clock3 size={14} aria-hidden="true" />
            Erstellt am {formatDateTimeWithZone(session.createdAt, browserTimeZone)}</span>
        </ArchiveRow>)}
      </ArchiveSection>
    </>}
    <div className="section-heading"><div><span className="eyebrow">QUIZ ZUM MITMACHEN</span><h2>Veröffentlichte Quizrunden</h2>
      <p>Teile deine Quizrunde. Alle spielen in ihrem Tempo bis zum angegebenen Ende.</p></div></div>
    {asyncPublications.length === 0 ? <p>Noch keine Quizrunden veröffentlicht.</p> : <>
      {activePublications.length === 0 ? <p className="archive-empty">Gerade ist keine Quizrunde aktiv.</p> : <div className="grid async-publication-grid">
        {activePublications.map((publication) => <AsyncPublicationCard key={publication.publicationId} publication={publication}
          busy={busy} onEnd={() => void run(async () => { await cloud.endAsyncPublication(publication.publicationId); })} />)}
      </div>}
      <ArchiveSection label="Beendete Quizrunden" count={endedPublications.length}>
        {endedPublications.map((publication) => <ArchiveRow key={publication.publicationId} title={publication.title}
          status={asyncStatusText(liveAsyncStatus(publication.status, publication.expiresAt, now))}
          to={`/admin/async/${publication.publicationId}`} action="Ergebnisse ansehen">
          <span className="archive-meta-item"><Clock3 size={14} aria-hidden="true" />
            Beendet am {formatDateTimeWithZone(publication.endedAt ?? publication.expiresAt, publication.timeZone)}</span>
          <span className="archive-meta-item"><Users size={14} aria-hidden="true" />
            {publication.participantCount} gestartet · {publication.completedCount} fertig</span>
        </ArchiveRow>)}
      </ArchiveSection>
    </>}
    </Layout>;
}

function EditorPage() {
  const { quizId = "" } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<QuizRecord | null>(null);
  const [loading, setLoading] = useState(quizId !== "new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (quizId === "new") return;
    let active = true;
    cloud.getQuiz(quizId).then((value) => { if (active) setRecord(value); },
      (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId]);
  async function save(quiz: Quiz) {
    setSaving(true); setError("");
    try {
      if (record) await cloud.updateQuiz(record.quizId, record.version, quiz); else await cloud.createQuiz(quiz);
      navigate("/admin");
    } catch (caught) { setError(message(caught)); } finally { setSaving(false); }
  }
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link>
    <div className="section-heading"><div><span className="eyebrow">QUIZWERKSTATT</span><h1>{record ? "Quiz bearbeiten" : "Neues Quiz"}</h1>
      <p>Deine Ideen werden zur nächsten Lieblingsrunde. Eine richtige Antwort pro Frage.</p></div></div>
    <ErrorBanner error={error} />{loading ? <p>Quiz wird geladen …</p> :
      (quizId === "new" || record) && <QuizEditor initialQuiz={record?.quiz} onSave={(quiz) => void save(quiz)} saving={saving} cloudMode />}
  </Layout>;
}

function PublishAsyncPage() {
  const { quizId = "" } = useParams();
  const [record, setRecord] = useState<QuizRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [selectedInstant, setSelectedInstant] = useState("");
  const [publication, setPublication] = useState<Awaited<ReturnType<typeof cloud.publishAsyncQuiz>> | null>(null);
  const requestId = useRef<{ expiresAt: number; timeZone: string; id: string } | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const instants = useMemo(() => localDate ? possibleInstants(localDate, timeZone) : [], [localDate, timeZone]);
  const [bounds] = useState(() => ({ min: toLocalInput(Date.now()), max: toLocalInput(Date.now() + ASYNC_MAX_DURATION_MS) }));
  useEffect(() => {
    let active = true;
    cloud.getQuiz(quizId).then((value) => { if (active) setRecord(value); },
      (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId]);
  useEffect(() => {
    if (instants.length === 1) setSelectedInstant(String(instants[0]));
    else setSelectedInstant("");
  }, [instants]);
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!record || !selectedInstant) return;
    const expiresAt = Number(selectedInstant);
    if (expiresAt <= Date.now()) { setError("Das Ende muss in der Zukunft liegen."); return; }
    if (expiresAt > Date.now() + ASYNC_MAX_DURATION_MS) {
      setError(`Das Ende darf höchstens ${ASYNC_MAX_DURATION_DAYS} Tage in der Zukunft liegen.`); return;
    }
    if (!requestId.current || requestId.current.expiresAt !== expiresAt || requestId.current.timeZone !== timeZone) {
      requestId.current = { expiresAt, timeZone, id: crypto.randomUUID() };
    }
    setBusy(true); setError("");
    try {
      const result = await cloud.publishAsyncQuiz(record.quizId, requestId.current.id, expiresAt, timeZone);
      setPublication(result);
      requestId.current = null;
    } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link>
    <div className="section-heading"><div><span className="eyebrow">QUIZ ZUM MITMACHEN</span><h1>Quizrunde veröffentlichen</h1>
      <p>Spiele in deinem Tempo: Alle Gäste spielen unabhängig bis zum angegebenen Ende. Das Live-Quiz bleibt davon unberührt.</p></div></div>
    <ErrorBanner error={error} />
    {loading ? <p>Quiz wird geladen …</p> : !record ? <p>Quiz nicht gefunden.</p> : publication ? <section className="card async-published">
      <span className="badge">Veröffentlicht</span><h2>{record.quiz.title}</h2>
      <p className="async-card-deadline"><Clock3 size={16} aria-hidden="true" /> Mitspielen bis{" "}
        <strong>{formatDateTimeWithZone(publication.expiresAt, publication.timeZone)}</strong></p>
      <JoinCodeBlock joinCode={publication.joinCode} title={record.quiz.title} />
      <p className="async-card-link">{displayQuizLink(publication.joinCode)}</p>
      <div className="actions">
        <a className="button primary" href={`/einladung/${publication.joinCode}`} target="_blank" rel="noopener">
          <PresentationIcon size={17} aria-hidden="true" />Einladung anzeigen</a>
        <CopyAction text={shortQuizLink(publication.joinCode)} label="Link kopieren" copiedMessage="Link kopiert."
          fieldLabel="Teilnahmelink" className="button secondary" iconSize={17} />
      </div>
      <p>Maximale Teilnehmerzahl: {publication.maxParticipants}. Ergebnisse werden {publication.retentionDays} Tage nach dem Ende aufbewahrt.</p>
      <p><Link to="/admin">Zur Übersicht und Ergebnisverwaltung</Link></p>
    </section> : <form className="card async-publish-form" onSubmit={(event) => void publish(event)}>
      <span className="badge">{record.quiz.questions.length} Fragen</span><h2>{record.quiz.title}</h2>
      <label className="field" htmlFor="async-deadline">Mitspielen bis (Datum und Uhrzeit)</label>
      <input id="async-deadline" type="datetime-local" required value={localDate} disabled={busy}
        min={bounds.min} max={bounds.max} aria-describedby="async-deadline-hint"
        onChange={(event) => setLocalDate(event.target.value)} />
      <span className="hint" id="async-deadline-hint">Höchstens {ASYNC_MAX_DURATION_DAYS} Tage ab heute. Fragen haben kein hartes Zeitlimit; schnelle richtige Antworten erhalten in den ersten 30 Sekunden bis zu 500 Bonuspunkte zusätzlich zu 1.000 Grundpunkten.</span>
      <p>Zeitzone deines Browsers: <strong>{timeZone}</strong></p>
      {localDate && instants.length === 0 && <p className="error-banner" role="alert">Diese lokale Uhrzeit existiert wegen der Zeitumstellung nicht.</p>}
      {instants.length > 1 && <fieldset><legend>Diese Uhrzeit kommt zweimal vor. Wähle den eindeutigen Zeitpunkt:</legend>
        {instants.map((instant) => <label className="radio-option" key={instant}>
          <input type="radio" name="async-deadline-instance" value={instant} checked={selectedInstant === String(instant)}
            onChange={() => setSelectedInstant(String(instant))} />
          {formatDateTimeInZone(instant, timeZone)} ({new Intl.DateTimeFormat("de-DE", {
            timeZone, timeZoneName: "longOffset", hour: "2-digit",
          }).format(instant).split(" ").at(-1)})
        </label>)}
      </fieldset>}
      <p>Die Teilnehmerzahl ist begrenzt. Bis zu diesem Zeitpunkt müssen alle Antworten abgegeben sein.
        Danach sind keine neuen Starts oder Antworten möglich.
        Richtige Antworten und Punkte werden Gästen erst nach Ende der Runde angezeigt.</p>
      <p>Ergebnisse werden {legal.asyncResultsRetentionDays} Tage nach dem tatsächlichen Rundenende aufbewahrt.</p>
      <button className="button primary" disabled={busy || !selectedInstant || instants.length === 0}>
        {busy ? "Wird veröffentlicht …" : "Quizrunde veröffentlichen"}
      </button>
    </form>}
  </Layout>;
}

const pointsText = (value: number) => value.toLocaleString("de-DE");
const secondsText = (ms: number) => `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;

function scoringRuleOf(info: AsyncScoringFields | null | undefined): AsyncScoringRule | null {
  if (info?.scoringVersion !== ASYNC_SPEED_V1.version) return null;
  return {
    version: ASYNC_SPEED_V1.version,
    basePoints: info.basePoints ?? ASYNC_SPEED_V1.basePoints,
    maxBonusPoints: info.maxBonusPoints ?? ASYNC_SPEED_V1.maxBonusPoints,
    bonusWindowMs: info.bonusWindowMs ?? ASYNC_SPEED_V1.bonusWindowMs,
  };
}

function speedIntro(rule: AsyncScoringRule) {
  return `Richtig antworten bringt ${pointsText(rule.basePoints)} Punkte. Je schneller du bist, desto mehr Bonus bekommst du – bis zu ${pointsText(rule.maxBonusPoints)} Punkte zusätzlich.`;
}

type AsyncScoringFields = Pick<AsyncGuestState, "scoringVersion" | "basePoints" | "maxBonusPoints" | "bonusWindowMs">;

function AsyncProgress({ answered, total }: { answered: number; total: number }) {
  return <div className="answer-progress">
    <p><strong>{answered} von {total}</strong> Fragen beantwortet</p>
    <progress value={Math.min(answered, total)} max={Math.max(1, total)} aria-label={`${answered} von ${total} Fragen beantwortet`} />
  </div>;
}

function AsyncQuizPage() {
  useNoIndex();
  const { token = "" } = useParams();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof cloud.asyncPublicInfo>> | null>(null);
  const [state, setState] = useState<AsyncGuestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Getippte Antwort (wird gesendet bzw. Senden fehlgeschlagen); gehört immer zu genau einer Frage.
  const [choice, setChoice] = useState<{ questionIndex: number; id: string } | null>(null);
  // Nach einer bestätigten Antwort pausiert das Quiz, bis die Person die nächste Frage selbst öffnet.
  const [pausedAfter, setPausedAfter] = useState<{ answeredCount: number; answer: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [clock, setClock] = useState(Date.now());
  // Server time decides; the offset corrects a wrong client clock for display and button state.
  const [clockOffset, setClockOffset] = useState(0);
  // Verwirft verspätete Antworten älterer Requests (Doppelklick, Retry, Mehrfachtabs).
  const requestSeq = useRef(0);
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
  // Pause: Folgefrage noch nicht geöffnet (Tempo-Wertung) oder gerade eine Antwort bestätigt (auch ohne Tempo-Wertung).
  const paused = inProgress && (!state?.question || pausedAfter?.answeredCount === state.answeredCount);
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
  /** Öffnet nach der Pause die nächste Frage; erst jetzt startet der Server ihren Tempo-Bonus. */
  async function continueQuiz() {
    if (busy) return;
    const request = ++requestSeq.current;
    setBusy(true); setError(""); setAnnouncement("");
    try {
      const next = await cloud.startAsyncQuiz(token);
      if (request !== requestSeq.current) return;
      setPausedAfter(null);
      applyState(next);
      if (next.status !== "ACTIVE") roundEnded(next);
    } catch (caught) {
      if (request === requestSeq.current) setError(`Die nächste Frage konnte nicht geöffnet werden: ${message(caught)}`);
    } finally { if (request === requestSeq.current) setBusy(false); }
  }
  /** Übernimmt den bestätigten Fortschritt aus der Antwortbestätigung als einen zusammengehörigen Zustandswechsel. */
  function applyReceipt(receipt: AsyncAnswerReceipt, answered: number, choiceId: string) {
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
  /** Ein Tipp auf eine Kachel gibt die Antwort sofort und endgültig ab – wie im Live-Quiz. */
  async function submitAnswer(choiceId: string) {
    if (!question || busy || !canAnswer) return;
    const answered = question.questionIndex;
    const choiceIndex = question.answers.findIndex((answer) => answer.id === choiceId);
    const answerLabel = `${String.fromCharCode(65 + choiceIndex)} · ${question.answers[choiceIndex]?.text ?? ""}`;
    const pauseAfter = (latest: { answeredCount: number; attemptStatus?: string | null }) => {
      if (latest.attemptStatus === "IN_PROGRESS") setPausedAfter({ answeredCount: latest.answeredCount, answer: answerLabel });
    };
    const request = ++requestSeq.current;
    setChoice({ questionIndex: answered, id: choiceId });
    setBusy(true); setError(""); setAnnouncement("");
    try {
      const receipt = await cloud.submitAsyncAnswer(token, answered, choiceId);
      if (request !== requestSeq.current) return;
      if (receipt.attemptStatus && receipt.status === "ACTIVE") {
        applyReceipt(receipt, answered, choiceId);
        pauseAfter(receipt);
        if (receipt.attemptStatus === "COMPLETED") setAnnouncement("Antwort gespeichert. Quiz abgeschlossen.");
      } else {
        // Ältere Backends oder Rundenende: tatsächlichen gespeicherten Stand laden statt eine Frage vorzutäuschen.
        const latest = await cloud.myAsyncState(token);
        if (request !== requestSeq.current || !latest) return;
        applyState(latest);
        if (latest.status !== "ACTIVE") roundEnded(latest);
        pauseAfter(latest);
        setAnnouncement("Antwort gespeichert.");
      }
    } catch (caught) {
      if (request !== requestSeq.current) return;
      try {
        const latest = await cloud.myAsyncState(token);
        if (request !== requestSeq.current) return;
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
    } finally { if (request === requestSeq.current) setBusy(false); }
  }
  const status = <p className="sr-only" role="status" aria-live="polite">{announcement}</p>;
  const nearDeadline = state ? state.expiresAt - now <= 10 * 60 * 1000 : false;
  const deadlineWarning = nearDeadline && <p className="deadline-warning compact" role="status">Weniger als zehn Minuten bis zum Ende.</p>;
  if (!loading && info && state && paused) {
    const justAnswered = pausedAfter?.answeredCount === state.answeredCount ? pausedAfter : null;
    const nextQuestion = state.answeredCount + 1;
    return <Layout gameMode="player">
      <div className="game-view game-personal">
        <div className="game-phase" key={`pause-${state.answeredCount}`}>
          <section className="async-pause" aria-labelledby="async-pause-title">
            <div className="question-metabar">
              <span className="question-meta-player"><Avatar avatarId={state.avatarId} /><span>{state.displayName}</span></span>
              <span className="question-meta-progress">Pause</span>
            </div>
            {deadlineWarning}
            <div className="result-sticker" aria-hidden="true">{justAnswered ? <Check size={34} /> : <Sparkles size={32} />}</div>
            <h1 id="async-pause-title" ref={pauseHeadingRef} tabIndex={-1}>
              {justAnswered ? "Antwort gespeichert" : `Bereit für Frage ${nextQuestion}?`}</h1>
            {justAnswered && <p className="async-pause-answer">Deine Antwort: <strong>{justAnswered.answer}</strong></p>}
            <AsyncProgress answered={state.answeredCount} total={state.questionCount} />
            <ErrorBanner error={error} />
            <button type="button" className="button primary async-continue" disabled={busy} onClick={() => void continueQuiz()}>
              {busy ? "Frage wird geöffnet …" : <>Weiter zu Frage {nextQuestion}<ArrowRight size={18} aria-hidden="true" /></>}
            </button>
            <p className="async-pause-hint">Du kannst hier eine Pause machen und bis {formatDateTimeWithZone(state.expiresAt, state.timeZone)} weiterspielen
              – auf diesem Gerät über diesen Link oder den Quiz-Code.{rule && " Der Tempo-Bonus startet erst, wenn du die nächste Frage öffnest."}
              {" "}Ob du richtig liegst, siehst du nach Ende der Runde.</p>
            {status}
          </section>
        </div>
      </div>
    </Layout>;
  }
  if (!loading && info && state && question) {
    const failed = !busy && error ? tappedChoice : null;
    const tappedIndex = question.answers.findIndex((answer) => answer.id === tappedChoice);
    const tappedLabel = tappedIndex >= 0 ? `${String.fromCharCode(65 + tappedIndex)} · ${question.answers[tappedIndex].text}` : "";
    return <Layout gameMode="player">
      <div className="game-view game-personal">
        <div className="game-phase" key={`question-${question.questionIndex}`}>
          <section className="question-phase compact-question async-question" aria-labelledby="async-question-title">
            <div className="question-metabar">
              <span className="question-meta-player"><Avatar avatarId={state.avatarId} /><span>{state.displayName}</span></span>
              <span className="question-meta-progress">Frage {question.questionIndex + 1}/{state.questionCount}</span>
              {rule && question.startedAt != null &&
                <SpeedBonus key={`${question.questionIndex}-${question.startedAt}`} startedAt={question.startedAt} offset={clockOffset} rule={rule} />}
            </div>
            {deadlineWarning}
            <h1 id="async-question-title" ref={headingRef} tabIndex={-1}>{question.text}</h1>
            <AnswerTiles answers={question.answers} columns={answerColumns(question.answers)}
              pendingChoice={busy ? tappedChoice : null} locked={busy || !canAnswer} onAnswer={(id) => void submitAnswer(id)} />
            <ErrorBanner error={error} />
            <div className={`answer-feedback${busy && tappedChoice ? " pending" : ""}`} role="status" aria-atomic="true">
              <Clock3 size={18} aria-hidden="true" />
              <span>{busy && tappedChoice ? <><strong>Wird gesendet …</strong> {tappedLabel}</> :
                failed ? <><strong>Nicht gespeichert:</strong> {tappedLabel} · Tippe erneut auf eine Antwort.</> :
                "Tippe auf eine Antwort – sie wird direkt abgegeben."}</span>
            </div>
            {status}
            <details className="question-help">
              <summary>Hinweise und Fortschritt</summary>
              <AsyncProgress answered={state.answeredCount} total={state.questionCount} />
              <p>Deine Antwort zählt sofort und lässt sich danach nicht mehr ändern. Ob du richtig liegst, siehst du nach Ende der Runde.</p>
              <p>Nach jeder Antwort kannst du eine Pause machen und später auf diesem Gerät weiterspielen.</p>
              {rule && <p>{speedIntro(rule)} Der Tempo-Bonus sinkt in den ersten {Math.round(rule.bonusWindowMs / 1000)} Sekunden
                je Frage auf null; die Zeit misst der Server ab dem Öffnen der Frage, einschließlich Übertragung.</p>}
              <p>{info.title} · Mitspielen bis {formatDateTimeWithZone(info.expiresAt, info.timeZone)}</p>
            </details>
          </section>
        </div>
      </div>
    </Layout>;
  }
  return <Layout gameMode="player"><Link className="back" to="/">← Zur Startseite</Link>
    {loading ? <p>Quiz wird geladen …</p> : !info ? <div className="empty"><h1>Quizrunde nicht verfügbar</h1>
      <p>{error || "Dieser Link oder Quiz-Code ist ungültig oder die Ergebnisse wurden bereits gelöscht."}</p>
      <p><Link className="button secondary" to="/join">Quiz-Code eingeben</Link></p></div> : <>
      <div className="async-quiz-heading"><span className="eyebrow">QUIZ ZUM MITMACHEN · SPIELE IN DEINEM TEMPO</span><h1>{info.title}</h1>
        <p>{info.description}</p><p><Clock3 size={17} aria-hidden="true" /> Mitspielen bis {formatDateTimeWithZone(info.expiresAt, info.timeZone)}</p>
        <p>{info.questionCount} Fragen. Deine Antworten werden einzeln gespeichert. Maximal {info.maxParticipants} Teilnahmen.</p></div>
      <ErrorBanner error={error} />
      {status}
      {state ? <section className="card async-player-card">
        <div className="async-player-identity"><Avatar avatarId={state.avatarId} /><strong>{state.displayName}</strong></div>
        <h2>{state.attemptStatus === "COMPLETED" ? "Quiz abgeschlossen" : "Quiz beendet"}</h2>
        <p>{state.answeredCount} von {state.questionCount} Fragen beantwortet.
          {state.attemptStatus === "EXPIRED_PARTIAL" && " Nicht beantwortete Fragen zählen als 0 Punkte."}</p>
        {state.status === "ACTIVE" && <p>Deine Antworten sind gespeichert. Auflösung und Ergebnis siehst du nach Ende der Runde
          ({formatDateTimeWithZone(state.expiresAt, state.timeZone)}) über diesen Link oder denselben Quiz-Code.</p>}
        {state.status !== "ACTIVE" && <><p className="async-own-total">Dein Ergebnis: <strong>{rule
          ? `${pointsText(state.points ?? 0)} Punkte`
          : `${state.points ?? 0} von ${state.questionCount} Punkten`}</strong></p>
          {rule && <p className="hint">Wertung: {pointsText(rule.basePoints)} Grundpunkte je richtiger Antwort plus bis zu
            {" "}{pointsText(rule.maxBonusPoints)} Punkte Tempo-Bonus.</p>}
          <ol className="async-own-results">{state.results.map((result) => <li key={result.questionIndex}>
            <strong>Frage {result.questionIndex + 1}: {result.questionText}</strong>
            <p>{result.answered ? result.correct ? "Richtig." : "Falsch." : "Nicht beantwortet."}</p>
            {result.selectedText && <p>Deine Antwort: {result.selectedText}.</p>}
            {result.correctText && <p>Richtige Antwort: {result.correctText}.</p>}
            {rule && result.answered && <p className="async-score-line">
              Grundpunkte {pointsText(result.basePoints ?? 0)} · Tempo-Bonus {pointsText(result.bonusPoints ?? 0)} ·
              Gesamt <strong>{pointsText(result.points ?? 0)}</strong>
              {result.elapsedMs != null && ` · Antwortzeit ${secondsText(result.elapsedMs)}`}</p>}
            {result.explanation && <p>{result.explanation}</p>}
          </li>)}</ol>
        </>}
      </section> : info.status === "ACTIVE" && canAnswer ? <section className="card async-player-card">
        <h2>Du spielst in deinem Tempo</h2><p>Deine Antworten werden gespeichert. Du kannst bis {formatDateTimeWithZone(info.expiresAt, info.timeZone)} mitspielen.</p>
        {rule && <p className="async-speed-intro"><Zap size={17} aria-hidden="true" /> {speedIntro(rule)}</p>}
        <button className="button primary" disabled={busy} onClick={() => void start()}>
          {busy ? "Quiz wird geöffnet …" : "Quiz starten"}
        </button>
      </section> : <section className="card async-player-card"><h2>Diese Quizrunde ist beendet</h2>
        <p>Die Quizrunde endete am {formatDateTimeWithZone(info.endedAt ?? info.expiresAt, info.timeZone)}.</p></section>}
    </>}
  </Layout>;
}

const attemptStatusText = (status: string) => status === "COMPLETED" ? "abgeschlossen" : status === "IN_PROGRESS" ? "läuft" : "Frist abgelaufen";

function AsyncLeaderRow({ player, rule, questionCount }: { player: AsyncStandingParticipant; rule: AsyncScoringRule | null; questionCount: number }) {
  return <li className="async-leader">
    <span className="async-leader-rank" aria-label={`Rang ${player.rank}`}>{player.rank}.</span>
    <Avatar avatarId={player.avatarId} />
    <span className="async-leader-name">{player.displayName}</span>
    <strong className="async-leader-points">{rule ? `${pointsText(player.points)} P.` : `${player.points}/${questionCount}`}</strong>
    <span className="async-leader-status">{attemptStatusText(player.status)}</span>
  </li>;
}

function AsyncAdminResultsPage() {
  useNoIndex();
  const { publicationId = "" } = useParams();
  return <AsyncAdminResults key={publicationId} publicationId={publicationId} />;
}

function AsyncAdminResults({ publicationId }: { publicationId: string }) {
  const { standings: results, loading, error, expired, refreshing, refresh } = useAsyncStandings(publicationId);
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "PARTIAL">("ALL");
  const [sort, setSort] = useState<"RANK" | "NAME" | "START">("RANK");
  const [rankingLimit, setRankingLimit] = useState(ASYNC_DETAIL_PAGE_SIZE);
  const [detailLimit, setDetailLimit] = useState(ASYNC_DETAIL_PAGE_SIZE);
  const [presenting, setPresenting] = useState(false);
  const [open, setOpen] = useState({ questions: false, players: false, info: false });
  const participantDetails = useAsyncParticipantDetails(publicationId, results, open.players && !presenting, detailLimit);
  const toggle = (key: keyof typeof open) => (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    setOpen((current) => current[key] === isOpen ? current : { ...current, [key]: isOpen });
  };
  const rule = scoringRuleOf(results);
  const leaders = results?.participants.slice(0, 3) ?? [];
  const others = results?.participants.slice(3, rankingLimit) ?? [];
  const total = results?.totalParticipants ?? 0;
  const formatPoints = !rule && results ? (points: number) => `${points}/${results.questions.length}` : pointsText;
  const rankingPlayers = (players: AsyncStandingParticipant[]) => players.map((player) => ({ ...player, participantId: player.attemptId }));
  const moreRanks = results && rankingLimit < total && <button className="button secondary" onClick={() =>
    setRankingLimit((value) => value + ASYNC_DETAIL_PAGE_SIZE)}>Weitere Plätze anzeigen</button>;
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link>
    <ErrorBanner error={error} />
    {loading && !results ? <p>Ergebnisse werden geladen …</p> : !results ? <div>
      <p>Ergebnisse nicht verfügbar.</p>{!expired && <button className="button secondary" disabled={refreshing} onClick={refresh}>Erneut versuchen</button>}
    </div> : <div className="async-admin-results">
      <div className="async-admin-head">
        <div><span className="eyebrow">QUIZ ZUM MITMACHEN</span>{!results.isFinal && <h1>{results.title}</h1>}</div>
        {!results.isFinal && <span className={`badge async-status-${results.status.toLowerCase()}`}>{asyncStatusText(results.status)}</span>}
        <AsyncStandingsPresentation standings={results} statusText={asyncStatusText(results.status)} formatPoints={formatPoints}
          error={error} refreshing={refreshing} onRefresh={refresh} onPresentationChange={setPresenting} />
        <button className="button secondary small" disabled={refreshing} onClick={refresh}>
          {refreshing ? "Wird aktualisiert …" : "Aktualisieren"}</button>
      </div>
      {results.isFinal ? <div className="game-view">
        <header className="game-heading">
          <p className="game-title">{results.title}</p>
          <span className="phase-badge" role="status">{asyncStatusText(results.status)}</span>
        </header>
        <section className="game-phase ranking-phase" aria-labelledby="async-ranking-title">
          <span className="eyebrow">DAS WAR EURE RUNDE</span>
          <h1 id="async-ranking-title">Endstand</h1>
          <p className="ranking-intro">Zusammen gerätselt. Gemeinsam gefeiert.</p>
          {leaders.length === 0 ? <p>Noch keine Teilnehmenden.</p> : <>
            <Podium players={rankingPlayers(leaders)} formatPoints={formatPoints} />
            {others.length > 0 && <Leaderboard players={rankingPlayers(others)} formatPoints={formatPoints} />}
          </>}
          {moreRanks}
        </section>
        <p className="game-footnote">{total} Teilnehmende · Gemeinsam rätseln, gemeinsam staunen.</p>
      </div> : <section className="card game-view async-leaders" aria-labelledby="async-leaders-title">
        <div className="async-leaders-head">
          <h2 id="async-leaders-title">Zwischenstand</h2>
          <span className="badge">Vorläufig</span>
        </div>
        {leaders.length === 0 ? <p className="hint">Noch keine Teilnahmen. Sobald jemand startet, erscheint hier die Rangliste.</p> :
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
      <details className="card async-admin-section" open={open.questions} onToggle={toggle("questions")}>
        <summary><h2>Fragenauswertung</h2></summary>
        <div className="grid">
          {results.questions.map((question) => <article className="async-question-stat" key={question.questionIndex}>
            <h3>Frage {question.questionIndex + 1}: {question.text}</h3>
            <p>{question.answeredCount} Antworten · {results.participantCount - question.answeredCount} nicht beantwortet</p>
            {question.answeredCount === 0 ? <p>Noch keine Antworten.</p> : question.options.map((option) =>
              <p key={option.id} className={option.correct ? "async-correct-option" : ""}>{option.text}: {option.count} (
                {Math.round(option.count / question.answeredCount * 100)}%){option.correct && " · richtig"}</p>)}
          </article>)}
        </div>
      </details>
      <details className="card async-admin-section" open={open.players} onToggle={toggle("players")}>
        <summary><h2>Teilnehmerdetails</h2></summary>
        <div className="actions">
          <label className="field">Anzeigen
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="ALL">Alle</option><option value="COMPLETED">Abgeschlossen</option><option value="PARTIAL">Unvollständig</option>
            </select></label>
          <label className="field">Sortieren nach
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="RANK">Rang</option><option value="NAME">Name</option><option value="START">Startzeit</option>
            </select></label>
        </div>
        {filter !== "ALL" && <p className="hint">Die Ränge beziehen sich immer auf alle Teilnahmen.</p>}
        {participantDetails.error && <p className="error-banner" role="status">{participantDetails.error}
          {" "}<button className="button secondary small" onClick={participantDetails.retry}>Erneut versuchen</button></p>}
        {participantDetails.loading && <p className="hint" role="status">Teilnehmerdetails werden aktualisiert …</p>}
        {results.participants.length === 0 ? <p>Noch keine Teilnehmer.</p> :
        <div className="grid">{results.participants.slice(0, detailLimit)
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
            <span>Start: {formatDateTimeInZone(player.startedAt, results.timeZone)}
              {player.completedAt ? ` · Abschluss: ${formatDateTimeInZone(player.completedAt, results.timeZone)}` : ""}</span>
          </summary>{detail ? <ol>{results.questions.map((question) => {
            const answer = answerByIndex.get(question.questionIndex);
            const correct = question.options.find((item) => item.correct);
            if (!answer) return <li key={question.questionIndex}><strong>{question.text}</strong><p>Nicht beantwortet
              (richtig: {correct?.text ?? "unbekannt"})</p></li>;
            const option = question.options.find((item) => item.id === answer.choiceId);
            return <li key={question.questionIndex}><strong>{question.text}</strong><p>Antwort: {option?.text ?? "Unbekannt"}
              {answer.correct ? " · richtig" : ` · falsch (richtig: ${correct?.text ?? "unbekannt"})`}</p>
              {rule && <p className="async-score-line">Grundpunkte {pointsText(answer.basePoints ?? 0)} · Tempo-Bonus {pointsText(answer.bonusPoints ?? 0)} ·
                Gesamt <strong>{pointsText(answer.points ?? 0)}</strong>
                {answer.elapsedMs != null && ` · Antwortzeit ${secondsText(answer.elapsedMs)}`}</p>}
              <p className="hint">{formatDateTimeInZone(answer.acceptedAt, results.timeZone)}</p></li>;
          })}</ol> : <p className="hint">Die Antwortdetails sind noch nicht aktuell.</p>}</details>;
        })}</div>}
        {detailLimit < total && <button className="button secondary" disabled={participantDetails.loading}
          onClick={() => setDetailLimit((value) => value + ASYNC_DETAIL_PAGE_SIZE)}>Weitere Teilnehmer laden</button>}
      </details>
      <details className="card async-admin-section" open={open.info} onToggle={toggle("info")}>
        <summary><h2>Quizinformationen</h2></summary>
        <p>Veröffentlicht: {formatDateTimeInZone(results.createdAt, results.timeZone)} ·
          Mitspielen bis: {formatDateTimeWithZone(results.expiresAt, results.timeZone)} ({results.timeZone})
          {results.endedAt && results.endedAt !== results.expiresAt &&
            ` · Tatsächliches Ende: ${formatDateTimeInZone(results.endedAt, results.timeZone)}`}</p>
        <p>Aktualisiert: {new Date(results.updatedAt).toLocaleString("de-DE")}</p>
        <p>{rule ? `Wertung: ${pointsText(rule.basePoints)} Grundpunkte je richtiger Antwort plus bis zu ${pointsText(rule.maxBonusPoints)} Punkte Tempo-Bonus, linear fallend in den ersten ${Math.round(rule.bonusWindowMs / 1000)} Sekunden ab serverseitiger Freigabe der Frage. Kein hartes Zeitlimit pro Frage.`
          : "Wertung: ein Punkt je richtiger Antwort (ältere Veröffentlichung ohne Tempo-Bonus)."}</p>
        <p className="hint">Gleich viele Punkte ergeben denselben Rang. Innerhalb eines Gleichstands wird nur zur Anzeige alphabetisch nach Spielname sortiert.</p>
      </details>
    </div>}
  </Layout>;
}

function Join() {
  const { joinCode = "" } = useParams();
  const [code, setCode] = useState(joinCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeJoinCodeInput(code);
    if (normalized.error) { setError(normalized.error); return; }
    setBusy(true); setError("");
    try {
      // Der Server ordnet den Code eindeutig zu; die Gäste müssen den Modus nicht kennen.
      const resolved = await cloud.resolveJoinCode(normalized.code);
      if (resolved.mode === "ASYNC") { navigate(`/q/${resolved.joinCode}`); return; }
      const participant = await cloud.join(resolved.joinCode);
      navigate(`/play/${participant.sessionId}`);
    }
    catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  return <Layout><div className="login-card join-card"><span className="login-icon"><KeyRound size={27} aria-hidden="true" /></span>
    <span className="eyebrow">DEIN PLATZ IST NOCH FREI</span><h1>Mitspielen</h1>
    <p>Gib den sechsstelligen Quiz-Code ein – für Live-Quiz und Quiz zum Mitmachen. Ein Konto ist nicht nötig.</p>
    <ErrorBanner error={error} /><form onSubmit={(event) => void submit(event)} noValidate><label className="field">Quiz-Code
      <input className="code-input" type="text" inputMode="numeric" autoComplete="off" autoCorrect="off" spellCheck={false}
        maxLength={12} required value={code} placeholder="482 619" disabled={busy} aria-describedby="join-code-hint"
        aria-invalid={error ? true : undefined}
        onChange={(event) => { setCode(event.target.value); if (error) setError(""); }} /></label>
      <span className="hint" id="join-code-hint">Den Code bekommst du von deinem Quizmaster, z. B. 482 619.</span>
      <button className="button primary" disabled={busy}>{busy ? "Wird geprüft …" : "Mitspielen"}<ArrowRight size={18} aria-hidden="true" /></button></form>
      <PrivacyNote /></div></Layout>;
}

function AdminSession() {
  const { sessionId = "" } = useParams();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [questions, setQuestions] = useState<Array<{ questionId: string; index: number; text: string }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { state, offset, error: liveError, refresh } = useLiveState(sessionId, "admin");
  useEffect(() => {
    let active = true;
    Promise.all([cloud.getSession(sessionId), cloud.questions(sessionId)]).then(([current, nextQuestions]) => {
      if (!active) return;
      setSession(current); setQuestions(nextQuestions);
    }).catch((caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [sessionId]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); refresh(); } catch (caught) { setError(message(caught)); refresh(); } finally { setBusy(false); }
  }
  const next = state ? questions.find((question) => question.index === state.questionIndex + 1) : undefined;
  return <Layout gameMode="admin"><div className="session-navigation"><Link className="back" to="/admin">← Zur Übersicht</Link>
    {session && <a className="header-link" href={`/present/${session.presentationToken}`} target="_blank" rel="noreferrer">Präsentationsansicht öffnen ↗</a>}
    </div><ErrorBanner error={error || liveError} />
    {!state ? <p>Spielstand wird geladen …</p> : <>
      <div className="admin-session-grid">
      <GameView state={state} offset={offset} joinCode={session?.joinCode} />
      <aside className="session-controls" aria-label="Sitzung steuern">
        <span className="eyebrow">QUIZMASTER</span><h2>Du gibst den Takt vor.</h2>
        <p>{phaseLabels[state.status]} · Frage {Math.max(0, state.questionIndex + 1)} von {state.questionCount}</p>
        {state.status === "QUESTION_OPEN" && <p>Die Frist läuft automatisch ab. Vorzeitiges Schließen ist optional.</p>}
        {["COUNTDOWN", "QUESTION_CLOSED", "SCORING"].includes(state.status) && <p role="status">Der Server führt automatisch zur nächsten Phase.</p>}
        {state.status === "LOBBY" && next && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.control("startQuestion", sessionId, next.questionId, state.version))}>Erste Frage starten</button>}
        {state.status === "QUESTION_OPEN" && state.questionId && <button className="button secondary" disabled={busy}
          onClick={() => void run(() => cloud.control("closeQuestion", sessionId, state.questionId!, state.version))}>Frage vorzeitig schließen</button>}
        {state.status === "REVEAL" && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.transition("showLeaderboard", sessionId, state.version))}>Zwischenstand anzeigen</button>}
        {state.status === "LEADERBOARD" && next && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.control("nextQuestion", sessionId, next.questionId, state.version))}>Nächste Frage starten</button>}
        {state.status === "LEADERBOARD" && state.questionIndex === state.questionCount - 1 && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.transition("finishSession", sessionId, state.version))}>Endstand anzeigen</button>}
        {["FINISHED", "CANCELLED"].includes(state.status) && <Link className="button primary" to="/admin">Zur Quizübersicht</Link>}
        {!["FINISHED", "CANCELLED"].includes(state.status) && <ConfirmDialog title="Sitzung abbrechen?" variant="warning"
          description="Die Live-Runde endet sofort für alle Teilnehmenden und kann nicht fortgesetzt werden."
          confirmLabel="Sitzung abbrechen" confirmDisabled={busy}
          onConfirm={() => void run(() => cloud.transition("cancelSession", sessionId, state.version))}
          trigger={<button className="button danger" disabled={busy}>Sitzung abbrechen</button>} />}
      </aside></div>
    </>}</Layout>;
}

function Play() {
  const { sessionId = "" } = useParams();
  return <PlayerSession key={sessionId} sessionId={sessionId} />;
}

const runningStatuses = ["COUNTDOWN", "QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"];

function DeleteOwnData({ sessionId, status, onDeleted }: { sessionId: string; status: string; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = runningStatuses.includes(status);
  async function remove() {
    setBusy(true); setError("");
    try { await cloud.deleteMyParticipation(sessionId); onDeleted(); }
    catch (caught) { setError(message(caught)); setBusy(false); }
  }
  return <section className="delete-own-data" aria-labelledby="delete-own-data-heading">
    <h2 id="delete-own-data-heading">Meine Spieldaten</h2>
    <ErrorBanner error={error} />
    <ConfirmDialog title="Spieldaten löschen?" confirmLabel="Ja, endgültig löschen"
      description={running ? "Während einer laufenden Frage ist das Löschen nicht möglich. Bitte warte auf die Auflösung." :
        "Deine Teilnahme, Antworten und Punkte werden endgültig gelöscht. Du verlässt damit das Spiel und kannst nicht mehr weiterspielen."}
      confirmDisabled={busy || running} onConfirm={() => void remove()}
      trigger={<button className="button secondary" disabled={busy || running}>
        {busy ? "Wird gelöscht …" : "Meine Spieldaten löschen"}</button>} />
    {running && <p className="delete-hint">Während einer laufenden Frage nicht möglich. Nach der Auflösung kannst du löschen.</p>}
  </section>;
}

function PlayerSession({ sessionId }: { sessionId: string }) {
  const [participant, setParticipant] = useState<Participation | null>(null);
  const [error, setError] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [selection, setSelection] = useState<{ questionId: string; choiceId: string } | null>(null);
  const [pending, setPending] = useState<{ questionId: string; choiceId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringAnswer, setRestoringAnswer] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoredQuestion, setRestoredQuestion] = useState<string | null>(null);
  const [result, setResult] = useState<MyResult | null>(null);
  const [resultError, setResultError] = useState("");
  const [standing, setStanding] = useState<PersonalStanding | null>(null);
  const [deleted, setDeleted] = useState(false);
  const sending = useRef(false);
  const answerRequest = useRef(0);
  const unconfirmed = useRef<{ questionId: string; choiceId: string } | null>(null);
  const { state, offset, error: liveError, refresh, recoveryVersion } = useLiveState(sessionId, "guest");
  const currentQuestion = useRef(state?.questionId);
  currentQuestion.current = state?.questionId;
  useEffect(() => {
    answerRequest.current++;
    sending.current = false; unconfirmed.current = null;
    setSelection(null); setPending(null); setBusy(false); setAnswerError(""); setRestoredQuestion(null);
  }, [state?.questionId]);
  useEffect(() => () => { answerRequest.current++; }, []);
  useEffect(() => {
    let active = true;
    cloud.myParticipation(sessionId).then((value) => { if (active) { setParticipant(value); setError(""); } },
      (caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [sessionId, recoveryVersion, restoreAttempt]);
  useEffect(() => {
    const player = state?.leaderboard.find((item) => item.participantId === participant?.participantId);
    if (state && player) setStanding({ questionIndex: state.questionIndex, player });
  }, [state, participant]);
  useEffect(() => {
    if (!state?.questionId || ["LOBBY", "CANCELLED"].includes(state.status)) {
      setRestoringAnswer(false); setRestoreError("");
      return;
    }
    if (busy) return;
    let active = true;
    const request = answerRequest.current;
    const questionId = state.questionId;
    const isCurrent = () => active && request === answerRequest.current && currentQuestion.current === questionId;
    setRestoringAnswer(true); setRestoreError("");
    cloud.myAnswer(sessionId).then((value) => {
      if (!isCurrent()) return;
      if (value.questionId === questionId) {
        setSelection(value.choiceId ? { questionId, choiceId: value.choiceId } : null);
        setRestoredQuestion(questionId);
        if (!unconfirmed.current || (unconfirmed.current.questionId === questionId &&
            unconfirmed.current.choiceId === value.choiceId)) {
          unconfirmed.current = null;
          setAnswerError("");
        }
      } else {
        setRestoreError("Die Frage wurde inzwischen geändert. Bitte den Spielstand erneut prüfen.");
        refresh();
      }
    }, (caught) => { if (isCurrent()) setRestoreError(message(caught)); })
      .finally(() => { if (isCurrent()) setRestoringAnswer(false); });
    return () => { active = false; };
  }, [sessionId, state?.questionId, state?.status, restoreAttempt, recoveryVersion, busy]);
  useEffect(() => {
    if (!state?.questionId || !["REVEAL", "LEADERBOARD", "FINISHED"].includes(state.status)) {
      setResultError("");
      return;
    }
    let active = true;
    cloud.result(sessionId).then((value) => { if (active && value.questionId === state.questionId) { setResult(value); setResultError(""); } },
      (caught) => { if (active) setResultError(message(caught)); });
    return () => { active = false; };
  }, [sessionId, state?.questionId, state?.status, restoreAttempt, recoveryVersion]);
  async function answer(choiceId: string) {
    if (!state?.questionId || state.status !== "QUESTION_OPEN" || sending.current || restoringAnswer ||
        restoreError || restoredQuestion !== state.questionId || state.closesAt == null ||
        Date.now() + offset >= state.closesAt ||
        (selection?.questionId === state.questionId && selection.choiceId === choiceId)) return;
    const questionId = state.questionId;
    const request = ++answerRequest.current;
    const isCurrent = () => request === answerRequest.current && currentQuestion.current === questionId;
    sending.current = true;
    unconfirmed.current = null;
    setBusy(true); setAnswerError(""); setPending({ questionId, choiceId });
    try {
      await cloud.answer(sessionId, questionId, choiceId);
      if (isCurrent()) { setSelection({ questionId, choiceId }); refresh(); }
    }
    catch (caught) {
      if (!isCurrent()) return;
      unconfirmed.current = { questionId, choiceId };
      setAnswerError(`Antwort nicht bestätigt: ${message(caught)} Deine gespeicherte Antwort wird erneut geprüft. Solange die Frage offen ist, kannst du danach erneut antworten.`);
      setRestoredQuestion(null); setRestoreAttempt((attempt) => attempt + 1); refresh();
    } finally {
      if (isCurrent()) { sending.current = false; setBusy(false); setPending(null); }
    }
  }
  if (deleted) return <Layout gameMode="player"><h1>Deine Spieldaten wurden gelöscht</h1>
    <p>Teilnahme, Antworten und Punkte wurden entfernt. Die technische Browser-Kennung bleibt bis zu ihrem Ablauf bestehen,
      damit sie für andere offene Spielrunden verfügbar bleibt.</p>
    <Link className="button primary" to="/">Zur Startseite</Link></Layout>;
  return <Layout gameMode="player"><ErrorBanner error={liveError || restoreError || resultError || error || answerError} />
    {(restoreError || resultError || error || liveError) && <button className="button secondary" onClick={() => {
      setError(""); setRestoreAttempt((attempt) => attempt + 1); refresh();
    }}>{restoreError ? "Gespeicherte Antwort erneut prüfen" : "Spielstand erneut prüfen"}</button>}
    {state ? <GameView state={state} offset={offset} participant={participant} personal standing={standing}
      selected={selection && selection.questionId === state.questionId ? selection.choiceId : null}
      pendingChoice={pending?.questionId === state.questionId ? pending?.choiceId : null}
      answerBusy={busy || restoringAnswer || Boolean(restoreError) || restoredQuestion !== state.questionId} answerRestoreFailed={Boolean(restoreError)}
      onAnswer={(choiceId) => void answer(choiceId)}
      result={result?.questionId === state.questionId && ["REVEAL", "LEADERBOARD", "FINISHED"].includes(state.status) ? result : null} /> : <p>Spielstand wird geladen …</p>}
    {state && participant && <DeleteOwnData sessionId={sessionId} status={state.status} onDeleted={() => setDeleted(true)} />}
  </Layout>;
}

function Presentation() {
  const { presentationToken = "" } = useParams();
  return <PresentationSession key={presentationToken} token={presentationToken} />;
}

function PresentationSession({ token }: { token: string }) {
  const live = useLiveState("", "presentation", token);
  return <Layout gameMode="presentation"><ErrorBanner error={live.error} />
    {live.error && <button className="button secondary" onClick={live.refresh}>Verbindung erneut prüfen</button>}
    {live.state ? <GameView state={live.state} offset={live.offset} presentation /> : <p>Präsentation wird geladen …</p>}
  </Layout>;
}

export function CloudApp() {
  return <Routes><Route path="/" element={<Home />} />
    <Route path="/admin" element={<AdminGate><Overview /></AdminGate>} />
    <Route path="/admin/quizzes/:quizId" element={<AdminGate><EditorPage /></AdminGate>} />
    <Route path="/admin/quizzes/:quizId/publish" element={<AdminGate><PublishAsyncPage /></AdminGate>} />
    <Route path="/admin/async/:publicationId" element={<AdminGate><AsyncAdminResultsPage /></AdminGate>} />
    <Route path="/admin/sessions/:sessionId" element={<AdminGate><AdminSession /></AdminGate>} />
    <Route path="/q/:token" element={<AsyncQuizPage />} />
    <Route path="/einladung/:code" element={<InvitationPage />} />
    <Route path="/join" element={<Join />} /><Route path="/join/:joinCode" element={<Join />} />
    <Route path="/play/:sessionId" element={<Play />} /><Route path="/present/:presentationToken" element={<Presentation />} />
    <Route path="/impressum" element={<Layout><ImpressumPage /></Layout>} />
    <Route path="/datenschutz" element={<Layout><PrivacyPolicyPage /></Layout>} />
    <Route path="*" element={<Layout><h1>Seite nicht gefunden</h1><Link to="/">Zur Startseite</Link></Layout>} />
  </Routes>;
}
