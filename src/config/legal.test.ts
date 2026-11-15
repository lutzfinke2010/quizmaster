import { describe, expect, it } from "vitest";
import { isPlaceholder, legal, openLegalFields } from "./legal";

describe("Rechtliche Betreiberangaben", () => {
  it("erkennt Platzhalter und meldet fehlende Angaben", () => {
    expect(isPlaceholder("[ORT ERGÄNZEN]")).toBe(true);
    expect(isPlaceholder("Berlin")).toBe(false);
    expect(openLegalFields({ ...legal, street: "[STRASSE ERGÄNZEN]", contactEmail: "", supervisoryAuthority: null }))
      .toEqual(["Straße und Hausnummer", "Kontakt-E-Mail", "Zuständige Aufsichtsbehörde"]);
  });

  it("enthält vollständige Betreiberangaben", () => {
    expect(openLegalFields()).toEqual([]);
    expect(legal.canonicalOrigin).toMatch(/^https:\/\/[^/]+$/);
  });

  it("meldet nichts, wenn alles ausgefüllt ist", () => {
    expect(openLegalFields({ ...legal, street: "Musterweg 1", postalCode: "10115", city: "Berlin",
      contactEmail: "a@example.invalid", privacyContactEmail: "a@example.invalid", canonicalOrigin: "https://example.invalid",
      supervisoryAuthority: { name: "Behörde", url: "https://example.invalid" } })).toEqual([]);
  });

  it("nennt keinen Arbeitgeber als Betreiber", () => {
    expect(JSON.stringify(legal)).not.toMatch(/MAXYA/i);
  });
});
