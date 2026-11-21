import type { ReactNode } from "react";
import { Brand, SkipLink } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import "../neu.css";
import "./shell.css";

/**
 * The playful phone card from the mockups (max. 440px). `size="play"` widens it to 960px on desktop for questions.
 * `aside` is rendered on the right of the header (score, phase, …).
 */
export function ScreenLayout({ children, aside, size = "phone", className = "" }: {
  children: ReactNode; aside?: ReactNode; size?: "phone" | "play"; className?: string;
}) {
  return <div className="rl rl-screen-layout">
    <SkipLink />
    <div className={`rl-screen rl-screen-${size} ${className}`.trim()}>
      <header className="rl-header"><Brand />{aside && <div className="rl-header-aside">{aside}</div>}</header>
      <main className="rl-main" id="main-content" tabIndex={-1}>{children}</main>
    </div>
    <SiteFooter />
  </div>;
}
