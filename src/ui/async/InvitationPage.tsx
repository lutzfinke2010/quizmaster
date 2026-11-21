import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Maximize2, RotateCw, X } from "lucide-react";
import { cloud } from "../../cloud";
import { formatDateTimeWithZone } from "../../domain/localTime";
import { useNoIndex } from "../../hooks/useNoIndex";
import { displayHost, displayQuizLink, formatJoinCode, normalizeJoinCodeInput, shortQuizLink } from "../../shareLinks";
import { LlamaHead } from "../Illustrations";
import { LlamaCharacter } from "../LlamaCharacter";
import { message } from "../common/message";
import { routes } from "../routes";
import { StageLayout } from "../shell/StageLayout";
import { usePageTitle } from "../usePageTitle";
import "../llama.css";
import "./async.css";

type PublicInfo = Awaited<ReturnType<typeof cloud.asyncPublicInfo>>;

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

class QrBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Real, locally rendered QR code; reports "ready" only once modules were actually drawn. */
function InvitationQr({ value, onReady, onError }: { value: string; onReady: () => void; onError: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const path = boxRef.current?.querySelector("svg path:last-of-type");
    if (path && (path.getAttribute("d") ?? "").length > 0) onReady();
    else onError();
  }, [onReady, onError]);
  if (!value) throw new Error("Kein bestätigter Teilnahmelink.");
  return <div className="invitation-qr-box" ref={boxRef}>
    <QRCodeSVG value={value} level="M" marginSize={4} bgColor="#ffffff" fgColor="#0f2a1d"
      title="QR-Code zum Mitspielen" />
  </div>;
}

function InvitationBrand() {
  return <header className="invitation-brand">
    <span className="invitation-brand-logo"><LlamaHead className="invitation-brand-mark" aria-hidden="true" />
      <span className="invitation-brand-name">RateLama</span></span>
  </header>;
}

export function InvitationPage() {
  useNoIndex();
  const { code: rawCode = "" } = useParams();
  const navigate = useNavigate();
  const normalized = normalizeJoinCodeInput(rawCode);
  const code = normalized.code;
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loadError, setLoadError] = useState(normalized.error);
  const [loading, setLoading] = useState(!normalized.error);
  const [clockOffset, setClockOffset] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [qrState, setQrState] = useState<"pending" | "ready" | "failed">("pending");
  const [qrAttempt, setQrAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenHint, setFullscreenHint] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  usePageTitle(info ? `Einladung: ${info.title}` : "Einladung");

  const load = useCallback(async () => {
    if (!code) return;
    const current = ++requestRef.current;
    try {
      const value = await cloud.asyncPublicInfo(code);
      if (current !== requestRef.current) return;
      if (typeof value.serverTime === "number") setClockOffset(value.serverTime - Date.now());
      setClock(Date.now());
      setInfo(value);
      setLoadError("");
    } catch (caught) {
      if (current === requestRef.current) setLoadError(message(caught));
    } finally {
      if (current === requestRef.current) setLoading(false);
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);
  // Re-sync with the server when returning to the view and periodically during a presentation.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [load]);
  // Deadline based on the confirmed server time: switch to the end state right when it passes.
  const expiresAt = info?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) return;
    const remaining = expiresAt - (Date.now() + clockOffset);
    if (remaining <= 0 || remaining > 2_147_000_000) return;
    const timer = window.setTimeout(() => setClock(Date.now()), remaining + 250);
    return () => window.clearTimeout(timer);
  }, [expiresAt, clockOffset]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const qrReady = useCallback(() => setQrState("ready"), []);
  const qrFailed = useCallback(() => setQrState("failed"), []);
  function retryQr() {
    setQrState("pending");
    setQrAttempt((value) => value + 1);
    void load();
  }

  async function enterFullscreen() {
    setFullscreenHint("");
    const target = stageRef.current;
    if (!document.fullscreenEnabled || !target?.requestFullscreen) {
      setFullscreenHint("Vollbild wird von diesem Browser nicht unterstützt. Nutze die Vollbildfunktion des Browsers oder erstelle den Screenshot direkt.");
      return;
    }
    try { await target.requestFullscreen(); }
    catch { setFullscreenHint("Vollbild konnte nicht gestartet werden. Nutze die Vollbildfunktion des Browsers."); }
  }
  function close() {
    window.close();
    // Tabs not opened by script cannot be closed: fall back to the admin area.
    window.setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) navigate(-1);
      else navigate(routes.admin);
    }, 150);
  }

  const confirmedCode = info?.joinCode ?? null;
  const now = clock + clockOffset;
  const ended = info !== null && (info.status !== "ACTIVE" || now >= info.expiresAt);
  // Show QR and code only after the server confirmed the assignment – never a guessed code.
  const codeMismatch = info !== null && !ended && confirmedCode !== code;
  const link = confirmedCode ? shortQuizLink(confirmedCode) : "";
  const titleSize = info ? info.title.length > 80 ? "xl" : info.title.length > 45 ? "lg" : "md" : "md";

  let body: ReactNode;
  if (loading) {
    body = <p className="invitation-status rl-card" role="status">Einladung wird geladen …</p>;
  } else if (!info) {
    body = <div className="invitation-status rl-card" role="alert">
      <LlamaCharacter mood="surprised" className="invitation-status-llama" aria-hidden="true" />
      <h1 className="rl-h2">Einladung nicht verfügbar</h1>
      <p>{loadError || "Diese Quizrunde gibt es nicht oder sie ist nicht mehr verfügbar."}</p>
      {code && <button type="button" className="rl-btn rl-btn-secondary" onClick={() => { setLoading(true); void load(); }}>
        <RotateCw aria-hidden="true" />Erneut versuchen</button>}
    </div>;
  } else if (ended) {
    body = <article className="invitation-card is-ended" aria-label="Quizrunde beendet">
      <InvitationBrand />
      <div className="invitation-ended">
        <div className="invitation-ended-text">
          <span className="invitation-eyebrow">QUIZ ZUM MITMACHEN</span>
          <h1 className={`invitation-title size-${titleSize}`} lang="de">{info.title}</h1>
          <p className="invitation-ended-status" role="status">Diese Quizrunde ist beendet.</p>
          <p>Beendet am {formatDateTimeWithZone(info.endedAt ?? info.expiresAt, info.timeZone, "long")}.
            Mitspielen ist nicht mehr möglich.</p>
        </div>
        <LlamaCharacter mood="proud" className="invitation-ended-llama" aria-hidden="true" />
      </div>
    </article>;
  } else if (codeMismatch || qrState === "failed") {
    body = <div className="invitation-status rl-card" role="alert">
      <LlamaCharacter mood="surprised" className="invitation-status-llama" aria-hidden="true" />
      <h1 className="rl-h2">QR-Code konnte nicht erzeugt werden</h1>
      <p>{codeMismatch ? "Der Quiz-Code dieser Runde ist noch nicht bestätigt." : "Beim Erzeugen des QR-Codes ist ein Fehler aufgetreten."}
        {" "}Es wird keine unvollständige Einladung angezeigt.</p>
      <button type="button" className="rl-btn rl-btn-primary" onClick={retryQr}><RotateCw aria-hidden="true" />Erneut versuchen</button>
    </div>;
  } else {
    body = <article className={`invitation-card${qrState === "ready" ? " is-ready" : ""}`} aria-label={`Einladung: ${info.title}`}
      data-ready={qrState === "ready" ? "true" : "false"} aria-busy={qrState !== "ready"}>
      <InvitationBrand />
      <div className="invitation-main">
        <div className="invitation-text">
          <span className="invitation-eyebrow">QUIZ ZUM MITMACHEN</span>
          <h1 className={`invitation-title size-${titleSize}`} lang="de">{info.title}</h1>
          <p className="invitation-lead">Scannen oder Code eingeben. Spiele in deinem Tempo.</p>
          <div className="invitation-code">
            <span className="invitation-code-label">DEIN QUIZ-CODE</span>
            <strong className="invitation-code-digits" aria-label={`Quiz-Code ${code.split("").join(" ")}`}>{formatJoinCode(code)}</strong>
            <span className="invitation-code-how">{displayHost()} öffnen → Mitspielen → Quiz-Code eingeben</span>
          </div>
        </div>
        <figure className="invitation-qr">
          <QrBoundary key={`${qrAttempt}:${link}`} onError={qrFailed}>
            <InvitationQr value={link} onReady={qrReady} onError={qrFailed} />
          </QrBoundary>
          <figcaption>Scannen &amp; mitspielen</figcaption>
        </figure>
      </div>
      <footer className="invitation-footer">
        <span>Mitspielen bis <strong>{formatDateTimeWithZone(info.expiresAt, info.timeZone, "long")}</strong></span>
        <span className="invitation-link">{displayQuizLink(code)}</span>
      </footer>
    </article>;
  }

  const toolbar = <div className="invitation-toolbar" role="toolbar" aria-label="Einladung">
    {fullscreenHint ? <span className="invitation-toolbar-hint" role="status">{fullscreenHint}</span>
      : <span className="invitation-toolbar-hint">Vollbild mit Esc verlassen · Screenshot mit den Mitteln deines Systems</span>}
    <button type="button" className="rl-btn rl-btn-secondary rl-btn-small" onClick={() => void enterFullscreen()}>
      <Maximize2 aria-hidden="true" />Vollbild</button>
    <button type="button" className="rl-btn rl-btn-secondary rl-btn-small" onClick={close}><X aria-hidden="true" />Schließen</button>
  </div>;

  return <StageLayout footer={false} aside={toolbar} className={`invitation-page${fullscreen ? " is-fullscreen" : ""}`}>
    <div className="invitation-stage" ref={stageRef}>{body}</div>
  </StageLayout>;
}
