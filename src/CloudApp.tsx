import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { ConnectionState, CONNECTION_STATE_CHANGE } from "aws-amplify/api";
import { ArrowRight, Clock3, Copy, KeyRound, Plus, Sparkles } from "lucide-react";
import { cloud, type AsyncGuestState, type AsyncPublicationResults, type AsyncPublicationSummary, type GameState, type MyResult, type Participation, type QuizRecord, type SessionSummary } from "./cloud";
import { exampleQuiz } from "./domain/exampleQuiz";
import { QuizEditor } from "./QuizEditor";
import type { Quiz } from "./domain/quiz";
import { AdminGate } from "./AdminAuth";
import { ErrorBanner, Layout, message } from "./components/Layout";
import { HomeContent } from "./components/HomeContent";
import { Avatar, GameView, phaseLabels, type PersonalStanding } from "./components/GameView";
import { PrivacyNote } from "./components/Privacy";
import { ImpressumPage, PrivacyPolicyPage } from "./components/LegalPages";
import { formatDateTimeInZone, possibleInstants } from "./domain/localTime";
import { legal } from "./config/legal";

function Home() {
  return <Layout><HomeContent /></Layout>;
}

function useNoIndex() {
  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const existed = Boolean(tag);
    const previous = tag?.content;
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "robots";
      document.head.append(tag);
    }
    tag.content = "noindex,nofollow";
    return () => {
      if (!tag) return;
      if (existed && previous !== undefined) tag.content = previous;
      else tag.remove();
    };
  }, []);
}

function AsyncPublicationCard({ publication, busy, onEnd }: {
  publication: AsyncPublicationSummary; busy: boolean; onEnd: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const href = `${window.location.origin}/q/${publication.token}`;
  const status = publication.status === "ACTIVE" ? "Aktiv" :
    publication.status === "ENDED" ? "Vorzeitig beendet" : "Abgelaufen";
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Zwischenablage nicht verfügbar.");
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      input.current?.focus();
      input.current?.select();
      setCopied(false);
    }
  }
  return <article className="card async-publication-card">
    <span className="badge">{status}</span><h3>{publication.title}</h3>
    <p><Clock3 size={16} aria-hidden="true" /> Ende: {formatDateTimeInZone(publication.endedAt ?? publication.expiresAt, publication.timeZone)} ({publication.timeZone})</p>
    <p>{publication.participantCount} von {publication.maxParticipants} Teilnahmen gestartet · {publication.completedCount} abgeschlossen · {publication.partialCount} unvollständig</p>
    <label className="field">Teilnahmelink
      <input ref={input} readOnly value={href} onFocus={(event) => event.currentTarget.select()} aria-label={`Teilnahmelink für ${publication.title}`} />
    </label>
    {copied && <p role="status">Link kopiert.</p>}
    <div className="actions">
      <button className="button secondary small" onClick={() => void copy()}><Copy size={16} />Link kopieren</button>
      <Link className="button primary small" to={`/admin/async/${publication.publicationId}`}>Ergebnisse ansehen</Link>
      {publication.status === "ACTIVE" && Date.now() < publication.expiresAt &&
        <button className="button danger small" disabled={busy} onClick={onEnd}>Vorzeitig beenden</button>}
    </div>
  </article>;
}

function Overview() {
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
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
  return <Layout><div className="section-heading"><div><span className="eyebrow">DEINE IDEEN, DEINE BÜHNE</span><h1>Deine Quizze</h1>
    <p>Eine gute Frage ist der Anfang einer großartigen Runde.</p></div>
    <div className="actions"><Link className="button primary" to="/admin/quizzes/new"><Plus size={18} aria-hidden="true" /> Neues Quiz</Link>
      <button className="button secondary" disabled={busy} onClick={() => void logout()}>Abmelden</button></div></div>
    <ErrorBanner error={error} />
    <p>Wähle den Modus: <strong>Live-Quiz</strong> – alle spielen gleichzeitig. <strong>Quiz per Link</strong> – jeder spielt im eigenen Tempo bis zum Ablaufdatum.</p>
    <div className="grid">
      {quizzes.map((record) => <article className="card" key={record.quizId}><span className="badge">{record.quiz.questions.length} Fragen</span>
        <h2>{record.quiz.title}</h2><p>{record.quiz.description || "Ohne Beschreibung"}</p><div className="actions">
          <Link className="button small secondary" to={`/admin/quizzes/${record.quizId}`}>Bearbeiten</Link>
          <button className="button small primary" disabled={busy} onClick={() => void run(async () => {
            const session = await cloud.createSession(record.quizId); navigate(`/admin/sessions/${session.sessionId}`);
          })}>Live-Quiz starten</button>
          <Link className="button small secondary" to={`/admin/quizzes/${record.quizId}/publish`}>Quiz per Link veröffentlichen</Link>
          <button className="button small secondary" disabled={busy} onClick={() => void run(async () => { await cloud.duplicateQuiz(record.quizId); })}>Duplizieren</button>
          <button className="button small secondary" disabled={busy} onClick={() => {
            if (window.confirm(`„${record.quiz.title}“ wirklich löschen?`)) void run(async () => { await cloud.deleteQuiz(record.quizId, record.version); });
          }}>Löschen</button>
        </div></article>)}
      <button className="card add-card" disabled={busy} onClick={() => void run(async () => { await cloud.createQuiz(exampleQuiz); })}>
        <Sparkles size={28} aria-hidden="true" />Beispielquiz hinzufügen<span className="hint">10 Fragen als Starthilfe</span></button>
    </div><div className="section-heading"><div><span className="eyebrow">SPIELVERLAUF</span><h2>Sitzungen</h2>
      <p>Verfügbare laufende und vergangene Sitzungen.</p></div></div>
    {sessions.length === 0 ? <p>Noch keine Sitzungen vorhanden.</p> : <div className="grid">
      {sessions.map((session) => <article className="card" key={session.sessionId}><h2>{session.title}</h2>
        <span className="badge">{phaseLabels[session.status] ?? session.status}</span><p>Spielcode {session.joinCode}</p>
        <Link className="button secondary small" to={`/admin/sessions/${session.sessionId}`}>Sitzung öffnen</Link></article>)}
    </div>}
    <div className="section-heading"><div><span className="eyebrow">QUIZ PER LINK</span><h2>Veröffentlichte Runden</h2>
      <p>Asynchron spielen – jeder im eigenen Tempo bis zum Ablaufdatum.</p></div></div>
    {asyncPublications.length === 0 ? <p>Noch keine Quizze per Link veröffentlicht.</p> : <div className="grid">
      {asyncPublications.map((publication) => <AsyncPublicationCard key={publication.publicationId} publication={publication}
        busy={busy} onEnd={() => {
          if (window.confirm(`„${publication.title}“ jetzt für alle Teilnehmenden beenden?`)) {
            void run(async () => { await cloud.endAsyncPublication(publication.publicationId); });
          }
        }} />)}
    </div>}
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [publication, setPublication] = useState<Awaited<ReturnType<typeof cloud.publishAsyncQuiz>> | null>(null);
  const requestId = useRef<{ expiresAt: number; timeZone: string; id: string } | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const instants = localDate ? possibleInstants(localDate, timeZone) : [];
  useEffect(() => {
    let active = true;
    cloud.getQuiz(quizId).then((value) => { if (active) setRecord(value); },
      (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId]);
  useEffect(() => {
    if (instants.length === 1) setSelectedInstant(String(instants[0]));
    else setSelectedInstant("");
  }, [localDate, timeZone]);
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!record || !selectedInstant) return;
    const expiresAt = Number(selectedInstant);
    if (expiresAt <= Date.now()) { setError("Das Ablaufdatum muss in der Zukunft liegen."); return; }
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
  const link = publication ? `${window.location.origin}/q/${publication.token}` : "";
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link>
    <div className="section-heading"><div><span className="eyebrow">QUIZ PER LINK</span><h1>Quiz veröffentlichen</h1>
      <p>Alle Gäste spielen unabhängig im eigenen Tempo. Das Live-Quiz bleibt davon unberührt.</p></div></div>
    <ErrorBanner error={error} />
    {loading ? <p>Quiz wird geladen …</p> : !record ? <p>Quiz nicht gefunden.</p> : publication ? <section className="card async-published">
      <span className="badge">Veröffentlicht</span><h2>{record.quiz.title}</h2>
      <p>Deadline: {formatDateTimeInZone(publication.expiresAt, publication.timeZone)} ({publication.timeZone})</p>
      <p>Maximale Teilnehmerzahl: {publication.maxParticipants}</p>
      <p>Ergebnisse werden {publication.retentionDays} Tage nach dem Ablaufdatum aufbewahrt.</p>
      <label className="field">Teilnahmelink
        <input ref={linkInput} readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Teilnahmelink" />
      </label>
      <button className="button primary" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setLinkCopied(true); }
        catch { linkInput.current?.focus(); linkInput.current?.select(); setLinkCopied(false); }
      }}><Copy size={17} /> Link kopieren</button>
      {linkCopied && <p role="status">Link kopiert.</p>}
      <p><Link to="/admin">Zur Übersicht und Ergebnisverwaltung</Link></p>
    </section> : <form className="card async-publish-form" onSubmit={(event) => void publish(event)}>
      <span className="badge">{record.quiz.questions.length} Fragen</span><h2>{record.quiz.title}</h2>
      <label className="field" htmlFor="async-deadline">Ablaufdatum und Uhrzeit</label>
      <input id="async-deadline" type="datetime-local" required value={localDate} disabled={busy}
        onChange={(event) => setLocalDate(event.target.value)} />
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
        {busy ? "Wird veröffentlicht …" : "Quiz veröffentlichen"}
      </button>
    </form>}
  </Layout>;
}

function AsyncQuizPage() {
  useNoIndex();
  const { token = "" } = useParams();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof cloud.asyncPublicInfo>> | null>(null);
  const [state, setState] = useState<AsyncGuestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const canAnswer = info?.status === "ACTIVE" && clock < (info?.expiresAt ?? 0);
  useEffect(() => {
    if (!info || !state || state.status !== "ACTIVE" || clock < info.expiresAt) return;
    let active = true;
    cloud.myAsyncState(token).then((latest) => {
      if (active && latest) setState(latest);
    }, (caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [clock, info, state, token]);
  useEffect(() => {
    let active = true;
    cloud.asyncPublicInfo(token).then(async (value) => {
      if (!active) return;
      setInfo(value);
      try {
        const existing = await cloud.myAsyncState(token);
        if (active && existing) {
          await cloud.extendGuestIdentityUntil(existing.retentionAt);
          setState(existing);
        }
      } catch (caught) { if (active) setError(message(caught)); }
    }, (caught) => { if (active) setError(message(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => { setChoice(""); setNotice(""); }, [state?.nextQuestionIndex]);
  async function start() {
    setBusy(true); setError("");
    try {
      if (!info) throw new Error("Quizinformationen fehlen.");
      await cloud.extendGuestIdentityUntil(info.retentionAt);
      setState(await cloud.startAsyncQuiz(token));
    }
    catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }
  async function submitAnswer() {
    const question = state?.question;
    if (!question || !choice || busy || !canAnswer) return;
    setBusy(true); setError(""); setNotice("Wird gespeichert …");
    try {
      await cloud.submitAsyncAnswer(token, question.questionIndex, choice);
      setState(await cloud.myAsyncState(token));
      setNotice("Antwort gespeichert.");
    } catch (caught) {
      try {
        const latest = await cloud.myAsyncState(token);
        const confirmed = latest?.answers.find((answer) => answer.questionIndex === question.questionIndex);
        if (latest) setState(latest);
        if (confirmed?.choiceId === choice) setNotice("Antwort wurde bestätigt.");
        else {
          setNotice("");
          setError(confirmed
            ? "Ein anderer Tab hat bereits eine Antwort bestätigt. Der Serverstand wurde geladen."
            : `Antwort nicht bestätigt: ${message(caught)} Deine Auswahl bleibt erhalten.`);
        }
      } catch {
        setNotice("");
        setError(`Antwort nicht bestätigt: ${message(caught)} Deine Auswahl bleibt erhalten. Prüfe die Verbindung und versuche es erneut.`);
      }
    } finally { setBusy(false); }
  }
  return <Layout gameMode="player"><Link className="back" to="/">← Zur Startseite</Link>
    {loading ? <p>Quiz wird geladen …</p> : !info ? <div className="empty"><h1>Teilnahmelink nicht verfügbar</h1>
      <p>Dieser Link ist ungültig oder die Ergebnisse wurden bereits gelöscht.</p></div> : <>
      <div className="async-quiz-heading"><span className="eyebrow">QUIZ PER LINK · IM EIGENEN TEMPO</span><h1>{info.title}</h1>
        <p>{info.description}</p><p><Clock3 size={17} aria-hidden="true" /> Deadline: {formatDateTimeInZone(info.expiresAt, info.timeZone)} ({info.timeZone})</p>
        <p>{info.questionCount} Fragen. Deine Antworten werden einzeln gespeichert. Maximal {info.maxParticipants} Teilnahmen.</p></div>
      <ErrorBanner error={error} />
      {state ? <section className="card async-player-card">
        <div className="async-player-identity"><Avatar avatarId={state.avatarId} /><strong>{state.displayName}</strong></div>
        {state.status === "ACTIVE" && canAnswer && state.question ? <>
          <p>Frage {state.question.questionIndex + 1} von {state.questionCount}</p>
          {state.expiresAt - clock <= 10 * 60 * 1000 && <p className="deadline-warning" role="status">
            Weniger als zehn Minuten bis zur Deadline.
          </p>}
          <h2>{state.question.text}</h2>
          <p>Deine bestätigten Antworten sind endgültig und können nicht geändert werden.</p>
          <div className="async-options">{state.question.answers.map((answer) =>
            <label className={`async-option${choice === answer.id ? " selected" : ""}`} key={answer.id}>
              <input type="radio" name="async-answer" value={answer.id} checked={choice === answer.id} disabled={busy}
                onChange={() => setChoice(answer.id)} />
              <span>{answer.text}</span>
            </label>)}</div>
          <button className="button primary" disabled={!choice || busy || !canAnswer} onClick={() => void submitAnswer()}>
            {busy ? "Wird gespeichert …" : "Antwort abgeben"}
          </button>
          {notice && <p role="status">{notice}</p>}
        </> : state.attemptStatus === "COMPLETED" || state.status !== "ACTIVE" || !canAnswer ? <>
          <h2>{state.attemptStatus === "COMPLETED" ? "Quiz abgeschlossen" : "Quiz beendet"}</h2>
          <p>{state.answeredCount} von {state.questionCount} Fragen beantwortet.
            {state.attemptStatus === "EXPIRED_PARTIAL" && " Nicht beantwortete Fragen zählen als 0 Punkte."}</p>
          {state.status !== "ACTIVE" && <><p>Dein Ergebnis: {state.points ?? 0} von {state.questionCount} Punkten</p>
            <ol className="async-own-results">{state.results.map((result) => <li key={result.questionIndex}>
              <strong>Frage {result.questionIndex + 1}: {result.questionText}</strong>
              <p>{result.answered ? result.correct ? "Richtig." : "Falsch." : "Nicht beantwortet."}</p>
              {result.selectedText && <p>Deine Antwort: {result.selectedText}.</p>}
              {result.correctText && <p>Richtige Antwort: {result.correctText}.</p>}
              {result.explanation && <p>{result.explanation}</p>}
            </li>)}</ol>
          </>}
        </> : null}
      </section> : info.status === "ACTIVE" && canAnswer ? <section className="card async-player-card">
        <h2>Du spielst in deinem Tempo</h2><p>Deine Antworten werden gespeichert. Du kannst bis zum Ablaufdatum teilnehmen.</p>
        <button className="button primary" disabled={busy} onClick={() => void start()}>
          {busy ? "Quiz wird geöffnet …" : "Quiz starten"}
        </button>
      </section> : <section className="card async-player-card"><h2>Diese Quizrunde ist beendet</h2>
        <p>Die Quizrunde endete am {formatDateTimeInZone(info.endedAt ?? info.expiresAt, info.timeZone)} ({info.timeZone}).</p></section>}
    </>}
  </Layout>;
}

function AsyncAdminResultsPage() {
  useNoIndex();
  const { publicationId = "" } = useParams();
  const [results, setResults] = useState<AsyncPublicationResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    const result = await cloud.asyncPublicationResults(publicationId);
    setResults(result); setError("");
  }, [publicationId]);
  useEffect(() => {
    let active = true;
    refresh().catch((caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);
  async function reload() {
    setRefreshing(true);
    try { await refresh(); } catch (caught) { setError(message(caught)); } finally { setRefreshing(false); }
  }
  async function loadMore() {
    if (!results?.nextCursor) return;
    setRefreshing(true);
    try {
      const next = await cloud.asyncPublicationResults(publicationId, results.nextCursor);
      setResults((current) => current && ({ ...next, participants: [...current.participants, ...next.participants] }));
    } catch (caught) { setError(message(caught)); } finally { setRefreshing(false); }
  }
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link>
    <ErrorBanner error={error} />
    {loading ? <p>Ergebnisse werden geladen …</p> : !results ? <p>Ergebnisse nicht verfügbar.</p> : <>
      <div className="section-heading"><div><span className="eyebrow">QUIZ PER LINK</span><h1>{results.title}</h1>
        <p>{results.isFinal ? "Endergebnis" : "Vorläufiger Stand – weitere Antworten sind möglich"} ·
          {results.participantCount} von {results.maxParticipants} gestartet · {results.completedCount} abgeschlossen · {results.partialCount} unvollständig</p>
        <p>Deadline: {formatDateTimeInZone(results.expiresAt, results.timeZone)} ({results.timeZone})</p>
        <p>Aktualisiert: {new Date(results.updatedAt).toLocaleString("de-DE")}</p></div>
        <button className="button secondary" disabled={refreshing} onClick={() => void reload()}>{refreshing ? "Wird aktualisiert …" : "Aktualisieren"}</button></div>
      <section><h2>Auswertung je Frage</h2><div className="grid">
        {results.questions.map((question) => <article className="card" key={question.questionIndex}>
          <h3>Frage {question.questionIndex + 1}: {question.text}</h3>
          <p>{question.answeredCount} Antworten · {results.participantCount - question.answeredCount} nicht beantwortet</p>
          {question.answeredCount === 0 ? <p>Noch keine Antworten.</p> : question.options.map((option) =>
            <p key={option.id} className={option.correct ? "async-correct-option" : ""}>{option.text}: {option.count} (
              {Math.round(option.count / question.answeredCount * 100)}%){option.correct && " · richtig"}</p>)}
        </article>)}
      </div></section>
      <section><h2>Teilnehmer und Rang</h2>{results.participants.length === 0 ? <p>Noch keine Teilnehmer.</p> :
        <div className="grid">{results.participants.map((player) => <details className="card async-result-player"
          key={`${player.displayName}-${player.startedAt}`}><summary>
            <span className="async-player-identity"><Avatar avatarId={player.avatarId} />
              <strong>Rang {player.rank} · {player.displayName}</strong></span>
            <span>{player.points}/{player.questionCount} Punkte · {player.status === "COMPLETED" ? "abgeschlossen" :
              player.status === "IN_PROGRESS" ? "in Bearbeitung" : "Frist abgelaufen"}</span>
            <span>{player.answeredCount}/{player.questionCount} beantwortet</span>
          </summary><ol>{player.answers.map((answer) => {
            const question = results.questions[answer.questionIndex];
            const option = question?.options.find((item) => item.id === answer.choiceId);
            const correct = question?.options.find((item) => item.correct);
            return <li key={answer.questionIndex}><strong>{question?.text}</strong><p>Antwort: {option?.text ?? "Unbekannt"}
              {answer.correct ? " · richtig" : ` · falsch (richtig: ${correct?.text ?? "unbekannt"})`}</p>
              <p>{new Date(answer.acceptedAt).toLocaleString("de-DE")}</p></li>;
          })}</ol></details>)}</div>}
        {results.nextCursor && <button className="button secondary" disabled={refreshing} onClick={() => void loadMore()}>
          {refreshing ? "Weitere Ergebnisse werden geladen …" : "Weitere Teilnehmer laden"}
        </button>}
      </section>
    </>}
  </Layout>;
}

function Join() {
  const { joinCode = "" } = useParams();
  const [code, setCode] = useState(joinCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const participant = await cloud.join(code); navigate(`/play/${participant.sessionId}`); }
    catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  return <Layout><div className="login-card join-card"><span className="login-icon"><KeyRound size={27} aria-hidden="true" /></span>
    <span className="eyebrow">DEIN PLATZ IST NOCH FREI</span><h1>Spiel beitreten</h1><p>Gib den sechsstelligen Spielcode ein. Ein Konto ist nicht nötig.</p>
    <ErrorBanner error={error} /><form onSubmit={submit}><label className="field">Spielcode
      <input className="code-input" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} required value={code}
        placeholder="123456" disabled={busy} aria-describedby="join-code-hint"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
      <span className="hint" id="join-code-hint">Den Code bekommst du von deinem Quizmaster.</span>
      <button className="button primary" disabled={busy}>{busy ? "Du trittst bei …" : "Beitreten"}<ArrowRight size={18} aria-hidden="true" /></button></form>
      <PrivacyNote /></div></Layout>;
}

type LiveMode = "admin" | "guest" | "presentation";
function useLiveState(sessionId: string, mode: LiveMode, token?: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const version = useRef(-1);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!sessionId && !token) return;
    let resolvedSessionId = sessionId;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    let subscription: ReturnType<typeof cloud.subscribe> | undefined;
    let eventRefresh: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let again = false;
    let wantedVersion = -1;
    version.current = -1;
    setState(null); setError(""); setConnectionError("");
    function schedule() {
      if (!active || retry) return;
      retry = setTimeout(() => { retry = undefined; connect(); void refresh(); }, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
    async function refresh() {
      if (inFlight) { again = true; return; }
      inFlight = true;
      try {
        const start = Date.now();
        const next = token ? await cloud.presentation(token) : await cloud.gameState(sessionId, mode === "admin" ? "admin" : "guest");
        const end = Date.now();
        if (!active) return;
        if (resolvedSessionId && next.sessionId !== resolvedSessionId) throw new Error("Unerwartete Sitzung im Spielstand.");
        if (!resolvedSessionId) { resolvedSessionId = next.sessionId; connect(); }
        if (next.version >= version.current) {
          version.current = next.version; setState(next); setOffset(next.serverTime - (start + end) / 2);
        }
        setError("");
        if (next.version < wantedVersion) again = true;
      } catch (caught) { if (active) { setError(`Verbindung unterbrochen: ${message(caught)}`); schedule(); } }
      finally {
        inFlight = false;
        if (active && again) { again = false; void refresh(); }
      }
    }
    function connect() {
      if (!resolvedSessionId) return;
      subscription?.unsubscribe();
      subscription = cloud.subscribe(resolvedSessionId, mode === "admin" ? "admin" : "guest", token ?? null,
        (nextVersion) => { backoff = 1000; setConnectionError(""); wantedVersion = Math.max(wantedVersion, nextVersion);
          if (nextVersion > version.current && !eventRefresh) {
            eventRefresh = setTimeout(() => { eventRefresh = undefined; void refresh(); }, 250);
          } },
        (caught) => { if (active) { setConnectionError(`Echtzeitverbindung unterbrochen: ${message(caught)}`); schedule(); } });
    }
    const cancelHub = Hub.listen("api", ({ payload }) => {
      if (payload.event === CONNECTION_STATE_CHANGE && payload.data && typeof payload.data === "object" &&
          "connectionState" in payload.data && payload.data.connectionState === ConnectionState.Connected) {
        backoff = 1000; setConnectionError(""); setRecoveryVersion((value) => value + 1); void refresh();
      }
    });
    function reconnect() {
      backoff = 1000; setConnectionError(""); connect(); void refresh(); setRecoveryVersion((value) => value + 1);
    }
    function offline() { setConnectionError("Du bist offline. Sobald die Verbindung zurück ist, wird der Spielstand erneut geladen."); }
    window.addEventListener("offline", offline);
    window.addEventListener("online", reconnect);
    refreshRef.current = () => { void refresh(); };
    connect(); void refresh();
    return () => { active = false; if (retry) clearTimeout(retry); if (eventRefresh) clearTimeout(eventRefresh);
      subscription?.unsubscribe(); cancelHub();
      window.removeEventListener("offline", offline); window.removeEventListener("online", reconnect); };
  }, [sessionId, mode, token]);
  return { state: token || state?.sessionId === sessionId ? state : null, offset, error: connectionError || error,
    recoveryVersion, refresh: () => refreshRef.current() };
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
    Promise.all([cloud.listSessions(), cloud.questions(sessionId)]).then(([sessions, nextQuestions]) => {
      if (!active) return;
      const current = sessions.find((item) => item.sessionId === sessionId);
      if (!current) throw new Error("Sitzung nicht gefunden oder abgelaufen.");
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
        {!["FINISHED", "CANCELLED"].includes(state.status) && <button className="button danger" disabled={busy}
          onClick={() => { if (window.confirm("Diese Sitzung wirklich abbrechen?")) void run(() => cloud.transition("cancelSession", sessionId, state.version)); }}>
          Sitzung abbrechen</button>}
      </aside></div>
    </>}</Layout>;
}

function Play() {
  const { sessionId = "" } = useParams();
  return <PlayerSession key={sessionId} sessionId={sessionId} />;
}

const runningStatuses = ["COUNTDOWN", "QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"];

function DeleteOwnData({ sessionId, status, onDeleted }: { sessionId: string; status: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
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
    {confirming ? <>
      <p>Deine Teilnahme, Antworten und Punkte werden gelöscht. Du verlässt damit das Spiel und kannst nicht mehr weiterspielen.</p>
      <div className="actions">
        <button className="button primary" disabled={busy || running} onClick={() => void remove()}>
          {busy ? "Wird gelöscht …" : "Ja, endgültig löschen"}</button>
        <button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Abbrechen</button>
      </div>
    </> : <>
      <button className="button secondary" disabled={running} onClick={() => setConfirming(true)}>Meine Spieldaten löschen</button>
      {running && <p className="delete-hint">Während einer laufenden Frage nicht möglich. Nach der Auflösung kannst du löschen.</p>}
    </>}
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
    <Route path="/join" element={<Join />} /><Route path="/join/:joinCode" element={<Join />} />
    <Route path="/play/:sessionId" element={<Play />} /><Route path="/present/:presentationToken" element={<Presentation />} />
    <Route path="/impressum" element={<Layout><ImpressumPage /></Layout>} />
    <Route path="/datenschutz" element={<Layout><PrivacyPolicyPage /></Layout>} />
    <Route path="*" element={<Layout><h1>Seite nicht gefunden</h1><Link to="/">Zur Startseite</Link></Layout>} />
  </Routes>;
}
