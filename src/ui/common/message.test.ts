import { describe, expect, it } from "vitest";
import { message } from "./message";

describe("message", () => {
  it("liest Fehlermeldungen aus Error und GraphQL-Antworten", () => {
    expect(message(new Error("Kaputt"))).toBe("Kaputt");
    expect(message({ errors: [{ message: "A" }, { message: "B" }, {}] })).toBe("A; B; Unbekannter Fehler");
    expect(message("x")).toBe("Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.");
  });
});
