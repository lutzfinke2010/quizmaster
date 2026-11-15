// Prüft die rechtlichen Betreiberangaben. Lokal: Hinweise. Mit --strict (Release): Fehler bei offenen Punkten.
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const strict = process.argv.includes("--strict");
const root = new URL("../", import.meta.url);

const source = await readFile(new URL("src/config/legal.ts", root), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { legal, openLegalFields } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const review = JSON.parse(await readFile(new URL("config/legal-review.json", root), "utf8"));

const problems = [];
const notes = [];

for (const field of openLegalFields(legal)) problems.push(`Betreiberangabe offen: ${field}`);
for (const [key, value] of Object.entries(review)) {
  if (!key.startsWith("_") && value !== true) problems.push(`Bestätigung fehlt: ${key}`);
}

const configuredDays = Number(process.env.QUIZRUSH_RETENTION_DAYS ?? "7");
if (configuredDays !== legal.sessionRetentionDays) {
  problems.push(`Aufbewahrungsfrist weicht ab: legal.ts=${legal.sessionRetentionDays} Tage, QUIZRUSH_RETENTION_DAYS=${configuredDays}`);
}

const outputsFile = new URL("amplify_outputs.json", root);
try {
  const outputs = JSON.parse(await readFile(outputsFile, "utf8"));
  const region = outputs.data?.aws_region;
  const host = new URL(outputs.data?.url ?? "https://invalid.invalid").hostname;
  const headers = await readFile(new URL("customHttp.yml", root), "utf8");
  if (region && !headers.includes(`appsync-api.${region}.amazonaws.com`)) {
    problems.push(`customHttp.yml: connect-src enthält nicht die AppSync-Region ${region} (API-Host ${host})`);
  }
} catch {
  notes.push("amplify_outputs.json nicht vorhanden: CSP-Abgleich mit der Region übersprungen.");
}

for (const note of notes) console.log(`Hinweis: ${note}`);
if (problems.length === 0) {
  console.log("legal:check: keine offenen Punkte.");
} else {
  console.log(`legal:check: ${problems.length} offene Punkte${strict ? " (strict)" : " (Entwurfsmodus)"}`);
  for (const problem of problems) console.log(` - ${problem}`);
  console.log("Hinweis: Diese Prüfung ersetzt keine rechtliche Beratung und prüft keine AWS-Konto-Einstellungen.");
}
process.exit(strict && problems.length > 0 ? 1 : 0);
