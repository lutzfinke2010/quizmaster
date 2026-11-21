# Rechtliche Betreiber-Checkliste (Ratelama)

Technischer Entwurf, keine Rechtsberatung. Betreiber ist Lutz Finke als Privatperson; der Arbeitgeber (MAXYA) ist nicht Verantwortlicher. § 25 TDDDG und der aktuelle Katalog der Datenschutzkonferenz wurden am 16.11.2026 abgeglichen. Die dort aufgeführte einschlägige Orientierungshilfe für digitale Dienste stammt von November 2024. Vor Veröffentlichung sind Rechtslage, konkrete Konfiguration und rechtliche Einordnung erneut zu prüfen: [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html), [Orientierungshilfen der DSK](https://www.datenschutzkonferenz-online.de/orientierungshilfen.html), [OH Digitale Dienste (November 2024)](https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf).

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
| Browser-Speicher | Jeweils angeforderte Funktion; optionale Entwürfe nur nach Aktivierung | § 25 TDDDG funktionsbezogen prüfen; kein pauschales Banner allein wegen localStorage | siehe Abschnitt 3; Live-Hosting und Rechtsbewertung offen |

## 3. Browser-Speicher

| Schlüssel | Zweck | Dauer |
|---|---|---|
| `com.amplify.Cognito.<Identity-Pool-ID>.identityId` | Technische Gast-Kennung für angeforderte Live-Spiel-/Präsentationszugriffe | 24 h ab erster Speicherung, nicht rollierend; Ablauf wird im offenen Tab und bei Rückkehr geprüft, bei geschlossenem Browser physische Bereinigung bei nächster Ausführung |
| `quizrush.expiry.<…>` | Lokaler Ablaufzeitpunkt der Gast-Kennung | zusammen mit der Kennung gelöscht; basiert auf Browseruhr und ist keine serverseitige Sicherheitsgrenze |
| `CognitoIdentityServiceProvider.<Client-ID>.*` | SDK-verwaltete Quizmaster-Anmeldung samt Access-, ID- und Refresh-Token | Backend setzt Access-/ID-Tokens auf 60 Minuten und Refresh-Token auf 1 Tag; Refresh verlängert diese Frist nicht. Deployment-Konfiguration in Cognito bestätigen; Logout über Amplify |
| `quizrush.local-drafts.v1` | Optionale lokale Quiz-Entwürfe | zunächst ausgeschaltet; bestehende Entwürfe werden erst nach Aktivierung gelesen, neue nur nach ausdrücklichem Speichern abgelegt; bis gezielter Löschung oder Entfernen der Website-Daten |

Der Quizmaster-Login ruft vor der Anmeldung keine Gast-Identität ab (`getCurrentUser` statt `fetchAuthSession`). Das Frontend verwendet Amplifys Standard-Browserspeicher statt CookieStorage. Ein lokaler Playwright-Lauf prüft Cookies und `Set-Cookie`; tatsächliche Antwortheader der Produktivumgebung sind nicht geprüft.

§ 25 TDDDG betrifft Endgerätezugriffe, während die anschließende Verarbeitung personenbezogener Daten eine eigenständige DSGVO-Rechtsgrundlage benötigt. Die technische Zuordnung als notwendige Funktion ist keine abschließende Rechtsbewertung. Die Auswahl zur Entwurfsspeicherung ist kein pauschales Consent und wird nicht automatisch als rechtlich ausreichende Einwilligung behauptet.

## 4. Anwendbarkeit (vom Betreiber zu bestätigen)

| Thema | Einschätzung / Aufgabe |
|---|---|
| DDG § 5 / MStV § 18 | Impressum vorgesehen; Anwendbarkeit bei rein privater, nicht geschäftsmäßiger Nutzung prüfen |
| DSGVO / TDDDG | anwendbar; Haushaltsausnahme dürfte bei öffentlicher Nutzung nicht greifen |
| BFSG | Nur bei Verbraucherdienstleistungen im elektronischen Geschäftsverkehr; derzeit voraussichtlich nicht einschlägig – bei Monetarisierung neu prüfen |
| VSBG / Widerruf / AGB | Kostenloser Dienst ohne Vertragsabschluss mit Verbrauchern: derzeit keine AGB; bei Entgelt neu prüfen |
| Urheberrecht / Lizenzen | Abhängigkeitslizenzen bei Weitergabe beilegen |
| BetrVG § 87 Abs. 1 Nr. 6 | Nur relevant, falls im Arbeitgeberumfeld eingesetzt; mit Arbeitgeber klären |
| Neuprüfung | bei neuen Funktionen (Analytics, Werbung, Fotos, Chat, Entgelt, Marketing-E-Mails) |

## 5. AWS-Aufgaben (nicht im Code prüfbar)

- [ ] Für die KI-Quizgenerierung: OpenAI-Vertragsbedingungen bzw. Data Processing Addendum prüfen und abschließen, Drittlandübermittlung (USA) bewerten und Angaben in der Datenschutzerklärung (Abschnitt 7) bestätigen
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

- Selbstlöschung im Spiel: `deleteMyParticipation` (nur ohne laufende Frage); Antworten/Ergebnisse werden entfernt, der Teilnahmedatensatz bleibt als leerer Tombstone bis zur TTL. Die gemeinsame lokale Gast-Kennung bleibt erhalten, damit andere offene Sitzungen im selben Browser nicht ihre Wiederverbindung verlieren.
- Automatisch: DynamoDB-TTL, asynchron (Zugriff endet bereits zum Ablaufzeitpunkt).
- **Abweichung von der Spec:** Die Aufbewahrung ist erstellungsbasiert (`createdAt + 7 Tage`), nicht „7 Tage nach Spielende“. Die Datenschutzerklärung formuliert das so. Produktentscheidung des Betreibers.
- Die lokale Identity-Pool-Kennung wird nach spätestens 24 Stunden logisch ungültig und danach lokal bereinigt; die serverseitige Cognito-Identität selbst wird nicht gelöscht (keine `DeleteIdentities`-Implementierung).
- Backups/PITR und Logs unterliegen eigenen Fristen (Abschnitt 5).

## 8. Prüfprotokoll

| Ebene | Status |
|---|---|
| Typprüfung, Unit-Tests, Playwright lokal/Mock | nach Änderungen auszuführen; Ergebnisse in der Abschlussmeldung dokumentieren |
| `npm run legal:check` | meldet erwartungsgemäß offene Platzhalter |
| Reale AWS-Umgebung (deployte Cognito-Tokenlaufzeiten/-Tab-Sync, Browser-Reconnect, Set-Cookie-/Hosting-Header, Löschmutation) | **nicht geprüft** |

## 9. Manuelle Schritte vor Veröffentlichung

1. Betreiberangaben ergänzen und `legal-review.json` bestätigen; `npm run legal:check -- --strict` muss grün sein.
2. Backend deployen (neue Mutation `deleteMyParticipation`, Log-Retention, DLQ-Verschlüsselung) – kein automatischer Deploy durch diese Änderung.
3. SPA-Rewrite in der Amplify-Konsole prüfen (README „Hosting und Betrieb“).
4. `customHttp.yml`: AppSync-Wildcard in `connect-src` nach erstem Deployment durch den exakten Host ersetzen; HSTS-Entscheidung treffen (derzeit auskommentiert). Prüfen, dass Header auch für `/admin`, `/play/*`, `/present/*` ausgeliefert werden (inkl. `X-Robots-Tag`), und dass keine CSP-Verstöße in der Browserkonsole auftreten (Realtime/WebSocket).
5. Lösch-Button, Impressum und Datenschutzerklärung in der echten Umgebung durchspielen; Browser-Cookies und alle `Set-Cookie`-Antwortheader auf Hosting/CDN prüfen.
6. Nach Deployment die Access-/ID-Tokenlaufzeiten von 60 Minuten und Refresh-Tokenlaufzeit von 1 Tag im Cognito-Pool bestätigen; Logout, Token-Refresh und Tab-Synchronisation über mehrere Tabs verifizieren.
7. Rechtstexte einschließlich der Einordnung optionaler lokaler Entwürfe nach § 25 TDDDG sowie der DSGVO-Rechtsgrundlagen juristisch prüfen lassen.
