import { describe, expect, it } from "vitest";
import { adminAccess, authMessage, emailSchema, passwordSchema } from "./adminAuth";

describe("Quizmaster-Zugang", () => {
  it("verlangt eine echte Gruppenzugehörigkeit statt bloßer Anmeldung", () => {
    expect(adminAccess(undefined)).toBe("signedOut");
    expect(adminAccess({})).toBe("pending");
    expect(adminAccess({ "cognito:groups": ["Other"] })).toBe("pending");
    expect(adminAccess({ "cognito:groups": ["Quizmasters"] })).toBe("authorized");
    expect(() => adminAccess({ "cognito:groups": "Quizmasters" })).toThrow();
    expect(() => adminAccess({ "cognito:groups": [true] })).toThrow();
  });
  it("validiert E-Mail und die konfigurierte Cognito-Passwortrichtlinie", () => {
    expect(emailSchema.parse(" person@example.invalid ")).toBe("person@example.invalid");
    expect(emailSchema.safeParse("kein-konto").success).toBe(false);
    const schema = passwordSchema({ minLength: 12, requireLowercase: true, requireUppercase: true,
      requireNumbers: true, requireSpecialCharacters: true });
    expect(schema.safeParse("LangGenug!123").success).toBe(true);
    for (const password of ["Kurz!1aA", "nurkleinbuchstaben!123", "NURGROSSBUCHSTABEN!123", "KeineZahlenImPasswort!", "OhneSonderzeichen123"]) {
      expect(schema.safeParse(password).success).toBe(false);
    }
    expect(passwordSchema().safeParse("1234567").success).toBe(false);
  });
  it("zeigt Authentifizierungsfehler auf Deutsch ohne interne Fehlerdetails", () => {
    const error = (name: string) => Object.assign(new Error("Internal details"), { name });
    expect(authMessage(error("ExpiredCodeException"))).toContain("abgelaufen");
    expect(authMessage(error("CodeMismatchException"))).toContain("ungültig");
    expect(authMessage(error("CodeDeliveryFailureException"))).toContain("nicht versendet");
    expect(authMessage(error("UsernameExistsException"))).toContain("bereits besteht");
    expect(authMessage(error("NetworkError"))).not.toContain("Internal details");
    expect(authMessage({ name: "CodeMismatchException" })).toContain("fehlgeschlagen");
  });
});
