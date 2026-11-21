import { Link } from "react-router-dom";
import { ChevronLeft, HardDrive } from "lucide-react";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import "../neu.css";
import "./admin.css";

export function LocalNotice() {
  return <p className="rl-notice rl-notice-info rl-adm-local-notice"><HardDrive aria-hidden="true" strokeWidth={2.4} />
    <span><strong>Lokaler Entwurfsmodus:</strong> Entwürfe werden erst nach deiner Aktivierung auf diesem Gerät gespeichert.
      Live-Spiele und Anmeldung sind hier nicht verfügbar.</span></p>;
}

/** Shown for links to an existing draft while local storage is still switched off. */
export function ExistingDraftGate({ onEnable }: { onEnable: () => void }) {
  return <>
    <LocalNotice />
    <section className="rl-card rl-adm-storage" aria-labelledby="existing-draft-heading">
      <h1 id="existing-draft-heading" className="rl-h2">Vorhandenen Entwurf ansehen?</h1>
      <p>Dieser Link kann einen bereits gespeicherten Entwurf öffnen. Er wird erst gelesen, wenn du die Speicherfunktion aktivierst.
        Deine vorhandenen Daten bleiben bis dahin unverändert.</p>
      <div className="rl-actions">
        <button type="button" className="rl-btn rl-btn-primary" onClick={onEnable}>Entwurf auf diesem Gerät ansehen</button>
      </div>
    </section>
  </>;
}

/** Full page variant of the gate (detail page and editor). */
export function ExistingDraftPage({ onEnable }: { onEnable: () => void }) {
  usePageTitle("Vorhandenen Entwurf ansehen?");
  return <div className="rl-adm-page rl-adm-narrow">
    <Link className="rl-adm-back" to={routes.admin}><ChevronLeft aria-hidden="true" strokeWidth={3} /> Zur Übersicht</Link>
    <ExistingDraftGate onEnable={onEnable} />
  </div>;
}
