import { Link } from "react-router-dom";
import { Check, Database, HardDrive, Hourglass, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import { legal } from "../config/legal";

type Fact = { label: string; text: string };

const cloudFacts: Fact[] = [
  { label: "Ohne Klarnamen", text: "Zum Mitspielen brauchst du kein Konto, keinen Namen und keine E-Mail-Adresse. Spielname und Avatar werden automatisch vergeben." },
  { label: "Für die Runde gespeichert", text: "Eine technische Teilnahme-Kennung, Spielname, Avatar, Antworten, Antwortzeiten und Punkte werden gespeichert." },
  { label: "Aufbewahrung", text: `Sitzungsdaten werden spätestens ${legal.sessionRetentionDays} Tage nach Erstellung der Sitzung gelöscht. Die technische Löschung kann zeitversetzt erfolgen.` },
  { label: "Sichtbar für die Runde", text: "Spielname, Avatar, Punkte und Platzierung sind für die anderen Teilnehmenden, den Quizmaster und die Präsentationsansicht sichtbar." },
  { label: "Selbst löschen", text: "Im Spiel kannst du deine Teilnahme selbst löschen, sobald keine Frage läuft. Antworten und Ergebnisse werden dabei entfernt." },
  { label: "Technik", text: "Ratelama nutzt AWS für den Live-Betrieb. Eine anonyme technische Kennung wird höchstens 24 Stunden im Browser gespeichert, damit deine Teilnahme wiedergefunden wird." },
  { label: "Quizmaster-Konten", text: "Für ein Konto wird eine E-Mail-Adresse gespeichert. Quizvorlagen bleiben bis zur Löschung gespeichert." },
  { label: "Keine Tracker", text: "Ratelama lädt keine externen Tracker, Schriftarten oder Avatarbilder." },
];

const localFacts: Fact[] = [
  { label: "Ohne Konto", text: "Für Quiz-Entwürfe brauchst du weder Konto noch E-Mail-Adresse oder Passwort." },
  { label: "Nur im Browser", text: "Entwürfe liegen ausschließlich im lokalen Speicher dieses Browsers." },
  { label: "Löschen", text: "Entwürfe lassen sich in der Übersicht löschen oder über die Website-Daten deines Browsers entfernen." },
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
    { icon: HardDrive, title: "Bleibt bei dir", text: "Deine Entwürfe liegen nur im lokalen Speicher dieses Browsers." },
    { icon: Trash2, title: "Liegt in deiner Hand", text: "Entwürfe in der Übersicht löschen oder die Website-Daten im Browser entfernen." },
  ] : [
    { icon: UserRoundX, title: "Brauchst du nicht", text: "Konto, Klarnamen, E-Mail-Adresse oder Passwort. Spielname und Avatar würfeln wir dir zu." },
    { icon: Database, title: "Speichern wir für die Runde", text: "Technische Kennung, Spielname, Avatar, deine Antworten, Antwortzeiten und Punkte." },
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
