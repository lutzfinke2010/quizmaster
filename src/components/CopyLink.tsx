import { useRef, useState } from "react";
import { Copy } from "lucide-react";

/**
 * Gemeinsame Kopierlogik für Teilnahmelinks: nutzt die Clipboard-API nur, wenn verfügbar, und markiert sonst
 * den Link im Eingabefeld, damit er manuell kopiert werden kann.
 */
export function useCopyLink(href: string) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Zwischenablage nicht verfügbar.");
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopied(false);
    }
  }
  return { copied, copy, inputRef };
}

export function CopyLinkField({ href, label, inputRef }: {
  href: string; label: string; inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return <label className="field">Teilnahmelink
    <input ref={inputRef} readOnly value={href} onFocus={(event) => event.currentTarget.select()} aria-label={label} />
  </label>;
}

export function CopyLinkButton({ onCopy, className = "button secondary small", iconSize = 16 }: {
  onCopy: () => Promise<void>; className?: string; iconSize?: number;
}) {
  return <button type="button" className={className} onClick={() => void onCopy()}><Copy size={iconSize} aria-hidden="true" />Link kopieren</button>;
}
