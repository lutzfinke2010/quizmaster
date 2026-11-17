import { ZodError } from "zod";
import { logger } from "./logger";

const GENERIC = "Der Vorgang ist fehlgeschlagen. Bitte versuche es gleich erneut.";
const INVALID = "Ungültige Anfrage.";
const CONFLICT = "Der Spielstand hat sich zwischenzeitlich geändert. Bitte lade die Ansicht neu und versuche es erneut.";
const THROTTLED = "Der Dienst ist gerade stark ausgelastet. Bitte versuche es gleich erneut.";

const conflictNames = new Set(["ConditionalCheckFailedException", "TransactionCanceledException", "TransactionConflictException"]);
const throttleNames = new Set(["ProvisionedThroughputExceededException", "ThrottlingException", "RequestLimitExceeded"]);

function isAwsError(error: Error): boolean {
  return "$metadata" in error || "$fault" in error;
}

/**
 * Übersetzt Fehler in Meldungen für Clients. Fachliche Fehler (einfache `Error`-Instanzen mit deutscher Meldung)
 * werden unverändert weitergegeben; Validierungs-, AWS- und Programmierfehler werden generisch gemeldet und
 * intern strukturiert geloggt, damit keine internen Strukturen (Schemas, Tabellen, Schlüssel) sichtbar werden.
 */
export function toClientError(error: unknown, operation: string): Error {
  if (error instanceof ZodError) {
    logger.warn("request.invalid", { operation, issues: error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })) });
    return new Error(INVALID);
  }
  if (error instanceof Error && isAwsError(error)) {
    if (conflictNames.has(error.name)) {
      logger.warn("request.conflict", { operation, error });
      return new Error(CONFLICT);
    }
    if (throttleNames.has(error.name)) {
      logger.warn("request.throttled", { operation, error });
      return new Error(THROTTLED);
    }
    logger.error("request.awsError", { operation, error });
    return new Error(GENERIC);
  }
  if (error instanceof Error && error.constructor === Error && error.message) {
    logger.info("request.rejected", { operation, reason: error.message });
    return error;
  }
  logger.error("request.failed", { operation, error });
  return new Error(GENERIC);
}
