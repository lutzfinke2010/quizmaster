import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { ArrowRight, Layers, PartyPopper, PencilLine, Users } from "lucide-react";
import { Notice } from "../common/Notices";
import { Confetti, Sparkle } from "../Illustrations";
import { RateLamaMascot } from "../RateLamaMascot";
import { routes } from "../routes";
import { ScreenLayout } from "../shell/ScreenLayout";
import { useAppMode } from "../shell/appMode";
import { usePageTitle } from "../usePageTitle";
import { HomeTrail } from "./HomeTrail";
import { JoinForm } from "./JoinForm";
import { PrivacyNote, PrivacySection, TrustChips } from "./Privacy";
import "./home.css";

const STEPS = [
  { icon: PencilLine, tone: "rl-home-step-peach", label: "01 / VORBEREITEN", title: "Deine Fragen. Dein Quiz.",
    text: "Eigene Ideen sammeln oder mit einem Beispielquiz loslegen." },
  { icon: Users, tone: "rl-home-step-purple", label: "02 / ZUSAMMENKOMMEN", title: "Code teilen. Alle dabei.",
    text: "Per Quiz-Code oder QR-Code findet dein Team in die Runde." },
  { icon: PartyPopper, tone: "rl-home-step-lime", label: "03 / LOSRÄTSELN", title: "Mitfiebern. Weiterwissen.",
    text: "Antwort antippen, Auflösung entdecken und gemeinsam feiern." },
];

function HeaderNav() {
  const { cloud } = useAppMode();
  return <nav aria-label="Hauptnavigation" className="rl-home-nav">
    <NavLink className="rl-page-nav-link" to={routes.admin}><Layers aria-hidden="true" />{cloud ? "Quizmaster" : "Quiz-Entwürfe"}</NavLink>
  </nav>;
}

function HowItWorks() {
  return <section className="rl-home-how" aria-labelledby="rl-how-heading">
    <span className="rl-eyebrow">SO FUNKTIONIERT’S</span>
    <h2 id="rl-how-heading" className="rl-h2">In drei Schritten mittendrin.</h2>
    <ol className="rl-home-steps">
      {STEPS.map(({ icon: Icon, tone, label, title, text }) => <li key={label}>
        <span className={`rl-home-step-icon ${tone}`}><Icon aria-hidden="true" /></span>
        <div><span className="rl-home-step-label">{label}</span><h3 className="rl-h3">{title}</h3><p>{text}</p></div>
      </li>)}
    </ol>
  </section>;
}

function StartCard({ children, title }: { children: ReactNode; title: string }) {
  return <section className="rl-start-card rl-home-start" aria-labelledby="rl-start-title">
    <Confetti className="rl-confetti rl-confetti-left" />
    <Confetti className="rl-confetti rl-confetti-right" />
    <h2 id="rl-start-title" className="rl-start-title">{title}</h2>
    {children}
  </section>;
}

function Home() {
  const { cloud } = useAppMode();
  usePageTitle(cloud ? "Mitspielen und Quiz erstellen" : "Quiz-Entwürfe vorbereiten");
  return <ScreenLayout aside={<HeaderNav />} className="rl-home">
    <section className="rl-home-hero" aria-labelledby="rl-home-heading">
      <span className="rl-eyebrow">WILLKOMMEN BEI RATELAMA</span>
      <h1 id="rl-home-heading" className="rl-title">
        <span>Kleine Fragen. <span className="rl-home-highlight">Große Momente.</span></span>
        <Sparkle className="rl-title-sparkle" />
      </h1>
      <p className="rl-lead">{cloud
        ? "Das Teamquiz mit Lama: Spielt live zusammen oder rätselt im eigenen Tempo. Ein Quiz-Code reicht zum Mitmachen."
        : "Pack deine besten Fragen ein. Hier bereitest du auf deinem Gerät die nächste Quizrunde für dein Team vor."}</p>
    </section>
    <HomeTrail />
    {cloud
      ? <StartCard title="Bereit für die nächste Frage?"><JoinForm /></StartCard>
      : <StartCard title="Bereit für dein nächstes Quiz?">
        <Notice tone="info" live={false}>
          <strong>Lokaler Entwurfsmodus:</strong> Live-Spiele und Anmeldung sind hier nicht verfügbar. Quiz-Entwürfe kannst
          du trotzdem vorbereiten – sie bleiben in diesem Browser.
        </Notice>
        <Link className="rl-start-button" to={routes.admin}>Quiz vorbereiten <ArrowRight strokeWidth={3} aria-hidden="true" /></Link>
      </StartCard>}
    <TrustChips localMode={!cloud} />
    <HowItWorks />
    {cloud && <section className="rl-card rl-home-host" aria-labelledby="rl-host-heading">
      <div className="rl-home-host-row">
        <RateLamaMascot state="correct" size={104} decorative className="rl-home-host-llama" />
        <div>
          <h2 id="rl-host-heading" className="rl-h3">Du bist Quizmaster?</h2>
          <p>Fragen sammeln, eine Live-Runde starten oder ein Quiz zum Mitmachen verschicken.</p>
        </div>
      </div>
      <Link className="rl-btn rl-btn-secondary rl-btn-block" to={routes.admin}>Quiz vorbereiten <ArrowRight aria-hidden="true" /></Link>
    </section>}
    <PrivacySection localMode={!cloud} />
  </ScreenLayout>;
}

function Join() {
  const { joinCode = "" } = useParams();
  usePageTitle("Mitspielen");
  return <ScreenLayout aside={<HeaderNav />} className="rl-home rl-join-page">
    <section className="rl-start-card rl-join-card" aria-labelledby="rl-join-heading">
      <RateLamaMascot state="intro" size={132} decorative className="rl-join-llama" />
      <span className="rl-eyebrow">DEIN PLATZ IST NOCH FREI</span>
      <h1 id="rl-join-heading" className="rl-h1">Mitspielen</h1>
      <p className="rl-lead">Gib den sechsstelligen Quiz-Code ein – für Live-Quiz und Quiz zum Mitmachen. Ein Konto ist nicht nötig.</p>
      <JoinForm key={joinCode} initialCode={joinCode} />
      <PrivacyNote />
    </section>
  </ScreenLayout>;
}

/** `/` is the start page, `/join[/:joinCode]` the focused code entry (cloud only, see App). */
export function HomePage() {
  const { pathname } = useLocation();
  return pathname.startsWith("/join") ? <Join /> : <Home />;
}
