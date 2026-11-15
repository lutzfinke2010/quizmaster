import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { ConnectionState, CONNECTION_STATE_CHANGE } from "aws-amplify/api";
import { QRCodeSVG } from "qrcode.react";
import { motion, useReducedMotion } from "motion/react";
import { cloud, type GameState, type Participation, type QuizRecord, type SessionSummary } from "./cloud";
import { exampleQuiz } from "./domain/exampleQuiz";
import { QuizEditor } from "./QuizEditor";
import type { Quiz } from "./domain/quiz";
import { AdminGate } from "./AdminAuth";
import { ErrorBanner, Layout, message } from "./components/Layout";
function Home() {
  return <Layout><div className="hero"><span className="eyebrow">DIE QUIZSHOW FÜR ALLE</span>
    <h1>Wissen trifft <span className="gradient">Spielfreude.</span></h1>
    <p>Fragen vorbereiten, Freunde herausfordern und gemeinsam rätseln.</p>
    <div className="actions"><Link className="button primary" to="/join">Spiel beitreten</Link>
      <Link className="button secondary" to="/admin">Quiz vorbereiten</Link></div>
    <p>Die Antwortzeit wird auf dem Server gemessen. Der Weg deiner Antwort über das Netzwerk zählt mit.</p>
  </div></Layout>;
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
  return <Layout><div className="section-heading"><div><span className="eyebrow">DEINE IDEEN</span><h1>Deine Quizze</h1></div>
    <div className="actions"><Link className="button primary" to="/admin/quizzes/new">Neues Quiz</Link>
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
      <button className="card add-card" disabled={busy} onClick={() => void run(async () => { await cloud.createQuiz(exampleQuiz); })}>Beispielquiz hinzufügen</button>
    </div><div className="section-heading"><div><span className="eyebrow">SPIELVERLAUF</span><h2>Sitzungen</h2>
      <p>Verfügbare laufende und vergangene Sitzungen.</p></div></div>
    {sessions.length === 0 ? <p>Noch keine Sitzungen vorhanden.</p> : <div className="grid">
      {sessions.map((session) => <article className="card" key={session.sessionId}><h2>{session.title}</h2>
        <p>Code {session.joinCode} · {session.status}</p>
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
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link><h1>{record ? "Quiz bearbeiten" : "Neues Quiz"}</h1>
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
  return <Layout><div className="login-card"><h1>Spiel beitreten</h1><p>Gib den sechsstelligen Spielcode ein. Ein Konto ist nicht nötig.</p>
    <ErrorBanner error={error} /><form onSubmit={submit}><label className="field">Spielcode
      <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
      <button className="button primary" disabled={busy}>Beitreten</button></form></div></Layout>;
}

type LiveMode = "admin" | "guest" | "presentation";
function useLiveState(sessionId: string, mode: LiveMode, token?: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const version = useRef(-1);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!sessionId) return;
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
        if (!active || next.sessionId !== sessionId) return;
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
      subscription?.unsubscribe();
      subscription = cloud.subscribe(sessionId, mode === "admin" ? "admin" : "guest", token ?? null,
        (nextVersion) => { backoff = 1000; setConnectionError(""); wantedVersion = Math.max(wantedVersion, nextVersion);
          if (nextVersion > version.current && !eventRefresh) {
            eventRefresh = setTimeout(() => { eventRefresh = undefined; void refresh(); }, 250);
          } },
        (caught) => { if (active) { setConnectionError(`Echtzeitverbindung unterbrochen: ${message(caught)}`); schedule(); } });
    }
    const cancelHub = Hub.listen("api", ({ payload }) => {
      if (payload.event === CONNECTION_STATE_CHANGE && payload.data && typeof payload.data === "object" &&
          "connectionState" in payload.data && payload.data.connectionState === ConnectionState.Connected) {
        backoff = 1000; setConnectionError(""); void refresh();
      }
    });
    refreshRef.current = () => { void refresh(); };
    connect(); void refresh();
    return () => { active = false; if (retry) clearTimeout(retry); if (eventRefresh) clearTimeout(eventRefresh);
      subscription?.unsubscribe(); cancelHub(); };
  }, [sessionId, mode, token]);
  return { state, offset, error: connectionError || error, refresh: () => refreshRef.current() };
}

function Avatar({ avatarId }: { avatarId: string }) {
  const hues = ["#88edff", "#ff9fca", "#b7fa63", "#ffd77a", "#c5a6ff"];
  const index = [...avatarId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % hues.length;
  return <svg className="avatar" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill={hues[index]} /><circle cx="22" cy="27" r="4" fill="#211a40" />
    <circle cx="42" cy="27" r="4" fill="#211a40" /><path d="M22 40 Q32 50 42 40" fill="none" stroke="#211a40" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}
function Timer({ deadline, offset }: { deadline: number; offset: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  return <span className="timer" aria-label="Verbleibende Zeit">{Math.max(0, Math.ceil((deadline - now - offset) / 1000))}</span>;
}
function JoinDetails({ code }: { code: string }) {
  const url = `${window.location.origin}/join/${code}`;
  return <div className="join-details"><QRCodeSVG value={url} size={160} bgColor="#ffffff" title="QR-Code zum Beitreten" />
    <div><p>Beitreten unter <strong>{window.location.origin}/join</strong></p><p className="join-code">{code}</p></div></div>;
}
function LobbyPlayers({ players }: { players: GameState["participants"] }) {
  const reducedMotion = useReducedMotion();
  return <div className="players">{players.map((player) => <motion.div className="player-tag" key={player.participantId}
    initial={reducedMotion ? false : { opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }}>
    <Avatar avatarId={player.avatarId} /> {player.displayName}</motion.div>)}</div>;
}
function GameView({ state, offset, participant, onAnswer, answerBusy, selected, result, presentation = false }: {
  state: GameState; offset: number; participant?: Participation | null;
  onAnswer?: (choiceId: string) => void; answerBusy?: boolean; selected?: string | null;
  result?: { answered: boolean; correct: boolean; points: number } | null;
  presentation?: boolean;
}) {
  const phase = state.status;
  return <><div className="section-heading"><div><span className="eyebrow">LIVE-SITZUNG</span>
    <h1>{state.title}</h1><p>{state.participantCount} Teilnehmende · {phase === "LOBBY" ? "Lobby" :
      `Frage ${Math.max(0, state.questionIndex + 1)} von ${state.questionCount}`}</p></div>
    {participant && <div className="player-tag"><Avatar avatarId={participant.avatarId} /> {participant.displayName}</div>}</div>
    {phase === "LOBBY" && <><p>Die Runde beginnt, sobald der Quizmaster startet.</p>
      {state.joinCode && <JoinDetails code={state.joinCode} />}
      {state.participants.length === 0 ? <p>Noch niemand dabei. Teile den Spielcode!</p> :
        <LobbyPlayers players={state.participants} />}</>}
    {phase === "COUNTDOWN" && state.opensAt && <div className="empty"><h2>Gleich geht’s los!</h2><Timer deadline={state.opensAt} offset={offset} /></div>}
    {phase === "SCORING" || phase === "QUESTION_CLOSED" ? <div className="empty"><h2>Wird ausgewertet …</h2></div> : null}
    {state.question && ["QUESTION_OPEN", "REVEAL", "LEADERBOARD", "FINISHED"].includes(phase) && <>
      <section className="question-card"><div className="question-heading"><h2>{state.question.text}</h2>
        {phase === "QUESTION_OPEN" && state.closesAt && <Timer deadline={state.closesAt} offset={offset} />}</div>
        {phase === "QUESTION_OPEN" && <p>{state.answerCount} von {state.eligibleParticipantCount} Antworten eingegangen</p>}
        <div className="answer-grid">{state.question.answers.map((answer, index) => {
          const correct = state.reveal?.correctChoiceId === answer.id;
          const count = state.reveal?.distribution.find((item) => item.choiceId === answer.id)?.count;
          return <button key={answer.id} type="button" className={`answer-tile answer-${index % 4}${correct ? " correct" : ""}`}
            disabled={!onAnswer || phase !== "QUESTION_OPEN" || Boolean(selected) || answerBusy}
            onClick={() => onAnswer?.(answer.id)}><b>{String.fromCharCode(65 + index)}</b> {answer.text}
            {correct && " ✓ Richtig"}{count !== undefined && ` · ${count} Stimmen`}</button>;
        })}</div>
        {selected && phase === "QUESTION_OPEN" && <p role="status">Antwort gespeichert!</p>}
        {state.reveal && <><h2>Auflösung</h2><p>{state.reveal.explanation || "Die richtige Antwort ist markiert."}</p>
          {result && <p>{!result.answered ? "Diesmal keine Antwort abgegeben." : result.correct ?
            `Richtig! Du erhältst ${result.points} Punkte.` : "Diesmal leider nicht richtig. Weiter geht’s!"}</p>}</>}
      </section></>}
    {(["LEADERBOARD", "FINISHED"].includes(phase) || (presentation && phase === "REVEAL")) && <section className="question-card">
      <h2>{phase === "FINISHED" ? "Endrangliste" : presentation ? "Top 5" : "Zwischenstand"}</h2>
      {phase === "FINISHED" && state.leaderboard.length > 0 && <div className="podium" aria-label="Siegerpodest">
        {state.leaderboard.slice(0, 3).map((player) => <div key={player.participantId}>
          <Avatar avatarId={player.avatarId} /><strong>Platz {player.rank}</strong><span>{player.displayName}</span></div>)}
      </div>}
      {participant && state.leaderboard.find((player) => player.participantId === participant.participantId) &&
        <p>Deine Platzierung: Platz {state.leaderboard.find((player) => player.participantId === participant.participantId)?.rank}</p>}
      {state.leaderboard.length ? <ol className="leaderboard">{(presentation && phase !== "FINISHED" ? state.leaderboard.slice(0, 5) : state.leaderboard).map((player) => <li key={player.participantId}>
        <span>#{player.rank} <Avatar avatarId={player.avatarId} /> {player.displayName}{participant?.participantId === player.participantId && " (du)"}</span>
        <span><span className="rank-change" aria-label={player.rankChange > 0 ? `${player.rankChange} Plätze aufgestiegen` :
          player.rankChange < 0 ? `${-player.rankChange} Plätze abgestiegen` : "Rang unverändert"}>
          {player.rankChange > 0 ? `↑${player.rankChange}` : player.rankChange < 0 ? `↓${-player.rankChange}` : "–"}</span>
          <strong>{player.points} Punkte</strong></span></li>)}</ol> : <p>Noch keine Teilnehmenden.</p>}</section>}
    {phase === "CANCELLED" && <div className="empty"><h2>Die Sitzung wurde abgebrochen.</h2></div>}
  </>;
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
  return <Layout><Link className="back" to="/admin">← Zur Übersicht</Link><ErrorBanner error={error || liveError} />
    {!state ? <p>Spielstand wird geladen …</p> : <>
      {state.status === "LOBBY" && session && <JoinDetails code={session.joinCode} />}
      {session && <p><a className="header-link" href={`/present/${session.presentationToken}`} target="_blank" rel="noreferrer">Präsentationsansicht öffnen ↗</a></p>}
      <GameView state={state} offset={offset} />
      <div className="actions">
        {state.status === "LOBBY" && next && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.control("startQuestion", sessionId, next.questionId, state.version))}>Erste Frage starten</button>}
        {state.status === "QUESTION_OPEN" && state.questionId && <button className="button secondary" disabled={busy}
          onClick={() => void run(() => cloud.control("closeQuestion", sessionId, state.questionId!, state.version))}>Frage vorzeitig schließen</button>}
        {state.status === "REVEAL" && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.transition("showLeaderboard", sessionId, state.version))}>Rangliste anzeigen</button>}
        {state.status === "LEADERBOARD" && next && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.control("nextQuestion", sessionId, next.questionId, state.version))}>Nächste Frage starten</button>}
        {state.status === "LEADERBOARD" && !next && <button className="button primary" disabled={busy}
          onClick={() => void run(() => cloud.transition("finishSession", sessionId, state.version))}>Spiel beenden</button>}
        {!["FINISHED", "CANCELLED"].includes(state.status) && <button className="button secondary" disabled={busy}
          onClick={() => { if (window.confirm("Diese Sitzung wirklich abbrechen?")) void run(() => cloud.transition("cancelSession", sessionId, state.version)); }}>
          Sitzung abbrechen</button>}
      </div>
    </>}</Layout>;
}

function Play() {
  const { sessionId = "" } = useParams();
  const [participant, setParticipant] = useState<Participation | null>(null);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<{ questionId: string; choiceId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringAnswer, setRestoringAnswer] = useState(false);
  const [result, setResult] = useState<{ answered: boolean; correct: boolean; points: number } | null>(null);
  const { state, offset, error: liveError, refresh } = useLiveState(sessionId, "guest");
  useEffect(() => {
    let active = true;
    cloud.myParticipation(sessionId).then((value) => { if (active) setParticipant(value); },
      (caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [sessionId]);
  useEffect(() => {
    setResult(null);
  }, [state?.questionId]);
  useEffect(() => {
    if (!state?.questionId || !["COUNTDOWN", "QUESTION_OPEN"].includes(state.status)) {
      setRestoringAnswer(false);
      return;
    }
    let active = true;
    setRestoringAnswer(true);
    cloud.myAnswer(sessionId).then((value) => {
      if (active && value.questionId && value.questionId === state.questionId && value.choiceId) {
        setSelection({ questionId: value.questionId, choiceId: value.choiceId });
      }
    }, (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setRestoringAnswer(false); });
    return () => { active = false; };
  }, [sessionId, state?.questionId, state?.status]);
  useEffect(() => {
    if (!state?.questionId || !["REVEAL", "LEADERBOARD", "FINISHED"].includes(state.status)) return;
    let active = true;
    cloud.result(sessionId).then((value) => { if (active && value.questionId === state.questionId) setResult(value); },
      (caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [sessionId, state?.questionId, state?.status]);
  async function answer(choiceId: string) {
    if (!state?.questionId || busy) return;
    const questionId = state.questionId;
    setBusy(true); setError("");
    try { await cloud.answer(sessionId, questionId, choiceId); setSelection({ questionId, choiceId }); refresh(); }
    catch (caught) { setError(message(caught)); refresh(); } finally { setBusy(false); }
  }
  return <Layout><ErrorBanner error={error || liveError} />
    {state ? <GameView state={state} offset={offset} participant={participant}
      selected={selection && selection.questionId === state.questionId ? selection.choiceId : null}
      answerBusy={busy || restoringAnswer} onAnswer={(choiceId) => void answer(choiceId)} result={result} /> : <p>Spielstand wird geladen …</p>}
  </Layout>;
}

function Presentation() {
  const { presentationToken = "" } = useParams();
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    cloud.presentation(presentationToken).then((state) => { if (active) setSessionId(state.sessionId); },
      (caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [presentationToken]);
  const live = useLiveState(sessionId, "presentation", presentationToken);
  return <Layout><ErrorBanner error={error || live.error} />
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
    <Route path="*" element={<Layout><h1>Seite nicht gefunden</h1><Link to="/">Zur Startseite</Link></Layout>} />
  </Routes>;
}
