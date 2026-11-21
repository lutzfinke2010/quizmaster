import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";

type Tone = "info" | "success" | "warning" | "error";

const ICONS = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle } as const;

/** Inline message box. `error` uses role="alert", everything else role="status". */
export function Notice({ tone = "info", children, className = "", live = true }: {
  tone?: Tone; children: ReactNode; className?: string; live?: boolean;
}) {
  const Icon = ICONS[tone];
  const role = !live ? undefined : tone === "error" ? "alert" : "status";
  return <div role={role} className={`rl-notice rl-notice-${tone} ${className}`.trim()}>
    <Icon aria-hidden="true" strokeWidth={2.4} />
    <div className="rl-notice-body">{children}</div>
  </div>;
}

/** Renders nothing for an empty error. */
export function ErrorNotice({ error, children }: { error: string; children?: ReactNode }) {
  return error ? <Notice tone="error"><span>{error}</span>{children}</Notice> : null;
}

export function LoadingNotice({ children }: { children: ReactNode }) {
  return <p role="status" className="rl-notice rl-notice-info rl-loading">
    <LoaderCircle aria-hidden="true" strokeWidth={2.6} /><span>{children}</span>
  </p>;
}
