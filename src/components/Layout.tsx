import { Link, NavLink } from "react-router-dom";
import { AlertCircle, Compass, Layers, ShieldCheck, Ticket } from "lucide-react";
import { PrivacyFacts } from "./Privacy";

export function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    return error.errors.map((item: unknown) =>
      item && typeof item === "object" && "message" in item && typeof item.message === "string"
        ? item.message : "Unbekannter Fehler").join("; ");
  }
  return "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.";
}

export function Layout({ children, localMode = false, gameMode }: {
  children: React.ReactNode; localMode?: boolean; gameMode?: "player" | "presentation" | "admin";
}) {
  return <div className={`app${gameMode ? ` game-layout game-layout-${gameMode}` : ""}`}>
    <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
    <header className="header">
      <Link to="/" className="brand" aria-label="RateLama – Startseite">
        <img className="brand-logo" src="/brand/ratelama-logo.png" width="1080" height="268" alt="" />
        <span className="brand-copy">
          <img className="brand-mark" src="/brand/ratelama-icon.png" width="512" height="512" alt="" />
          <span className="brand-name">RateLama</span>
        </span>
      </Link>
      {gameMode && gameMode !== "admin" ? <span className="live-label">Gemeinsam spielen</span> : <nav className="header-nav" aria-label="Hauptnavigation">
        <NavLink className="nav-link" to="/join"><Ticket size={17} aria-hidden="true" />Mitspielen</NavLink>
        <NavLink className="nav-link" to="/admin"><Layers size={17} aria-hidden="true" />{localMode ? "Quiz-Entwürfe" : "Quizmaster"}</NavLink>
      </nav>}
    </header>
    <main id="main-content" tabIndex={-1} className="container">{children}</main>
    <footer>
      <Link to="/" className="footer-brand">RateLama<span aria-hidden="true"> ✳</span></Link>
      <details className="footer-privacy privacy-disclosure">
        <summary><ShieldCheck size={18} aria-hidden="true" />
          {localMode ? "Datenschutz: Entwürfe bleiben im Browser" : "Datenschutz: Mitspielen ohne Name und E-Mail"}</summary>
        <PrivacyFacts localMode={localMode} />
      </details>
      <span className="footer-tagline">Gemeinsam spielen, gemeinsam staunen.</span>
      <div className="footer-legal" role="group" aria-label="Rechtliches">
        <Link to="/impressum">Impressum</Link>
        <Link to="/datenschutz">Datenschutzerklärung</Link>
      </div>
    </footer>
  </div>;
}

export function ErrorBanner({ error }: { error: string }) {
  return error ? <p role="alert" className="error-banner"><AlertCircle size={18} aria-hidden="true" /> {error}</p> : null;
}

export function LoadingNotice({ children }: { children: React.ReactNode }) {
  return <p role="status" className="loading-notice"><Compass size={22} aria-hidden="true" />{children}</p>;
}
