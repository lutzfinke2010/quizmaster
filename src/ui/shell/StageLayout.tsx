import type { ReactNode } from "react";
import { Brand, SkipLink } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import "../neu.css";
import "./shell.css";

/** Full-width stage for the shared screen (presentation, invitation): large type, no admin actions. */
export function StageLayout({ children, aside, footer = true, className = "" }: {
  children: ReactNode; aside?: ReactNode; footer?: boolean; className?: string;
}) {
  return <div className={`rl rl-stage-layout ${className}`.trim()}>
    <SkipLink />
    <header className="rl-stage-header"><Brand />{aside && <div className="rl-header-aside">{aside}</div>}</header>
    <main className="rl-stage-main" id="main-content" tabIndex={-1}>{children}</main>
    {footer && <SiteFooter compact />}
  </div>;
}
