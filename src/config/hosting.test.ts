import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** The SPA rewrite configured in the Amplify Console, as documented in the README. */
async function amplifyRewrite() {
  const readme = await readFile(join(root, "README.md"), "utf8");
  const source = readme.match(/eignet sich `<\/(.+?)\/>`/)?.[1];
  if (!source) throw new Error("Amplify-Rewrite-Regel nicht im README gefunden");
  return new RegExp(source);
}

describe("Amplify Hosting", () => {
  it("liefert jede Datei aus public/ direkt aus statt index.html", async () => {
    const rewrite = await amplifyRewrite();
    const publicDir = join(root, "public");
    const paths = (await readdir(publicDir, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => `/${relative(publicDir, join(entry.parentPath, entry.name)).split(sep).join("/")}`);
    expect(paths).toContain("/assets/ratelama/mascots/lama-kopf-avatar-128.png");
    expect(paths.filter((path) => rewrite.test(path))).toEqual([]);
  });

  it("schreibt App-Routen weiterhin auf index.html um", async () => {
    const rewrite = await amplifyRewrite();
    for (const route of ["/join", "/admin", "/q/ABC123", "/einladung/ABC123"]) expect(rewrite.test(route)).toBe(true);
  });
});
