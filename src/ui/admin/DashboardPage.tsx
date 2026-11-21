import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Clock3, Layers, Plus, Radio, Sparkles, Trophy as TrophyIcon, Users, Zap } from "lucide-react";
import { cloud, type AsyncPublicationSummary, type QuizSummary, type SessionSummary } from "../../cloud";
import { CATEGORY_LABELS, categoryOf } from "../../domain/categories";
import { exampleQuiz } from "../../domain/exampleQuiz";
import { formatDateTimeWithZone } from "../../domain/localTime";
import { CategoryIcon } from "../CategoryIcon";
import { categoryToneClass } from "../categories";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { message } from "../common/message";
import { StreakBonusOption } from "../game/Rewards";
import { Sparkle } from "../Illustrations";
import { LlamaMascot } from "../OverviewIllustrations";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import { ArchiveRow, ArchiveSection } from "./Archive";
import { AsyncPublicationCard } from "./AsyncPublicationCard";
import {
  archivedSessionLabel, asyncStatusText, ENDED_SESSION_STATUSES, liveAsyncStatus, phaseLabels, questionCountLabel,
} from "./dashboardStatus";
import "../neu.css";
import "../overview.css";
import "../quizzes.css";
import "./admin.css";

const loadDashboard = async () => Promise.all([cloud.listQuizzes(), cloud.listSessions(), cloud.listAsyncPublications()]);
type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

/** Cloud overview of the quizmaster: quiz library, live sessions and published quiz rounds. */
export function DashboardPage() {
  usePageTitle("Deine Quizze");
  const [bonusOptions, setBonusOptions] = useState<Record<string, boolean>>({});
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [asyncPublications, setAsyncPublications] = useState<AsyncPublicationSummary[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const apply = useCallback(([nextQuizzes, nextSessions, nextPublications]: DashboardData) => {
    setQuizzes(nextQuizzes); setSessions(nextSessions); setAsyncPublications(nextPublications); setLoadedAt(Date.now());
  }, []);
  useEffect(() => {
    let live = true;
    loadDashboard().then((data) => { if (live) apply(data); }, (caught) => { if (live) setError(message(caught)); });
    return () => { live = false; };
  }, [apply]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); apply(await loadDashboard()); } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  const activeSessions = sessions.filter((session) => !ENDED_SESSION_STATUSES.has(session.status));
  const endedSessions = sessions.filter((session) => ENDED_SESSION_STATUSES.has(session.status));
  const now = loadedAt;
  const isActivePublication = (publication: AsyncPublicationSummary) =>
    liveAsyncStatus(publication.status, publication.expiresAt, now) === "ACTIVE";
  const activePublications = asyncPublications.filter(isActivePublication);
  const endedPublications = asyncPublications.filter((publication) => !isActivePublication(publication))
    .sort((left, right) => (right.endedAt ?? right.expiresAt) - (left.endedAt ?? left.expiresAt));
  const participations = asyncPublications.reduce((sum, publication) => sum + publication.participantCount, 0);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stats = [
    { label: quizzes.length === 1 ? "Quiz" : "Quizze", value: quizzes.length, icon: Layers, tone: "rl-tone-yellow" },
    { label: "Live-Sitzungen laufen", value: activeSessions.length, icon: Radio, tone: "rl-tone-pink" },
    { label: "Quizrunden aktiv", value: activePublications.length, icon: TrophyIcon, tone: "rl-tone-green" },
    { label: participations === 1 ? "Teilnahme an Quizrunden" : "Teilnahmen an Quizrunden", value: participations, icon: Users, tone: "rl-tone-blue" },
  ];

  return <div className="rl-adm-page">
    <header className="rl-overview-header rl-adm-header">
      <div className="rl-adm-header-text">
        <span className="rl-eyebrow">DEIN QUIZMASTER-BEREICH</span>
        <h1 className="rl-title rl-overview-title">Deine Quizze <Sparkle className="rl-title-sparkle" /></h1>
        <p className="rl-overview-lead">Bereite Fragen vor, starte ein Live-Spiel oder teile eine Runde zum Mitmachen.</p>
        <div className="rl-adm-header-actions">
          <Link className="rl-new-quiz-button" to={routes.newQuiz}>
            <span className="rl-new-quiz-plus" aria-hidden="true"><Plus strokeWidth={3.4} /></span>Neues Quiz
          </Link>
          <Link className="rl-btn rl-btn-secondary" to={routes.generate}><Bot aria-hidden="true" /> Quiz mit KI erstellen</Link>
        </div>
      </div>
      <LlamaMascot className="rl-adm-header-art" />
    </header>
    <ErrorNotice error={error} />
    {!loadedAt ? !error && <LoadingNotice>Deine Quizze werden geladen …</LoadingNotice> : <>
      <ul className="rl-adm-stats" aria-label="Kennzahlen">
        {stats.map(({ label, value, icon: Icon, tone }) => <li key={label} className={`rl-adm-stat ${tone}`}>
          <span className="rl-adm-stat-icon" aria-hidden="true"><Icon strokeWidth={2.4} /></span>
          <span className="rl-adm-stat-text"><span className="rl-adm-stat-value">{value}</span>
            <span className="rl-adm-stat-label">{label}</span></span>
        </li>)}
      </ul>
      <ul className="mode-compare rl-adm-modes" aria-label="Spielmodi">
        <li><Zap aria-hidden="true" /><span><strong>Live-Quiz</strong> – alle spielen gleichzeitig</span></li>
        <li><Clock3 aria-hidden="true" /><span><strong>Quiz zum Mitmachen</strong> – jeder spielt in seinem Tempo</span></li>
      </ul>

      <div className="grid quiz-library">
        {quizzes.map((record) => <article className={`card library-card ${categoryToneClass(record.category)}`} key={record.quizId}>
          <div className="quiz-cover">
            <span className="rl-adm-quiz-icon"><CategoryIcon category={record.category} /></span>
            <span className="badge">{questionCountLabel(record.questionCount)}</span>
          </div>
          <h2><Link to={routes.quiz(record.quizId)}>{record.title}</Link></h2>
          <p className="rl-adm-quiz-category">{CATEGORY_LABELS[categoryOf(record.category)]}</p>
          <p className="rl-adm-quiz-desc">{record.description || "Ohne Beschreibung"}</p>
          <div className="rl-adm-card-actions">
            <Link className="rl-btn rl-btn-secondary rl-btn-small" to={routes.editQuiz(record.quizId)}>Bearbeiten</Link>
            <button type="button" className="rl-btn rl-btn-primary rl-btn-small" disabled={busy} onClick={() => void run(async () => {
              const session = await cloud.createSession(record.quizId, bonusOptions[record.quizId] ?? false);
              navigate(routes.session(session.sessionId));
            })}>Live-Quiz starten</button>
            <details className="live-start-options rl-details"><summary>Live-Spielregeln</summary>
              <div className="rl-details-body">
                <StreakBonusOption enabled={bonusOptions[record.quizId] ?? false} disabled={busy}
                  onChange={(enabled) => setBonusOptions((current) => ({ ...current, [record.quizId]: enabled }))} />
              </div>
            </details>
            <Link className="rl-btn rl-btn-secondary rl-btn-small" to={routes.publish(record.quizId)}>Quizrunde veröffentlichen</Link>
            <button type="button" className="rl-btn rl-btn-secondary rl-btn-small" disabled={busy}
              onClick={() => void run(async () => { await cloud.duplicateQuiz(record.quizId); })}>Duplizieren</button>
            <ConfirmDialog title="Quiz löschen?" confirmLabel="Quiz löschen"
              description={`„${record.title}“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
              onConfirm={() => void run(async () => { await cloud.deleteQuiz(record.quizId, record.version); })}
              confirmDisabled={busy}
              trigger={<button type="button" className="rl-btn rl-btn-danger-soft rl-btn-small" disabled={busy}>Löschen</button>} />
          </div>
        </article>)}
        <button type="button" className="card rl-adm-add-card" disabled={busy}
          onClick={() => void run(async () => { await cloud.createQuiz(exampleQuiz); })}>
          <Sparkles aria-hidden="true" />Beispielquiz hinzufügen<span className="rl-hint">10 Fragen als Starthilfe</span>
        </button>
      </div>

      <section className="rl-adm-section" aria-labelledby="adm-sessions-title">
        <div className="rl-adm-section-head"><span className="rl-eyebrow">SPIELVERLAUF</span><h2 id="adm-sessions-title">Sitzungen</h2>
          <p>Laufende Live-Quizze stehen oben, beendete findest du eingeklappt darunter.</p></div>
        {sessions.length === 0 ? <p className="rl-adm-muted">Noch keine Sitzungen vorhanden.</p> : <>
          {activeSessions.length === 0 ? <p className="archive-empty">Gerade läuft keine Live-Sitzung.</p> : <div className="grid session-grid">
            {activeSessions.map((session) => <article className="card rl-adm-session-card" key={session.sessionId}>
              <h3>{session.title}</h3>
              <span className="badge">{phaseLabels[session.status] ?? session.status}</span>
              <p className="rl-adm-session-code">Spielcode {session.joinCode}</p>
              <Link className="rl-btn rl-btn-secondary rl-btn-small" to={routes.session(session.sessionId)}>Sitzung öffnen</Link>
            </article>)}
          </div>}
          <ArchiveSection label="Beendete Sitzungen" count={endedSessions.length}>
            {endedSessions.map((session) => <ArchiveRow key={session.sessionId} title={session.title}
              status={archivedSessionLabel(session.status)} to={routes.session(session.sessionId)} action="Sitzung öffnen">
              <span className="archive-meta-item"><Clock3 aria-hidden="true" />
                Erstellt am {formatDateTimeWithZone(session.createdAt, browserTimeZone)}</span>
            </ArchiveRow>)}
          </ArchiveSection>
        </>}
      </section>

      <section className="rl-adm-section" aria-labelledby="adm-rounds-title">
        <div className="rl-adm-section-head"><span className="rl-eyebrow">QUIZ ZUM MITMACHEN</span>
          <h2 id="adm-rounds-title">Veröffentlichte Quizrunden</h2>
          <p>Teile deine Quizrunde. Alle spielen in ihrem Tempo bis zum angegebenen Ende.</p></div>
        {asyncPublications.length === 0 ? <p className="rl-adm-muted">Noch keine Quizrunden veröffentlicht.</p> : <>
          {activePublications.length === 0 ? <p className="archive-empty">Gerade ist keine Quizrunde aktiv.</p> : <div className="grid async-publication-grid">
            {activePublications.map((publication) => <AsyncPublicationCard key={publication.publicationId} publication={publication} now={now}
              busy={busy} onEnd={() => void run(async () => { await cloud.endAsyncPublication(publication.publicationId); })} />)}
          </div>}
          <ArchiveSection label="Beendete Quizrunden" count={endedPublications.length}>
            {endedPublications.map((publication) => <ArchiveRow key={publication.publicationId} title={publication.title}
              status={asyncStatusText(liveAsyncStatus(publication.status, publication.expiresAt, now))}
              to={routes.asyncResults(publication.publicationId)} action="Ergebnisse ansehen">
              <span className="archive-meta-item"><Clock3 aria-hidden="true" />
                Beendet am {formatDateTimeWithZone(publication.endedAt ?? publication.expiresAt, publication.timeZone)}</span>
              <span className="archive-meta-item"><Users aria-hidden="true" />
                {publication.participantCount} gestartet · {publication.completedCount} fertig</span>
            </ArchiveRow>)}
          </ArchiveSection>
        </>}
      </section>
    </>}
  </div>;
}
