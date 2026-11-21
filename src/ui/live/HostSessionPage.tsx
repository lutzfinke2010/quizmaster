import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cloud, type SessionSummary } from "../../cloud";
import { useLiveState } from "../../hooks/useLiveState";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CopyAction } from "../common/CopyAction";
import { JoinCodeBlock } from "../common/JoinCodeBlock";
import { message } from "../common/message";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import { LiveGameView } from "./LiveGameView";
import { phaseLabel } from "./phaseLabels";
import "./live.css";

type SessionQuestion = { questionId: string; index: number; text: string };

/** Quizmaster console of a live round (`/admin/sessions/:sessionId`, inside the admin layout). */
export function HostSessionPage() {
  const { sessionId = "" } = useParams();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { state, offset, error: liveError, refresh } = useLiveState(sessionId, "admin");
  usePageTitle(state?.title ?? session?.title ?? "Live-Runde");
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
  const ended = state ? ["FINISHED", "CANCELLED"].includes(state.status) : false;
  const title = state?.title ?? session?.title ?? "";
  const joinCode = session?.joinCode || state?.joinCode || undefined;
  const presentationUrl = session ? `${window.location.origin}${routes.presentation(session.presentationToken)}` : "";
  return <div className="rl-live-host">
    <div className="rl-live-host-nav">
      <Link className="rl-btn rl-btn-ghost rl-btn-small" to={routes.admin}><ArrowLeft aria-hidden="true" />Zur Übersicht</Link>
      {session && <a className="rl-btn rl-btn-secondary rl-btn-small" href={routes.presentation(session.presentationToken)}
        target="_blank" rel="noreferrer">Präsentationsansicht öffnen <ExternalLink aria-hidden="true" /></a>}
    </div>
    <ErrorNotice error={error || liveError} />
    {!state ? <LoadingNotice>Spielstand wird geladen …</LoadingNotice> : <div className="rl-live-host-grid">
      <section className="rl-live-host-preview" aria-label="Vorschau des geteilten Bildschirms">
        <div className="rl-live-host-preview-head">
          <p className="rl-live-title">{title}</p>
          <span className="rl-pill rl-live-phase">{phaseLabel(state.status)}</span>
        </div>
        <LiveGameView key={state.sessionId} variant="preview" state={state} offset={offset} joinCode={joinCode} />
      </section>
      <div className="rl-live-host-side">
        <aside className="rl-card rl-live-controls" aria-label="Sitzung steuern">
          <span className="rl-eyebrow">QUIZMASTER</span>
          <h2 className="rl-h2">Du gibst den Takt vor.</h2>
          <p className="rl-live-controls-status">{phaseLabel(state.status)} · Frage {Math.max(0, state.questionIndex + 1)} von {state.questionCount}</p>
          {state.status === "QUESTION_OPEN" && <p className="rl-hint">Die Frist läuft automatisch ab. Vorzeitiges Schließen ist optional.</p>}
          {["COUNTDOWN", "QUESTION_CLOSED", "SCORING"].includes(state.status) &&
            <p className="rl-hint" role="status">Der Server führt automatisch zur nächsten Phase.</p>}
          <div className="rl-live-controls-main">
            {state.status === "LOBBY" && next && <button type="button" className="rl-btn rl-btn-primary rl-btn-block" disabled={busy}
              onClick={() => void run(() => cloud.control("startQuestion", sessionId, next.questionId, state.version))}>Erste Frage starten</button>}
            {state.status === "QUESTION_OPEN" && state.questionId && <button type="button" className="rl-btn rl-btn-secondary rl-btn-block"
              disabled={busy} onClick={() => void run(() => cloud.control("closeQuestion", sessionId, state.questionId!, state.version))}>
              Frage vorzeitig schließen</button>}
            {state.status === "REVEAL" && <button type="button" className="rl-btn rl-btn-primary rl-btn-block" disabled={busy}
              onClick={() => void run(() => cloud.transition("showLeaderboard", sessionId, state.version))}>Zwischenstand anzeigen</button>}
            {state.status === "LEADERBOARD" && next && <button type="button" className="rl-btn rl-btn-primary rl-btn-block" disabled={busy}
              onClick={() => void run(() => cloud.control("nextQuestion", sessionId, next.questionId, state.version))}>Nächste Frage starten</button>}
            {state.status === "LEADERBOARD" && state.questionIndex === state.questionCount - 1 &&
              <button type="button" className="rl-btn rl-btn-primary rl-btn-block" disabled={busy}
                onClick={() => void run(() => cloud.transition("finishSession", sessionId, state.version))}>Endstand anzeigen</button>}
            {ended && <Link className="rl-btn rl-btn-primary rl-btn-block" to={routes.admin}>Zur Quizübersicht</Link>}
          </div>
          {!ended && <div className="rl-live-controls-extra">
            <ConfirmDialog title="Sitzung abbrechen?" variant="warning"
              description="Die Live-Runde endet sofort für alle Teilnehmenden und kann nicht fortgesetzt werden."
              confirmLabel="Sitzung abbrechen" confirmDisabled={busy}
              onConfirm={() => void run(() => cloud.transition("cancelSession", sessionId, state.version))}
              trigger={<button type="button" className="rl-btn rl-btn-danger-soft rl-btn-small" disabled={busy}>Sitzung abbrechen</button>} />
          </div>}
        </aside>
        {session && <section className="rl-card rl-live-share" aria-labelledby="share-title">
          <h2 id="share-title" className="rl-h3">Mitspielen und zeigen</h2>
          {joinCode && <>
            <JoinCodeBlock joinCode={joinCode} title={title} />
            <div className="rl-live-share-qr">
              <QRCodeSVG value={`${window.location.origin}${routes.join(joinCode)}`} size={132} bgColor="#ffffff" fgColor="#183a30"
                marginSize={1} title="QR-Code zum Beitreten" />
              <p className="rl-hint">Beitreten unter <strong>{window.location.origin}/join</strong></p>
            </div>
          </>}
          <div className="rl-live-share-presentation">
            <p className="rl-hint">Die Präsentationsansicht zeigt Fragen, Auflösung und Rangliste auf einem geteilten Bildschirm –
              ganz ohne Steuerung.</p>
            <CopyAction text={presentationUrl} label="Präsentationslink kopieren" copiedMessage="Präsentationslink kopiert."
              fieldLabel={`Präsentationslink für ${title}`} />
          </div>
        </section>}
      </div>
    </div>}
  </div>;
}
