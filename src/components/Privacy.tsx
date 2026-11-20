import { Link } from "react-router-dom";
import { Check, Database, HardDrive, Hourglass, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import { legal } from "../config/legal";

type Fact = { label: string; text: string };

const cloudFacts: Fact[] = [
  { label: "Ohne Klarnamen", text: "Zum Mitspielen brauchst du kein Konto, keinen Namen und keine E-Mail-Adresse. Spielname und Avatar werden automatisch vergeben." },
  { label: "Für die Runde gespeichert", text: "Eine technische Teilnahme-Kennung, Spielname und Avatar werden vergeben. Quizantworten und Ergebnisse sind nur für den Quizmaster und den jeweiligen Gast sichtbar." },
  { label: "Live-Aufbewahrung", text: `Live-Sitzungsdaten werden spätestens ${legal.sessionRetentionDays} Tage nach Erstellung der Sitzung gelöscht. Die technische Löschung kann zeitversetzt erfolgen.` },
  { label: "Quiz zum Mitmachen", text: `Ergebnisse bleiben bis ${legal.asyncResultsRetentionDays} Tage nach Rundenende gespeichert. Je nach Rundenregel sehen Gäste ihre eigenen Lösungen, Punkte, Serien und Abzeichen sofort nach einer Antwort oder erst nach Rundenende. Unbeantwortete Fragen werden während der Runde nicht aufgelöst.` },
  { label: "Sichtbar im Live-Quiz", text: "Spielname, Avatar, Punkte und Platzierung sind für andere Teilnehmende, Quizmaster und Präsentationsansicht sichtbar." },
  { label: "Selbst löschen", text: "Im Spiel kannst du deine Teilnahme selbst löschen, sobald keine Frage läuft. Antworten und Ergebnisse werden dabei entfernt." },
  { label: "Technik", text: "Für Cloud-Funktionen wird eine technische Gast-Kennung benötigt. Sie verfällt standardmäßig nach 24 Stunden; bei einem gestarteten Quiz zum Mitmachen bleibt sie bis zum Ende der Ergebnis-Aufbewahrung erhalten, damit du fortsetzen kannst." },
  { label: "Quizmaster-Konten", text: "Anmeldetokens speichert Amplify erst während einer gestarteten Anmeldung. Refresh-Tokens können die Sitzung bis zum Ablauf ihrer Cognito-Gültigkeit erneuern; Abmelden beendet sie über Cognito." },
  { label: "Browser-Speicher", text: "Die App setzt keine Cookies über ihren Frontend-Code. Sie nutzt localStorage für ausdrücklich angeforderte Funktionen; die konkrete Speichernutzung steht in der Datenschutzerklärung." },
  { label: "Keine Tracker", text: "RateLama lädt keine Analyse- oder Werbe-Tracker, externen Schriftarten oder Avatarbilder. Cloud-Anfragen gehen nur an AWS-Dienste, wenn die zugehörige Funktion genutzt wird." },
];

const localFacts: Fact[] = [
  { label: "Ohne Konto", text: "Für Quiz-Entwürfe brauchst du weder Konto noch E-Mail-Adresse oder Passwort." },
  { label: "Erst nach Aktivierung", text: "Die App liest oder speichert Quiz-Entwürfe erst, wenn du die Speicherfunktion einschaltest. Ein neuer Entwurf wird erst durch ausdrückliches Speichern dauerhaft abgelegt." },
  { label: "Dauer", text: "Gespeicherte Entwürfe bleiben im localStorage dieses Browsers, bis du sie in der Übersicht löschst oder die Website-Daten entfernst. Ausschalten löscht sie nicht." },
  { label: "Vorhandene Entwürfe", text: "Vorhandene Entwürfe bleiben unverändert, bis du die Speicherfunktion aktivierst. Das Aktivieren zeigt sie an und löscht oder migriert sie nicht." },
  { label: "Löschen", text: "In der Übersicht kannst du alle lokalen Entwürfe gezielt löschen. Die App entfernt dabei nur ihren eigenen Entwurfsschlüssel." },
  { label: "Kein geschützter Bereich", text: "Andere Personen mit Zugriff auf dieses Browserprofil können die Entwürfe öffnen." },
  { label: "Ohne Live-Spiel", text: "Live-Spiele und Anmeldung sind in diesem Modus nicht verfügbar." },
];

export function PrivacyFacts({ localMode = false, skip = 0 }: { localMode?: boolean; skip?: number }) {
  return <ul className="privacy-list">
    {(localMode ? localFacts : cloudFacts).slice(skip).map((fact) =>
      <li key={fact.label}><strong>{fact.label}:</strong> {fact.text}</li>)}
  </ul>;
}

export function TrustChips({ localMode = false }: { localMode?: boolean }) {
  const chips = localMode ? ["Ohne Konto", "Ohne E-Mail", "Entwürfe nur im Browser"] : ["Ohne Konto", "Ohne Klarnamen", "Ohne E-Mail"];
  function reveal(event: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById("datenschutz");
    if (!target) return;
    event.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    target.focus({ preventScroll: true });
  }
  return <div className="trust">
    <ul className="trust-chips" aria-label={localMode ? "Quiz-Entwürfe auf einen Blick" : "Mitspielen auf einen Blick"}>
      {chips.map((chip) => <li key={chip}><Check size={15} strokeWidth={3} aria-hidden="true" />{chip}</li>)}
    </ul>
    <a className="trust-link" href="#datenschutz" onClick={reveal}>
      <ShieldCheck size={17} aria-hidden="true" />{localMode ? "Wo liegen meine Entwürfe?" : "Was wird gespeichert?"}</a>
  </div>;
}

export function PrivacySection({ localMode = false }: { localMode?: boolean }) {
  const cards = localMode ? [
    { icon: UserRoundX, title: "Brauchst du nicht", text: "Konto, E-Mail-Adresse oder Passwort." },
    { icon: HardDrive, title: "Nur nach Aktivierung", text: "Vorher wird kein Entwurf dauerhaft gespeichert oder automatisch wieder aufgenommen." },
    { icon: Trash2, title: "Liegt in deiner Hand", text: "Entwürfe einzeln oder alle in der Übersicht löschen; Ausschalten löscht nichts." },
  ] : [
    { icon: UserRoundX, title: "Brauchst du nicht", text: "Konto, Klarnamen, E-Mail-Adresse oder Passwort. Spielname und Avatar würfeln wir dir zu." },
    { icon: Database, title: "Speichern wir für die Runde", text: "Technische Kennung, Spielname, Avatar, deine Antworten, Antwortzeiten und Punkte sowie Serien. Daraus entstehen deine Abzeichen." },
    { icon: Hourglass, title: "Bleibt nicht für immer", text: `Spieldaten werden spätestens ${legal.sessionRetentionDays} Tage nach Erstellung der Sitzung gelöscht – technisch manchmal etwas zeitversetzt.` },
  ];
  return <section id="datenschutz" className="privacy-section" aria-labelledby="privacy-heading" tabIndex={-1}>
    <div className="privacy-intro">
      <span className="privacy-seal"><ShieldCheck size={30} aria-hidden="true" /></span>
      <div>
        <span className="eyebrow">DATENSCHUTZ OHNE KLEINGEDRUCKTES</span>
        <h2 id="privacy-heading">{localMode ? "Deine Entwürfe bleiben bei dir." : "Mitspielen ohne Name und E-Mail."}</h2>
        <p>{localMode ? "Im lokalen Entwurfsmodus verlässt kein Quiz deinen Browser." :
          "Wir fragen nur, was eine Runde wirklich braucht – und sagen offen, was dafür gespeichert wird."}</p>
      </div>
    </div>
    <ul className="privacy-cards">
      {cards.map(({ icon: Icon, title, text }) => <li key={title}>
        <span className="privacy-card-icon"><Icon size={22} aria-hidden="true" /></span>
        <h3>{title}</h3><p>{text}</p>
      </li>)}
    </ul>
    <details className="privacy-more">
      <summary>{localMode ? "Was du außerdem wissen solltest" : "Alle Details zur Speicherung"}</summary>
      <PrivacyFacts localMode={localMode} skip={3} />
    </details>
  </section>;
}

export function PrivacyNote() {
  return <div className="privacy-note">
    <ShieldCheck size={22} aria-hidden="true" />
    <div>
      <p><strong>Ohne Name und E-Mail dabei.</strong> Spielname und Avatar werden automatisch vergeben. Beides sowie deine Punkte
        und Platzierung sind für die Spielrunde sichtbar. <Link to="/datenschutz">Datenschutzerklärung</Link></p>
      <details className="privacy-disclosure">
        <summary>Was wird gespeichert?</summary>
        <PrivacyFacts skip={1} />
      </details>
    </div>
  </div>;
}
