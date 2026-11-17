import { describe, expect, it } from "vitest";
import { possibleInstants } from "./localTime";

describe("lokale Ablaufzeit", () => {
  it("lehnt nicht existente lokale Uhrzeiten ab", () => {
    expect(possibleInstants("2026-03-29T02:30", "Europe/Berlin")).toEqual([]);
  });

  it("liefert beide Zeitpunkte für eine doppelte Uhrzeit", () => {
    const instants = possibleInstants("2026-10-25T02:30", "Europe/Berlin");
    expect(instants).toHaveLength(2);
    expect(instants[1] - instants[0]).toBe(60 * 60 * 1000);
  });

  it("wandelt eindeutige lokale Uhrzeiten in den richtigen UTC-Zeitpunkt um", () => {
    expect(possibleInstants("2026-11-17T10:00", "Europe/Berlin")).toEqual([
      Date.parse("2026-11-17T09:00:00.000Z"),
    ]);
  });
});
