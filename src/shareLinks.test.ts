import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displayHost, displayQuizLink, formatJoinCode, normalizeJoinCodeInput, shortQuizLink } from "./shareLinks";

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:4173" } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("kurzer Teilnahmelink", () => {
  it("nutzt die konfigurierte öffentliche Basisadresse", () => {
    vi.stubEnv("VITE_PUBLIC_BASE_URL", "https://ratelama.de/");
    expect(shortQuizLink("482619")).toBe("https://ratelama.de/q/482619");
    expect(displayQuizLink("004281")).toBe("ratelama.de/q/004281");
    expect(displayHost()).toBe("ratelama.de");
  });

  it("fällt ohne oder bei ungültiger Konfiguration auf die tatsächliche Herkunft zurück", () => {
    vi.stubEnv("VITE_PUBLIC_BASE_URL", "");
    expect(shortQuizLink("482619")).toBe("http://127.0.0.1:4173/q/482619");
    vi.stubEnv("VITE_PUBLIC_BASE_URL", "kein link");
    expect(shortQuizLink("482619")).toBe("http://127.0.0.1:4173/q/482619");
    vi.stubEnv("VITE_PUBLIC_BASE_URL", "javascript:alert(1)");
    expect(displayHost()).toBe("127.0.0.1:4173");
  });
});

describe("Quiz-Code-Darstellung und Eingabe", () => {
  it("gruppiert lesbar und behält führende Nullen", () => {
    expect(formatJoinCode("004281")).toBe("004 281");
    expect(formatJoinCode("482619")).toBe("482 619");
  });

  it("normalisiert unkritische Trennzeichen und meldet Fehler verständlich", () => {
    expect(normalizeJoinCodeInput(" 482 619 ")).toEqual({ code: "482619", error: "" });
    expect(normalizeJoinCodeInput("004-281")).toEqual({ code: "004281", error: "" });
    expect(normalizeJoinCodeInput("")).toEqual({ code: "", error: "Bitte gib einen Quiz-Code ein." });
    expect(normalizeJoinCodeInput("48261")).toEqual({ code: "", error: "Der Quiz-Code hat genau 6 Ziffern." });
    expect(normalizeJoinCodeInput("48a619")).toEqual({ code: "", error: "Der Quiz-Code besteht nur aus 6 Ziffern." });
  });
});
