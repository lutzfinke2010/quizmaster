import { Link } from "react-router-dom";
import { LlamaHead } from "../Illustrations";

export function Brand({ to = "/", label = "RateLama – Startseite" }: { to?: string; label?: string }) {
  return <Link className="rl-brand" to={to} aria-label={label}>
    <LlamaHead className="rl-brand-mark" />
    <span className="rl-brand-name">RateLama</span>
  </Link>;
}

export function SkipLink() {
  return <a className="rl-skip-link" href="#main-content">Zum Inhalt springen</a>;
}
