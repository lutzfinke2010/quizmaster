import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Ended entries, collapsed by default so that running rounds stay in view. Renders nothing without entries. */
export function ArchiveSection({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return <details className="archive-section">
    <summary><span className="archive-label">{label}</span><span className="archive-count">{count}</span>
      <span className="archive-toggle" aria-hidden="true" /></summary>
    <ul className="archive-list">{children}</ul>
  </details>;
}

export function ArchiveRow({ title, status, to, action, children }: {
  title: string; status: string; to: string; action: string; children: ReactNode;
}) {
  return <li className="archive-row">
    <div className="archive-row-main">
      <h3>{title}</h3>
      <div className="archive-row-meta"><span className="badge">{status}</span>{children}</div>
    </div>
    <Link className="button rl-btn rl-btn-secondary rl-btn-small" to={to}>{action}</Link>
  </li>;
}
