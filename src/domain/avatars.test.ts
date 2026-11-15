import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import catalog from "./avatars.json";

const publicAssets = new URL("../../public/", import.meta.url);

describe("Mitspieler-Avatar-Katalog", () => {
  it("enthält 50 eindeutige IDs mit vorhandenen quadratischen PNGs in beiden Größen", async () => {
    expect(catalog.avatars).toHaveLength(50);
    expect(new Set(catalog.avatars.map((avatar) => avatar.id)).size).toBe(50);
    expect(catalog.avatars.map((avatar) => avatar.id)).toEqual(
      Array.from({ length: 50 }, (_, index) => `avatar-${String(index + 1).padStart(3, "0")}`),
    );

    await Promise.all(catalog.avatars.flatMap((avatar) =>
      [[avatar.path256, 256], [avatar.path512, 512]].map(async ([path, size]) => {
        expect(path).toMatch(/^assets\/avatars\/(256|512)\/[^/]+\.png$/);
        const image = await readFile(new URL(String(path), publicAssets));
        expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        expect(image.readUInt32BE(16)).toBe(size);
        expect(image.readUInt32BE(20)).toBe(size);
      })));
  });
});
