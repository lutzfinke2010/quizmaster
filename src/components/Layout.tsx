import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
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
      <Link to="/" className="brand" aria-label="Ratelama – Startseite">
        <span className="brand-icon"><Sparkles size={23} aria-hidden="true" /></span>
        <span>Ratelama<span className="brand-caption">Einfach. Zusammen. Spielen.</span></span>
      </Link>
      {gameMode && gameMode !== "admin" ? <span className="live-label">Gemeinsam spielen</span> : <nav className="header-nav" aria-label="Hauptnavigation">
        <NavLink className="nav-link" to="/join">Mitspielen</NavLink>
        <NavLink className="nav-link" to="/admin">{localMode ? "Quiz-Entwürfe" : "Quizmaster"}
          <ArrowUpRight size={16} aria-hidden="true" /></NavLink>
      </nav>}
    </header>
    <main id="main-content" tabIndex={-1} className="container">{children}</main>
    <footer>
      <Link to="/" className="footer-brand">Ratelama<span aria-hidden="true"> ✳</span></Link>
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
  return error ? <p role="alert" className="error-banner">{error}</p> : null;
}
