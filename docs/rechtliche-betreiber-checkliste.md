# Rechtliche Betreiber-Checkliste (Ratelama)

Technischer Entwurf, keine Rechtsberatung. Betreiber ist Lutz Finke als Privatperson; der Arbeitgeber (MAXYA) ist nicht Verantwortlicher. Rechtsquellen wurden am 15.11.2026 gesichtet (§ 5 DDG, § 18 Abs. 1 MStV, § 25 TDDDG, DSGVO) und sind vor Veröffentlichung erneut zu prüfen.

## 1. Offene Betreiberangaben (`src/config/legal.ts`)

- [x] Name und ladungsfähige Anschrift (Lutz Finke, Am Obern Grott 15, 91097 Oberreichenbach)
- [x] E-Mail-Adresse (lutzfinke2010@gmail.com)
- [ ] Optional: zweiter schneller Kontaktweg (z. B. Kontaktformular), `additionalContact`
- [x] Domain: https://www.ratelama.de
- [ ] Bestätigung: Betrieb als Privatperson, keine Verantwortlichkeit des Arbeitgebers
- [x] Zuständige Aufsichtsbehörde: BayLDA, Ansbach (nicht-öffentlicher Bereich Bayern) – vom Betreiber zu bestätigen
- [ ] Datenschutzbeauftragter nur, falls gesetzlich erforderlich (derzeit `null`)
- [ ] Bestätigungen in `config/legal-review.json` auf `true` setzen, danach `npm run legal:check -- --strict`
- [ ] `QUIZRUSH_RETENTION_DAYS` (Backend) = `legal.sessionRetentionDays` (7)

## 2. Datenflüsse

| Daten | Zweck | Rechtsgrundlage (Entwurf) | Ort / Dauer |
|---|---|---|---|
| Spielname, Avatar, Antworten, Antwortzeit, Punkte, anonyme Identity-ID | Durchführung der Runde | Art. 6 Abs. 1 lit. f | DynamoDB; TTL 7 Tage ab **Erstellung der Sitzung**, asynchron |
| Quizmaster-Konto (E-Mail, Cognito) | Konto, Quizvorlagen | Art. 6 Abs. 1 lit. b/f | Cognito / DynamoDB bis Löschung |
| Server-/Funktionslogs | Betrieb, Fehlersuche | Art. 6 Abs. 1 lit. f | CloudWatch, Retention 2 Wochen; keine Payloads |
| Browser-Speicher | Wiedererkennung, Sitzung | § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich), kein Banner | siehe Abschnitt 3 |

## 3. Browser-Speicher

| Schlüssel | Zweck | Dauer |
|---|---|---|
| `com.amplify.Cognito.<Identity-Pool-ID>.identityId` | Anonyme Gast-Kennung | höchstens 24 h |
| `quizrush.expiry.<…>` | Ablaufzeit der Gast-Kennung | wie oben |
| `CognitoIdentityServiceProvider.<Client-ID>.*` | Quizmaster-Anmeldung | bis Abmeldung/Ablauf |
| `quizrush.local-drafts.v1` | Entwürfe im lokalen Modus | bis zur Löschung |

Der Quizmaster-Login ruft vor der Anmeldung keine Gast-Identität ab (`getCurrentUser` statt `fetchAuthSession`).

## 4. Anwendbarkeit (vom Betreiber zu bestätigen)

| Thema | Einschätzung / Aufgabe |
|---|---|
| DDG § 5 / MStV § 18 | Impressum vorgesehen; Anwendbarkeit bei rein privater, nicht geschäftsmäßiger Nutzung prüfen |
| DSGVO / TDDDG | anwendbar; Haushaltsausnahme dürfte bei öffentlicher Nutzung nicht greifen |
| BFSG | Nur bei Verbraucherdienstleistungen im elektronischen Geschäftsverkehr; derzeit voraussichtlich nicht einschlägig – bei Monetarisierung neu prüfen |
| VSBG / Widerruf / AGB | Kostenloser Dienst ohne Vertragsabschluss mit Verbrauchern: derzeit keine AGB; bei Entgelt neu prüfen |
| Urheberrecht / Lizenzen | `LICENSES/shadcn-ui.txt` und weitere Abhängigkeitslizenzen bei Weitergabe beilegen |
| BetrVG § 87 Abs. 1 Nr. 6 | Nur relevant, falls im Arbeitgeberumfeld eingesetzt; mit Arbeitgeber klären |
| Neuprüfung | bei neuen Funktionen (Analytics, Werbung, Fotos, Chat, Entgelt, Marketing-E-Mails) |

## 5. AWS-Aufgaben (nicht im Code prüfbar)

- [ ] Vertragspartei und Auftragsverarbeitungsvertrag (Art. 28 DSGVO) über AWS Artifact / Konsole prüfen und annehmen (die öffentliche DPA-URL lieferte beim Prüfen 404)
- [ ] Regionen (eu-central-1), Subprozessoren, Support-Zugriffe und Drittlandübermittlungen prüfen; Frankfurt bedeutet nicht, dass jede Verarbeitung in Deutschland stattfindet
- [ ] Point-in-Time-Recovery/Backups der DynamoDB-Tabelle: Status und Aufbewahrung prüfen, in Löschkonzept aufnehmen
- [ ] Tabellenverschlüsselung (derzeit AWS-eigener Standard), CloudTrail, AppSync-/WAF-Logging prüfen
- [ ] Step-Functions-Ausführungshistorie (Standard-Workflows ca. 90 Tage) bewerten
- [ ] Alarm-Benachrichtigungsziele einrichten

## 6. TOMs, Betroffenenrechte, Datenpannen

- Technisch: TLS, SQS-DLQ verschlüsselt (`SQS_MANAGED`, `enforceSSL`), Rate-Limits, Hash des Präsentationstokens, CSP/Header (`customHttp.yml`), `noindex`, Log-Retention 2 Wochen.
- [ ] Prozess für Auskunft, Löschung, Widerspruch festlegen (Postfach, Frist 1 Monat); Spieler:innen ohne Namen sind kaum identifizierbar – Identifizierbarkeit via Spielname/Zeitpunkt prüfen
- [ ] Prozess für Datenpannen (Meldung an Aufsichtsbehörde binnen 72 h, Art. 33) festlegen

## 7. Löschkonzept

- Selbstlöschung im Spiel: `deleteMyParticipation` (nur ohne laufende Frage); Antworten/Ergebnisse werden entfernt, der Teilnahmedatensatz bleibt als leerer Tombstone bis zur TTL.
- Automatisch: DynamoDB-TTL, asynchron (Zugriff endet bereits zum Ablaufzeitpunkt).
- **Abweichung von der Spec:** Die Aufbewahrung ist erstellungsbasiert (`createdAt + 7 Tage`), nicht „7 Tage nach Spielende“. Die Datenschutzerklärung formuliert das so. Produktentscheidung des Betreibers.
- Die anonyme Cognito-Identität im Identity Pool wird nicht gelöscht (keine `DeleteIdentities`-Implementierung); sie enthält keine Inhaltsdaten.
- Backups/PITR und Logs unterliegen eigenen Fristen (Abschnitt 5).

## 8. Prüfprotokoll

| Ebene | Status |
|---|---|
| Typprüfung, Unit-Tests, Playwright lokal/Mock | ausgeführt (siehe Abschlussmeldung) |
| `npm run legal:check` | meldet erwartungsgemäß offene Platzhalter |
| Reale AWS-Umgebung (Deploy, Realtime unter CSP, Header-Auslieferung, Löschmutation) | **nicht geprüft** |

## 9. Manuelle Schritte vor Veröffentlichung

1. Betreiberangaben ergänzen und `legal-review.json` bestätigen; `npm run legal:check -- --strict` muss grün sein.
2. Backend deployen (neue Mutation `deleteMyParticipation`, Log-Retention, DLQ-Verschlüsselung) – kein automatischer Deploy durch diese Änderung.
3. SPA-Rewrite in der Amplify-Konsole prüfen (README „Hosting und Betrieb“).
4. `customHttp.yml`: AppSync-Wildcard in `connect-src` nach erstem Deployment durch den exakten Host ersetzen; HSTS-Entscheidung treffen (derzeit auskommentiert). Prüfen, dass Header auch für `/admin`, `/play/*`, `/present/*` ausgeliefert werden (inkl. `X-Robots-Tag`), und dass keine CSP-Verstöße in der Browserkonsole auftreten (Realtime/WebSocket).
5. Lösch-Button, Impressum und Datenschutzerklärung in der echten Umgebung durchspielen.
6. Rechtstexte juristisch prüfen lassen.
