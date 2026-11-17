import { randomInt } from "node:crypto";
import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logger } from "./logger";
import { isConditionalFailure } from "./transactionRetry";

/**
 * Gemeinsamer Codebereich für Live-Spielcodes und Quiz-Codes veröffentlichter Quizrunden („Quiz zum Mitmachen“).
 *
 * Beide Modi reservieren `CODE#<code>`/`META` atomar in derselben Transaktion wie ihre Metadaten:
 * - Live: `{ sessionId, expiresAt, ttl }` – nach Ablauf wiederverwendbar.
 * - Quizrunde: `{ publicationId, kind: "ASYNC", createdAt }` ohne `ttl`/`expiresAt` – dauerhafte Nichtwiedervergabe,
 *   damit eine verteilte Einladung (QR/Link/Code) nie auf eine andere Runde zeigt. Der Eintrag enthält keine
 *   Teilnehmerdaten und bleibt nach dem TTL-Löschen der Runde als minimaler Reservierungsbezug erhalten.
 */
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_PATTERN = new RegExp(`^\\d{${JOIN_CODE_LENGTH}}$`);
/** Begrenzte Zahl zufälliger Kandidaten je Vergabe; danach klarer Fehler statt unbeschränktem Retry. */
export const MAX_JOIN_CODE_ATTEMPTS = 20;

/** Bedingung für neue Reservierungen: frei oder abgelaufener Live-Code (nie ein Quizrunden-Code). */
export const JOIN_CODE_FREE_CONDITION = "attribute_not_exists(pk) OR (expiresAt <= :now AND attribute_not_exists(publicationId))";

export class JoinCodeSpaceExhaustedError extends Error {
  constructor() {
    // Bewusst kein Umleiten alter Codes: Bei dauerhaftem Engpass muss JOIN_CODE_LENGTH erhöht werden.
    super("Es konnte kein freier Quiz-Code reserviert werden. Bitte versuche es erneut.");
    this.name = "JoinCodeSpaceExhaustedError";
  }
}

export function joinCodeKey(code: string) {
  return { pk: `CODE#${code}`, sk: "META" };
}

/** Zufälliger Kandidat als Zeichenkette; führende Nullen sind gültig (z. B. „004281“). */
export function randomJoinCodeCandidate(): string {
  return String(randomInt(0, 10 ** JOIN_CODE_LENGTH)).padStart(JOIN_CODE_LENGTH, "0");
}

/**
 * Normalisiert eine Eingabe wie „482 619“ oder „482-619“ zu „482619“.
 * Unkritische Gruppierungszeichen (Leerzeichen inkl. geschützter/schmaler Leerzeichen, Bindestrich, Punkt) werden
 * entfernt; andere Zeichen und falsche Längen werden verständlich abgelehnt. Nie als Zahl parsen (führende Nullen).
 */
export function normalizeJoinCode(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Bitte gib einen Quiz-Code ein.");
  const compact = raw.normalize("NFKC").replace(/[\s\u00a0\u2009\u202f.\-–]/g, "");
  if (!compact) throw new Error("Bitte gib einen Quiz-Code ein.");
  if (!/^\d+$/.test(compact)) throw new Error(`Der Quiz-Code besteht nur aus ${JOIN_CODE_LENGTH} Ziffern.`);
  if (compact.length !== JOIN_CODE_LENGTH) throw new Error(`Der Quiz-Code hat genau ${JOIN_CODE_LENGTH} Ziffern.`);
  return compact;
}

export function isJoinCodeLike(raw: unknown): boolean {
  try {
    normalizeJoinCode(raw);
    return true;
  } catch {
    return false;
  }
}

/** Belegt: Quizrunden-Code (dauerhaft) oder noch gültiger Live-Code. */
export async function isJoinCodeTaken(
  client: DynamoDBDocumentClient, tableName: string, code: string, now: number,
): Promise<boolean> {
  const existing = await client.send(new GetCommand({ TableName: tableName, Key: joinCodeKey(code), ConsistentRead: true }));
  const item = existing.Item;
  if (!item) return false;
  if (typeof item.publicationId === "string") return true;
  return typeof item.expiresAt === "number" && item.expiresAt > now;
}

/**
 * Gemeinsame Vergabeschleife: `write` reserviert den Kandidaten atomar zusammen mit den Metadaten.
 * Bei einer bedingten Ablehnung darf `recover` ein bereits bestätigtes Ergebnis liefern (Idempotenz/paralleler Tab);
 * sonst wird nur bei tatsächlich belegtem Code ein neuer Kandidat gewählt.
 */
export async function reserveJoinCode<T>(
  client: DynamoDBDocumentClient, tableName: string, now: number,
  write: (candidate: string) => Promise<T>,
  recover?: (error: unknown) => Promise<T | undefined>,
  candidates: () => string = randomJoinCodeCandidate,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const candidate = candidates();
    try {
      return await write(candidate);
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const recovered = recover ? await recover(error) : undefined;
      if (recovered !== undefined) return recovered;
      if (!(await isJoinCodeTaken(client, tableName, candidate, now))) throw error;
      logger.warn("joinCode.collision", { attempt });
    }
  }
  throw new JoinCodeSpaceExhaustedError();
}
