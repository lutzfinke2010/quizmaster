import { ArrowRight, Check, CheckCircle2, Compass, PartyPopper, PencilLine, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { GameIcon, GameIllustration } from "./GameAssets";
import { PrivacySection, TrustChips } from "./Privacy";

export function HomeContent({ localMode = false }: { localMode?: boolean }) {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow expedition-label"><Compass size={16} aria-hidden="true" /> Willkommen bei RateLama</span>
        <h1>Kleine Fragen.<br /><span className="hero-highlight">Große Momente.</span></h1>
        <p>{localMode ? "Pack deine besten Fragen ein. Hier bereitest du auf deinem Gerät die nächste Quizrunde für dein Team vor." :
          "Das Teamquiz mit Lama: Spielt live zusammen oder rätselt im eigenen Tempo. Ein Quiz-Code reicht zum Mitmachen."}</p>
        <div className="actions">
          <Link className="button primary" to={localMode ? "/admin" : "/join"}>
            {localMode ? "Quiz vorbereiten" : "Mitspielen"} <ArrowRight size={19} aria-hidden="true" />
          </Link>
          <Link className="button secondary" to={localMode ? "/join" : "/admin"}>
            {localMode ? "Mitspielen" : "Quiz vorbereiten"}
          </Link>
        </div>
      </div>
      <div className="lama-scene" aria-hidden="true">
        <GameIllustration name="lobby-welcome" className="scene-guide" />
        <span className="scene-sticker scene-star"><GameIcon name="points" size={40} /></span>
        <span className="scene-sticker scene-trophy"><GameIcon name="trophy" size={48} /></span>
      </div>
    </section>
    <TrustChips localMode={localMode} />
    <section className="how-it-works" aria-labelledby="how-heading">
      <div className="how-heading"><span className="eyebrow">SO FUNKTIONIERT’S</span><h2 id="how-heading">In drei Schritten mittendrin.</h2></div>
      <ol className="steps">
        <li><span className="step-icon step-peach"><PencilLine aria-hidden="true" /></span>
          <div><span className="step-number">01 / VORBEREITEN</span><h3>Deine Fragen. Dein Quiz.</h3><p>Eigene Ideen sammeln oder mit einem Beispielquiz loslegen.</p></div></li>
        <li><span className="step-icon step-purple"><Users aria-hidden="true" /></span>
          <div><span className="step-number">02 / ZUSAMMENKOMMEN</span><h3>Code teilen. Alle dabei.</h3><p>Per Quiz-Code oder QR-Code findet dein Team in die Runde.</p></div></li>
        <li><span className="step-icon step-lime"><PartyPopper aria-hidden="true" /></span>
          <div><span className="step-number">03 / LOSRÄTSELN</span><h3>Mitfiebern. Weiterwissen.</h3><p>Antwort auswählen, Auflösung entdecken und gemeinsam feiern.</p></div></li>
      </ol>
      <details className="quiz-preview">
        <summary>Eine Beispielfrage ansehen</summary>
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
      </details>
    </section>
    <PrivacySection localMode={localMode} />
  </>;
}
