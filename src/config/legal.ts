// Öffentliche Betreiberangaben. Diese Datei wird in das Frontend gebündelt: keine Geheimnisse eintragen.
// Platzhalter in eckigen Klammern müssen vor einer Veröffentlichung ersetzt werden (npm run legal:check -- --strict).

export type LegalConfig = {
  appName: string;
  providerName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  contactEmail: string;
  /** Optionaler zweiter Kontaktweg, z. B. ein Kontaktformular oder eine Telefonnummer. */
  additionalContact: string | null;
  canonicalOrigin: string;
  /** Muss zu QUIZRUSH_RETENTION_DAYS im Backend passen (wird von legal:check verglichen). */
  sessionRetentionDays: number;
  /** Aufbewahrung der Lambda-Logs in Tagen (amplify/backend.ts). */
  logRetentionDays: number;
  privacyContactEmail: string;
  dataProtectionOfficer: string | null;
  supervisoryAuthority: { name: string; url: string } | null;
};

export const legal: LegalConfig = {
  appName: "QuizRush",
  providerName: "Lutz Finke",
  street: "Am Obern Grott 15",
  postalCode: "91097",
  city: "Oberreichenbach",
  country: "Deutschland",
  contactEmail: "lutzfinke2010@gmail.com",
  additionalContact: null,
  canonicalOrigin: "https://www.ratelama.de",
  sessionRetentionDays: 7,
  logRetentionDays: 14,
  privacyContactEmail: "lutzfinke2010@gmail.com",
  dataProtectionOfficer: null,
  supervisoryAuthority: { name: "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach", url: "https://www.lda.bayern.de" },
};

export function isPlaceholder(value: string | null | undefined): boolean {
  return typeof value === "string" && /\[[^\]]*ERGÄNZEN[^\]]*\]/.test(value);
}

export function openLegalFields(config: LegalConfig = legal): string[] {
  const required: [string, string][] = [
    ["Name", config.providerName], ["Straße und Hausnummer", config.street], ["PLZ", config.postalCode],
    ["Ort", config.city], ["Kontakt-E-Mail", config.contactEmail], ["Domain", config.canonicalOrigin],
    ["Datenschutz-Kontakt", config.privacyContactEmail],
  ];
  const open = required.filter(([, value]) => !value.trim() || isPlaceholder(value)).map(([label]) => label);
  if (!config.supervisoryAuthority) open.push("Zuständige Aufsichtsbehörde");
  return open;
}

export const legalDraft = openLegalFields().length > 0;
