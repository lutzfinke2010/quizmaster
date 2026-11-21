import { useEffect, useRef, useState } from "react";

/**
 * Uses the Clipboard API only when available. Without a clipboard no success is reported; instead a selected
 * field for manual copying is shown.
 */
export function useCopyText(text: string) {
  const [result, setResult] = useState<{ text: string; state: "copied" | "manual" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const state = result?.text === text ? result.state : "idle";
  useEffect(() => {
    if (state !== "manual") return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [state]);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Zwischenablage nicht verfügbar.");
      await navigator.clipboard.writeText(text);
      setResult({ text, state: "copied" });
    } catch {
      setResult({ text, state: "manual" });
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }
  return { state, copy, inputRef };
}
