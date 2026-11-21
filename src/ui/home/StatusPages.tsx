import { Link } from "react-router-dom";
import { LlamaCharacter } from "../LlamaCharacter";
import { usePageTitle } from "../usePageTitle";
import { PageLayout } from "../shell/PageLayout";
import "./home.css";

function StatusCard({ title, text, mood }: { title: string; text?: string; mood: "curious" | "surprised" }) {
  return <section className="rl-status rl-card" aria-labelledby="status-heading">
    <LlamaCharacter mood={mood} className="rl-status-llama" />
    <h1 id="status-heading" className="rl-h1">{title}</h1>
    {text && <p className="rl-lead">{text}</p>}
    <div className="rl-actions"><Link className="rl-btn rl-btn-secondary" to="/">Zur Startseite</Link></div>
  </section>;
}

export function NotFoundPage() {
  usePageTitle("Seite nicht gefunden");
  return <PageLayout><StatusCard mood="surprised" title="Seite nicht gefunden"
    text="Hier hat sich das Lama verlaufen. Prüfe den Link oder starte neu." /></PageLayout>;
}

/** Shown in the local draft mode for routes that need the backend (live game, Quiz zum Mitmachen, KI-Generator). */
export function UnavailablePage({ kind = "live" }: { kind?: "live" | "async" | "generator" }) {
  const content = {
    live: { title: "Live-Spiel noch nicht verfügbar",
      text: "Der sichere Beitritt und das Live-Backend sind noch in Arbeit. Es werden keine Spielcodes angenommen." },
    async: { title: "Quiz zum Mitmachen nicht verfügbar",
      text: "Im lokalen Entwurfsmodus gibt es keine Veröffentlichung. Quiz-Links und Einladungen funktionieren nur mit dem RateLama-Backend." },
    generator: { title: "KI-Generator nicht verfügbar",
      text: "Der KI-Generator braucht das RateLama-Backend. Im lokalen Entwurfsmodus kannst du Quizze von Hand erstellen." },
  }[kind];
  usePageTitle(content.title);
  return <PageLayout><StatusCard mood="curious" title={content.title} text={content.text} /></PageLayout>;
}
