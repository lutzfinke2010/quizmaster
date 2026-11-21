import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Layers, Ticket } from "lucide-react";
import { useAppMode } from "./appMode";
import { Brand, SkipLink } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import "../neu.css";
import "./shell.css";

/** Readable single column for text pages (legal pages, not found, unavailable). */
export function PageLayout({ children }: { children: ReactNode }) {
  const { cloud } = useAppMode();
  return <div className="rl rl-page-layout">
    <SkipLink />
    <header className="rl-page-header">
      <Brand />
      <nav aria-label="Hauptnavigation" className="rl-page-nav">
        {cloud && <NavLink className="rl-page-nav-link" to="/join"><Ticket aria-hidden="true" />Mitspielen</NavLink>}
        <NavLink className="rl-page-nav-link" to="/admin"><Layers aria-hidden="true" />{cloud ? "Quizmaster" : "Quiz-Entwürfe"}</NavLink>
      </nav>
    </header>
    <main className="rl-page-main" id="main-content" tabIndex={-1}>{children}</main>
    <SiteFooter />
  </div>;
}
