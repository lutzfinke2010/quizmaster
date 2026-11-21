import { Link } from "react-router-dom";
import { RateLamaHead } from "../RateLamaMascot";

export function Brand({ to = "/", label = "RateLama – Startseite" }: { to?: string; label?: string }) {
  return <Link className="rl-brand" to={to} aria-label={label}>
    <RateLamaHead className="rl-brand-mark" />
    <span className="rl-brand-name">RateLama</span>
  </Link>;
}

export function SkipLink() {
  return <a className="rl-skip-link" href="#main-content">Zum Inhalt springen</a>;
}
