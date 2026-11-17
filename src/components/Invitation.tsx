import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Maximize2, RotateCw, X } from "lucide-react";
import { cloud } from "../cloud";
import { formatDateTimeWithZone } from "../domain/localTime";
import { useNoIndex } from "../hooks/useNoIndex";
import { displayHost, displayQuizLink, formatJoinCode, normalizeJoinCodeInput, shortQuizLink } from "../shareLinks";
import { message } from "./Layout";

type PublicInfo = Awaited<ReturnType<typeof cloud.asyncPublicInfo>>;

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

class QrBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Echter, lokal erzeugter QR-Code; meldet erst nach tatsächlich gerenderten Modulen „bereit“. */
function InvitationQr({ value, onReady, onError }: { value: string; onReady: () => void; onError: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const path = box.current?.querySelector("svg path:last-of-type");
    if (path && (path.getAttribute("d") ?? "").length > 0) onReady();
    else onError();
  }, [value, onReady, onError]);
  if (!value) throw new Error("Kein bestätigter Teilnahmelink.");
  return <div className="invitation-qr-box" ref={box}>
    <QRCodeSVG value={value} level="M" marginSize={4} bgColor="#ffffff" fgColor="#0f2a1d"
      title="QR-Code zum Mitspielen" />
  </div>;
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
  const stage = useRef<HTMLDivElement>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!code) return;
    const current = ++request.current;
    try {
      const value = await cloud.asyncPublicInfo(code);
      if (current !== request.current) return;
      if (typeof value.serverTime === "number") setClockOffset(value.serverTime - Date.now());
      setClock(Date.now());
      setInfo(value);
      setLoadError("");
    } catch (caught) {
      if (current === request.current) setLoadError(message(caught));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);
  // Status beim Zurückkehren zur Ansicht und regelmäßig während einer Präsentation mit dem Server abgleichen.
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
  // Frist lokal anhand der bestätigten Serverzeit: Beim Ablauf sofort in den Endzustand wechseln.
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
    const target = stage.current;
    if (!document.fullscreenEnabled || !target?.requestFullscreen) {
      setFullscreenHint("Vollbild wird von diesem Browser nicht unterstützt. Nutze die Vollbildfunktion des Browsers oder erstelle den Screenshot direkt.");
      return;
    }
    try { await target.requestFullscreen(); }
    catch { setFullscreenHint("Vollbild konnte nicht gestartet werden. Nutze die Vollbildfunktion des Browsers."); }
  }
  function close() {
    window.close();
    // Nicht per Skript geöffnete Tabs lassen sich nicht schließen: dann zurück zur Verwaltung.
    window.setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) navigate(-1);
      else navigate("/admin");
    }, 150);
  }

  const confirmedCode = info?.joinCode ?? null;
  const now = clock + clockOffset;
  const ended = info !== null && (info.status !== "ACTIVE" || now >= info.expiresAt);
  // QR-Code und Code erst nach serverseitig bestätigter Zuordnung zeigen – niemals einen geratenen Code.
  const codeMismatch = info !== null && !ended && confirmedCode !== code;
  const link = confirmedCode ? shortQuizLink(confirmedCode) : "";
  const titleSize = info ? info.title.length > 80 ? "xl" : info.title.length > 45 ? "lg" : "md" : "md";

  let body: ReactNode;
  if (loading) {
    body = <p className="invitation-status" role="status">Einladung wird geladen …</p>;
  } else if (!info) {
    body = <div className="invitation-status" role="alert">
      <h1>Einladung nicht verfügbar</h1><p>{loadError || "Diese Quizrunde gibt es nicht oder sie ist nicht mehr verfügbar."}</p>
      {code && <button type="button" className="button secondary" onClick={() => { setLoading(true); void load(); }}>
        <RotateCw size={17} aria-hidden="true" />Erneut versuchen</button>}
    </div>;
  } else if (ended) {
    body = <article className="invitation-card is-ended" aria-label="Quizrunde beendet">
      <header className="invitation-brand"><img src="/brand/ratelama-logo.png" alt="RateLama" /></header>
      <div className="invitation-ended">
        <span className="invitation-eyebrow">QUIZ ZUM MITMACHEN</span>
        <h1 className={`invitation-title size-${titleSize}`} lang="de">{info.title}</h1>
        <p className="invitation-ended-status" role="status">Diese Quizrunde ist beendet.</p>
        <p>Beendet am {formatDateTimeWithZone(info.endedAt ?? info.expiresAt, info.timeZone, "long")}.
          Mitspielen ist nicht mehr möglich.</p>
      </div>
    </article>;
  } else if (codeMismatch || qrState === "failed") {
    body = <div className="invitation-status" role="alert">
      <h1>QR-Code konnte nicht erzeugt werden</h1>
      <p>{codeMismatch ? "Der Quiz-Code dieser Runde ist noch nicht bestätigt." : "Beim Erzeugen des QR-Codes ist ein Fehler aufgetreten."}
        {" "}Es wird keine unvollständige Einladung angezeigt.</p>
      <button type="button" className="button primary" onClick={retryQr}><RotateCw size={17} aria-hidden="true" />Erneut versuchen</button>
    </div>;
  } else {
    body = <article className={`invitation-card${qrState === "ready" ? " is-ready" : ""}`} aria-label={`Einladung: ${info.title}`}
      data-ready={qrState === "ready" ? "true" : "false"} aria-busy={qrState !== "ready"}>
      <header className="invitation-brand"><img src="/brand/ratelama-logo.png" alt="RateLama" /></header>
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
          <QrBoundary key={qrAttempt} onError={qrFailed}>
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

  return <div className={`invitation-page${fullscreen ? " is-fullscreen" : ""}`}>
    <div className="invitation-toolbar" role="toolbar" aria-label="Einladung">
      <button type="button" className="button secondary small" onClick={() => void enterFullscreen()}>
        <Maximize2 size={16} aria-hidden="true" />Vollbild</button>
      <button type="button" className="button secondary small" onClick={close}><X size={16} aria-hidden="true" />Schließen</button>
      {fullscreenHint ? <span className="invitation-toolbar-hint" role="status">{fullscreenHint}</span>
        : <span className="invitation-toolbar-hint">Vollbild mit Esc verlassen · Screenshot mit den Mitteln deines Systems</span>}
    </div>
    <div className="invitation-stage" ref={stage}>{body}</div>
  </div>;
}
