import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { MountainStrip } from "../CreateIllustrations";
import { Sparkle } from "../Illustrations";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import "../neu.css";
import "../quizzes.css";
import "./admin.css";

/** Cream editor card with mountain hero, back link and headline (also used for loading and gate states). */
export function EditorFrame({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  usePageTitle(title);
  return <div className="rl-adm-editor">
    <div className="rl-editor-hero">
      <MountainStrip className="rl-hero-mountains" />
      <Link className="rl-back-link" to={routes.admin} aria-label="Zur Übersicht">
        <ChevronLeft strokeWidth={3} aria-hidden="true" />
      </Link>
      <span className="rl-eyebrow">QUIZWERKSTATT</span>
      <h1 className="rl-title rl-hero-title">{title} <Sparkle className="rl-title-sparkle" /></h1>
    </div>
    {lead && <p className="rl-editor-lead">{lead}</p>}
    {children}
  </div>;
}
