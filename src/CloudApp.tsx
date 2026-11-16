import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { ConnectionState, CONNECTION_STATE_CHANGE } from "aws-amplify/api";
import { ArrowRight, KeyRound, Plus, Sparkles } from "lucide-react";
import { cloud, type GameState, type MyResult, type Participation, type QuizRecord, type SessionSummary } from "./cloud";
import { exampleQuiz } from "./domain/exampleQuiz";
import { QuizEditor } from "./QuizEditor";
import type { Quiz } from "./domain/quiz";
import { AdminGate } from "./AdminAuth";
import { ErrorBanner, Layout, message } from "./components/Layout";
import { HomeContent } from "./components/HomeContent";
import { GameView, phaseLabels, type PersonalStanding } from "./components/GameView";
import { PrivacyNote } from "./components/Privacy";
import { ImpressumPage, PrivacyPolicyPage } from "./components/LegalPages";

function Home() {
  return <Layout><HomeContent /></Layout>;
}

function Overview() {
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const refresh = useCallback(async () => {
    const [nextQuizzes, nextSessions] = await Promise.all([cloud.listQuizzes(), cloud.listSessions()]);
    setQuizzes(nextQuizzes); setSessions(nextSessions);
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
    <ErrorBanner error={error} /><div className="grid">
      {quizzes.map((record) => <article className="card" key={record.quizId}><span className="badge">{record.quiz.questions.length} Fragen</span>
        <h2>{record.quiz.title}</h2><p>{record.quiz.description || "Ohne Beschreibung"}</p><div className="actions">
          <Link className="button small secondary" to={`/admin/quizzes/${record.quizId}`}>Bearbeiten</Link>
          <button className="button small primary" disabled={busy} onClick={() => void run(async () => {
            const session = await cloud.createSession(record.quizId); navigate(`/admin/sessions/${session.sessionId}`);
          })}>Sitzung erstellen</button>
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
    </div>}</Layout>;
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
    <Route path="/admin/sessions/:sessionId" element={<AdminGate><AdminSession /></AdminGate>} />
    <Route path="/join" element={<Join />} /><Route path="/join/:joinCode" element={<Join />} />
    <Route path="/play/:sessionId" element={<Play />} /><Route path="/present/:presentationToken" element={<Presentation />} />
    <Route path="/impressum" element={<Layout><ImpressumPage /></Layout>} />
    <Route path="/datenschutz" element={<Layout><PrivacyPolicyPage /></Layout>} />
    <Route path="*" element={<Layout><h1>Seite nicht gefunden</h1><Link to="/">Zur Startseite</Link></Layout>} />
  </Routes>;
}
