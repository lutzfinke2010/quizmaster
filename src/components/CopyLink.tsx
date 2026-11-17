import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";

/**
 * Gemeinsame Kopierlogik für Teilnahmelinks und Quiz-Codes: nutzt die Clipboard-API nur, wenn verfügbar.
 * Ohne Zwischenablage wird kein Erfolg gemeldet, sondern ein markiertes Feld zum manuellen Kopieren eingeblendet.
 */
export function useCopyText(text: string) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state !== "manual") return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [state]);
  useEffect(() => setState("idle"), [text]);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Zwischenablage nicht verfügbar.");
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("manual");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }
  return { state, copy, inputRef };
}

/** Beschriftete Kopieraktion mit Statusmeldung und nutzbarem Fallback bei fehlender Zwischenablage. */
export function CopyAction({ text, label, copiedMessage, fieldLabel, className = "button secondary small", iconSize = 16 }: {
  text: string; label: string; copiedMessage: string; fieldLabel: string; className?: string; iconSize?: number;
}) {
  const { state, copy, inputRef } = useCopyText(text);
  return <span className="copy-action">
    <button type="button" className={className} onClick={() => void copy()}>
      <Copy size={iconSize} aria-hidden="true" />{label}</button>
    {state === "copied" && <span className="copy-status" role="status">{copiedMessage}</span>}
    {state === "manual" && <label className="field copy-fallback">
      <span>Kopieren nicht möglich – bitte markierten Text manuell kopieren:</span>
      <input ref={inputRef} readOnly value={text} onFocus={(event) => event.currentTarget.select()} aria-label={fieldLabel} />
    </label>}
  </span>;
}
