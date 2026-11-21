import { Copy } from "lucide-react";
import { useCopyText } from "./useCopyText";

/** Labelled copy action with status message and a usable fallback without clipboard access. */
export function CopyAction({ text, label, copiedMessage, fieldLabel, className = "rl-btn rl-btn-secondary rl-btn-small" }: {
  text: string; label: string; copiedMessage: string; fieldLabel: string; className?: string;
}) {
  const { state, copy, inputRef } = useCopyText(text);
  return <span className="rl-copy">
    <button type="button" className={className} onClick={() => void copy()}>
      <Copy aria-hidden="true" />{label}</button>
    {state === "copied" && <span className="rl-copy-status" role="status">{copiedMessage}</span>}
    {state === "manual" && <label className="rl-copy-fallback">
      <span>Kopieren nicht möglich – bitte markierten Text manuell kopieren:</span>
      <input ref={inputRef} className="rl-input" readOnly value={text} onFocus={(event) => event.currentTarget.select()}
        aria-label={fieldLabel} />
    </label>}
  </span>;
}
