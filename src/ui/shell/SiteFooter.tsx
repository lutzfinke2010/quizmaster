import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { PrivacyFacts } from "../home/Privacy";
import { useAppMode } from "./appMode";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const { cloud } = useAppMode();
  return <footer className={`rl-footer${compact ? " is-compact" : ""}`}>
    {!compact && <details className="rl-footer-privacy">
      <summary><ShieldCheck aria-hidden="true" />
        {cloud ? "Datenschutz: Mitspielen ohne Name und E-Mail" : "Datenschutz: Entwürfe bleiben im Browser"}</summary>
      <PrivacyFacts localMode={!cloud} />
    </details>}
    <div className="rl-footer-row">
      <span className="rl-footer-tagline">Gemeinsam spielen, gemeinsam staunen.</span>
      <div className="rl-footer-legal" role="group" aria-label="Rechtliches">
        <Link to="/impressum">Impressum</Link>
        <Link to="/datenschutz">Datenschutzerklärung</Link>
      </div>
    </div>
  </footer>;
}
