import { z } from "zod";

export const emailSchema = z.string().trim().min(1, "Bitte die E-Mail-Adresse eingeben.")
  .max(254, "Die E-Mail-Adresse ist zu lang.").email("Bitte eine gültige E-Mail-Adresse eingeben.");

export type PasswordPolicy = {
  minLength?: number;
  requireLowercase?: boolean;
  requireUppercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialCharacters?: boolean;
};

export function passwordSchema(policy: PasswordPolicy = {}) {
  const min = policy.minLength ?? 8;
  let schema = z.string().min(min, `Mindestens ${min} Zeichen verwenden.`).max(256, "Höchstens 256 Zeichen verwenden.");
  if (policy.requireLowercase) schema = schema.regex(/[a-z]/, "Mindestens einen Kleinbuchstaben verwenden.");
  if (policy.requireUppercase) schema = schema.regex(/[A-Z]/, "Mindestens einen Großbuchstaben verwenden.");
  if (policy.requireNumbers) schema = schema.regex(/[0-9]/, "Mindestens eine Zahl verwenden.");
  if (policy.requireSpecialCharacters) schema = schema.regex(/[^A-Za-z0-9\s]/, "Mindestens ein Sonderzeichen verwenden.");
  return schema;
}

export function adminAccess(payload: Record<string, unknown> | undefined): "signedOut" | "pending" | "authorized" {
  if (!payload) return "signedOut";
  const groups = z.array(z.string()).optional().parse(payload["cognito:groups"]);
  return groups?.includes("Quizmasters") ? "authorized" : "pending";
}

export function authMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "UsernameExistsException": return "Das Konto konnte nicht angelegt werden. Falls es bereits besteht, bitte anmelden oder die E-Mail-Bestätigung fortsetzen.";
    case "CodeMismatchException": return "Der Bestätigungscode ist ungültig. Bitte prüfe den Code.";
    case "ExpiredCodeException": return "Der Bestätigungscode ist abgelaufen. Bitte fordere einen neuen Code an.";
    case "LimitExceededException":
    case "TooManyRequestsException": return "Zu viele Versuche. Bitte warte etwas und versuche es erneut.";
    case "InvalidPasswordException": return "Das Passwort erfüllt die Anforderungen nicht. Bitte verwende ein längeres Passwort mit Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.";
    case "NotAuthorizedException":
    case "UserNotFoundException": return "Anmeldung nicht möglich. Bitte prüfe E-Mail-Adresse und Passwort oder bestätige dein Konto.";
    case "CodeDeliveryFailureException": return "Der Bestätigungscode konnte nicht versendet werden. Bitte versuche es später erneut.";
    default: return "Die Anmeldung oder Kontoaktualisierung ist fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut.";
  }
}
