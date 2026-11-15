import { ArrowRight, Check, CheckCircle2, PartyPopper, PencilLine, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { PrivacySection, TrustChips } from "./Privacy";

export function HomeContent({ localMode = false }: { localMode?: boolean }) {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow"><span className="eyebrow-dot" /> WENIGER ALLTAG. MEHR AHA.</span>
        <h1>Kleine Fragen.<br /><span className="hero-highlight">Große Momente.</span></h1>
        <p>Ein bisschen Wissen. Ein bisschen Bauchgefühl. Und ganz viel Spaß zusammen. Mach aus deiner nächsten Runde eine Quizshow.</p>
        <div className="actions">
          <Link className="button primary" to={localMode ? "/admin" : "/join"}>
            {localMode ? "Quiz vorbereiten" : "Spiel beitreten"} <ArrowRight size={19} aria-hidden="true" />
          </Link>
          <Link className="button secondary" to={localMode ? "/join" : "/admin"}>
            {localMode ? "Spiel beitreten" : "Quiz vorbereiten"}
          </Link>
        </div>
        <TrustChips localMode={localMode} />
      </div>
      <div className="hero-visual">
        <span className="floating-sticker"><Sparkles size={19} aria-hidden="true" /> Bereit für dein Aha?</span>
        <section className="sample-quiz" aria-label="Beispiel einer Quizrunde">
          <div className="sample-topline"><span className="badge">SO SIEHT’S AUS · BEISPIEL</span><span aria-hidden="true">✳</span></div>
          <h2>Welcher Planet ist für seine Ringe bekannt?</h2>
          <div className="sample-answers">
            <div><b>A</b> Mars</div>
            <div className="sample-selected"><b>B</b> Saturn <Check size={20} aria-hidden="true" /></div>
            <div><b>C</b> Venus</div>
            <div><b>D</b> Merkur</div>
          </div>
          <p className="sample-confirmation"><CheckCircle2 size={19} aria-hidden="true" /> Deine Auswahl: B · Saturn</p>
        </section>
        <span className="visual-caption">Zusammen rätseln ist einfach besser.</span>
      </div>
    </section>
    <section className="how-it-works" aria-labelledby="how-heading">
      <div className="how-heading"><span className="eyebrow">KEIN GROSSES DING</span><h2 id="how-heading">In drei Schritten mittendrin.</h2></div>
      <ol className="steps">
        <li><span className="step-icon step-peach"><PencilLine aria-hidden="true" /></span>
          <div><span className="step-number">01 / VORBEREITEN</span><h3>Deine Fragen. Dein Quiz.</h3><p>Eigene Ideen sammeln oder mit einem Beispielquiz loslegen.</p></div></li>
        <li><span className="step-icon step-purple"><Users aria-hidden="true" /></span>
          <div><span className="step-number">02 / ZUSAMMENKOMMEN</span><h3>Code teilen. Alle dabei.</h3><p>Im Live-Spiel geht’s per Spielcode oder QR-Code direkt in die Runde.</p></div></li>
        <li><span className="step-icon step-lime"><PartyPopper aria-hidden="true" /></span>
          <div><span className="step-number">03 / LOSRÄTSELN</span><h3>Mitfiebern. Weiterwissen.</h3><p>Antwort auswählen, Auflösung entdecken und gemeinsam feiern.</p></div></li>
      </ol>
    </section>
    <PrivacySection localMode={localMode} />
  </>;
}
