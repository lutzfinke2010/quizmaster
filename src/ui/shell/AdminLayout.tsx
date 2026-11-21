import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { House, LayoutGrid, LogOut, Plus, Sparkles, Ticket } from "lucide-react";
import { message } from "../common/message";
import { ErrorNotice } from "../common/Notices";
import { useAppMode } from "./appMode";
import { Brand, SkipLink } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import "../neu.css";
import "../overview.css";
import "./shell.css";

/** Sidebar layout for the quizmaster area (dashboard, editor, generator, publishing, results, host control). */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { cloud } = useAppMode();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try { await signOut(); navigate("/"); } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }
  const itemClass = ({ isActive }: { isActive: boolean }) => `rl-nav-item${isActive ? " is-active" : ""}`;
  return <div className="rl rl-overview rl-admin-layout">
    <SkipLink />
    <aside className="rl-sidebar">
      <Brand to="/admin" label="RateLama – Übersicht" />
      <nav aria-label="Quizmaster-Navigation">
        <ul className="rl-nav">
          <li><NavLink end to="/admin" className={itemClass}><LayoutGrid aria-hidden="true" strokeWidth={2.4} />Übersicht</NavLink></li>
          <li><NavLink end to="/admin/quizzes/new" className={itemClass}><Plus aria-hidden="true" strokeWidth={2.4} />Neues Quiz</NavLink></li>
          {cloud && <li><NavLink end to="/admin/quizzes/generate" className={itemClass}>
            <Sparkles aria-hidden="true" strokeWidth={2.4} />Mit KI erstellen</NavLink></li>}
          <li>{cloud
            ? <NavLink end to="/join" className={itemClass}><Ticket aria-hidden="true" strokeWidth={2.4} />Mitspielen</NavLink>
            : <NavLink end to="/" className={itemClass}><House aria-hidden="true" strokeWidth={2.4} />Startseite</NavLink>}</li>
          {cloud && <li><button type="button" className="rl-nav-item rl-nav-button" disabled={busy} onClick={() => void logout()}>
            <LogOut aria-hidden="true" strokeWidth={2.4} />{busy ? "Wird abgemeldet …" : "Abmelden"}</button></li>}
        </ul>
      </nav>
    </aside>
    <div className="rl-admin-column">
      <main className="rl-overview-main" id="main-content" tabIndex={-1}>
        <ErrorNotice error={error} />
        {children}
      </main>
      <SiteFooter />
    </div>
  </div>;
}
