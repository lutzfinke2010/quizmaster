/**
 * Kanonische Teilnahmeadressen für „Quiz zum Mitmachen“. Die öffentliche Basisadresse kommt aus der Umgebung
 * (`VITE_PUBLIC_BASE_URL`, z. B. `https://ratelama.de`); ohne Konfiguration gilt die aktuelle Herkunft, damit lokale
 * oder Preview-Instanzen nie unbemerkt Produktionslinks erzeugen.
 */
export function publicBaseUrl(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_BASE_URL ?? "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Ungültige Konfiguration: auf die tatsächliche Herkunft zurückfallen.
    }
  }
  return window.location.origin;
}

/** Vollständiger kurzer Teilnahmelink, z. B. `https://ratelama.de/q/482619` – Inhalt von QR-Code und „Link kopieren“. */
export function shortQuizLink(joinCode: string): string {
  return `${publicBaseUrl()}/q/${joinCode}`;
}

/** Sichtbare Kurzform ohne Schema, z. B. `ratelama.de/q/482619`. */
export function displayQuizLink(joinCode: string): string {
  return shortQuizLink(joinCode).replace(/^https?:\/\//, "");
}

/** Host der Beitrittsseite ohne Schema, z. B. `ratelama.de`. */
export function displayHost(): string {
  return publicBaseUrl().replace(/^https?:\/\//, "");
}

/** Lesbare Gruppierung „482 619“; führende Nullen bleiben erhalten („004 281“). */
export function formatJoinCode(joinCode: string): string {
  return joinCode.length === 6 ? `${joinCode.slice(0, 3)} ${joinCode.slice(3)}` : joinCode;
}

/** Clientseitige Vorprüfung (Server prüft erneut): Leerzeichen/Bindestriche/Punkte entfernen, nur Ziffern. */
export function normalizeJoinCodeInput(raw: string): { code: string; error: string } {
  const compact = raw.normalize("NFKC").replace(/[\s\u00a0\u2009\u202f.\-–]/g, "");
  if (!compact) return { code: "", error: "Bitte gib einen Quiz-Code ein." };
  if (!/^\d+$/.test(compact)) return { code: "", error: "Der Quiz-Code besteht nur aus 6 Ziffern." };
  if (compact.length !== 6) return { code: "", error: "Der Quiz-Code hat genau 6 Ziffern." };
  return { code: compact, error: "" };
}
