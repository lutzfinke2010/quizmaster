import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    return error.errors.map((item: unknown) =>
      item && typeof item === "object" && "message" in item && typeof item.message === "string"
        ? item.message : "Unbekannter Fehler").join("; ");
  }
  return "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.";
}

export function Layout({ children }: { children: React.ReactNode }) {
  return <div className="app"><header className="header"><Link to="/" className="brand">
    <Sparkles size={24} aria-hidden="true" /> QuizRush</Link><Link className="header-link" to="/admin">Quizmaster</Link></header>
    <main className="container">{children}</main><footer>QuizRush · Gemeinsam spielen, gemeinsam staunen</footer></div>;
}

export function ErrorBanner({ error }: { error: string }) {
  return error ? <p role="alert" className="error-banner">{error}</p> : null;
}
