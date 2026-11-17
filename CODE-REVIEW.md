# Code-Review RateLama / QuizRush

**Datum:** 17.11.2026  
**Umfang:** gesamtes Repository (`amplify/`, `src/server/`, `src/domain/`, `src/` Frontend, Konfiguration, Build/Deploy)  
**Art:** statisches Review, keine Codeänderungen

## 1. Zusammenfassung

Die Codebasis ist insgesamt solide: Eingaben werden durchgängig mit zod validiert, Besitzprüfungen liegen in
DynamoDB-Conditions (atomar), Mutationen sind weitgehend idempotent, Daten werden über TTL automatisch gelöscht, und
der Servercode ist gut getestet. Typecheck und Unit-Tests laufen fehlerfrei.

Die wichtigsten Risiken liegen in **Skalierung unter Last** (Versionszähler je Antwort → Event-Sturm und
Konflikte beim Lesen des Spielstands) und **Missbrauchsschutz für Gäste** (Rate-Limits pro frei erzeugbarer
Cognito-Identity, keine Obergrenze für die Laufzeit veröffentlichter Quizze).

| Schweregrad | Anzahl |
|---|---|
| Hoch | 1 |
| Mittel | 7 |
| Niedrig | 18 |
| Info | 9 |

### Prüfstatus

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | ✅ ohne Fehler |
| `npx vitest run` | ✅ 18 Dateien / 98 Tests bestanden, 4 Dateien / 13 Tests übersprungen (AWS-Integrationstests) |
| `npm run legal:check` | ⚠️ 8 offene Betreiber-Bestätigungen (Entwurfsmodus, Build wird nicht blockiert) |
| `npm audit` | nicht ausführbar (Artifactory-Registry verlangt Authentifizierung) |
| E2E (Playwright) | nicht ausgeführt |

## 2. Findings

### 2.1 Performance und Skalierung

| ID | Schwere | Ort | Befund | Empfehlung |
|---|---|---|---|---|
| P1 | **Hoch** | `src/server/submitAnswer.ts` (`ADD #version`), `src/server/participation.ts` (Join), `amplify/functions/events/*`, `src/server/gameState.ts` Z. ~88-162 und ~240-254, `src/CloudApp.tsx` `useLiveState` | Jede Antwort und jeder Join erhöht die META-Version. Der Stream-Publisher sendet daraufhin ein Event an alle Clients, die nach 250 ms Debounce `getGameState` neu laden. Bei N Spielern ergibt das O(N²) Lesezugriffe pro Frage. `renderGameState`/`getMyAnswer` brechen nach 4 Versuchen ab, wenn sich die Version zwischenzeitlich ändert. Unter Last ist das häufig („gleichzeitig geändert“). In der LOBBY lädt jeder Refresh alle Teilnehmenden. | Antwortzähler vom Spielstand-Versionszähler trennen (separates Item oder nur bei Phasenwechsel `#version` erhöhen). Events für Antworten bündeln/drosseln. Konsistentes Lesen ohne Abbruch, z. B. per Snapshot oder Toleranz gegenüber reinen Zählerständen. Lasttest mit 200–1000 Clients. |
| P2 | Mittel | `src/server/participation.ts` (`joinSession`), `src/server/asyncQuiz.ts` (`startAsyncQuiz`) | Join bis zu 1000 Versuche, jeweils mit vollständiger Query über `PARTICIPANT#`/`AVATAR#`. Ohne Avatar-Reservierung gilt die Bedingung `#version = :version`, daher kommt es bei gleichzeitigen Joins zu vielen Konflikten. Ein Lambda-Timeout (120 s) ist möglich. Async-Start analog mit bis zu 100 Versuchen und Scan aller Attempts. | Avatar-/Namensvergabe ohne globale Versionsbedingung (z. B. zufälliger Kandidat + `attribute_not_exists` auf `AVATAR#`/`NAME#`). Teilnehmerzähler per `ADD` mit Bedingung `< max`. Versuche begrenzen und Backoff mit Jitter einführen. |
| P3 | Mittel | `src/server/startQuestion.ts` Z. ~72 | Bedingung `participantCount = :participantCount`. Wenn jemand zwischen Lesen und Start beitritt oder sich löscht, scheitert der Start mit ConditionalCheckFailed, ohne Retry und ohne verständliche Meldung. | Automatisch neu lesen und erneut versuchen, oder die Bedingung entfernen und Teilnehmende über einen Snapshot zum Startzeitpunkt bestimmen. Verständliche Fehlermeldung. |
| P4 | Mittel | `src/server/quizStore.ts` (`listQuizzes`) | Liefert alle Quizze vollständig (je bis ~350 KB) ohne Pagination → Lambda-Response-Limit 6 MB bzw. AppSync-Limits erreichbar. Die Übersicht braucht nur Titel/Beschreibung/Fragenanzahl. | Listenendpunkt mit Projektion (Metadaten) und Pagination. Vollständiges Quiz nur in `getQuiz`. |
| P5 | Mittel | `src/server/asyncQuiz.ts` (`getAsyncPublicationResults`, `listAsyncPublications`), `src/server/listSessions.ts` | Ergebnisse: Jede Seite lädt alle Attempts und Antworten (bis 1000 × 100), `summaries()` lädt die Attempts zusätzlich erneut. `listAsyncPublications`: N+1-Abfragen plus Attempt-Scan je Publikation, eventuell mit Schreibzugriffen (Retention-Verkürzung) innerhalb eines Lesevorgangs. `listSessions`: N+1 `GetCommand`, wirft bei fehlender META (TTL-Löschreihenfolge), statt den Eintrag zu überspringen. | Aggregierte Zähler am META-Item pflegen. Ergebnisse einmal berechnen und cachen. `BatchGet` statt N+1 verwenden. Fehlende META überspringen. Schreibvorgänge aus Lesepfaden herausnehmen. |
| P6 | Niedrig | `src/server/finalizeQuestion.ts` | Ergebnisse werden je Antwort sequenziell per TransactWrite geschrieben. Bei ~1000 Teilnehmenden nahe am Lambda-Timeout. | Parallelisieren (begrenzte Concurrency) oder `BatchWrite` für idempotente RESULT-Items. |
| P7 | Niedrig | `amplify/functions/timer/*` (Sweep) | Der Sweep ruft jede Minute für jeden laufenden Timer `StartExecution` und `DescribeExecution` auf. | Nur überfällige Timer prüfen (z. B. `dueAt < now - Puffer`). |
| P8 | Niedrig | `src/CloudApp.tsx` `AdminSession` | Lädt `cloud.listSessions()` (N+1 serverseitig), um eine einzelne Session zu finden. | Eigenen `getSession`-Endpunkt nutzen. |

### 2.2 Sicherheit und Missbrauch

| ID | Schwere | Ort | Befund | Empfehlung |
|---|---|---|---|---|
| S1 | Mittel | `src/server/rateLimit.ts`, `amplify/functions/api/handler.ts`, `amplify/backend.ts` Z. ~75 (WAF) | Rate-Limits (join 20/min, answer 30/min) gelten pro Cognito-Identity. Unauthentifizierte Identity-Pool-IDs sind beliebig neu erzeugbar, die Limits also umgehbar. Das WAF-IP-Limit liegt standardmäßig bei 10 000 / 5 min und ist damit sehr hoch. `getAsyncPublicInfo`, `getMyAsyncState`, `getGameState`, `getPresentationState` haben kein Rate-Limit. | WAF-Limit deutlich senken (z. B. 1000–2000 / 5 min). Zusätzliche WAF-Regeln für den Cognito-Identity-Endpunkt (`GetId`). Rate-Limits auch auf Lesepfade anwenden. Gegebenenfalls pro Session/Publikation limitieren. |
| S2 | Mittel | `src/server/asyncQuiz.ts` (`startedCount`/`maxParticipants`), `src/server/participation.ts` | Die Teilnehmergrenze kann mit vielen Identitäten ausgeschöpft werden (DoS gegen ein veröffentlichtes Quiz oder eine Live-Lobby). Eine Person kann mit neuer Identity mehrfach teilnehmen. | Risiko dokumentieren. Optional Quizmaster-Funktion „Teilnehmende entfernen“/„Lobby sperren“. Strengere Limits pro IP über WAF. |
| S3 | Mittel | `src/server/asyncQuiz.ts` (`publishAsyncQuiz`) | Keine Obergrenze für `expiresAt`. Damit liegen `retentionAt`/TTL beliebig weit in der Zukunft, im Widerspruch zu den Aufbewahrungsangaben in der Datenschutzerklärung. | Maximale Laufzeit serverseitig erzwingen (z. B. 30–90 Tage) und im UI anzeigen. |
| S4 | Niedrig | `src/server/createSession.ts` Z. ~62, `src/server/asyncQuiz.ts` | Presentation- und Async-Token werden zusätzlich im Klartext gespeichert (`OWNER#…/SESSIONTOKEN#`, Owner-Index, Idempotency-Item), obwohl der Lookup über einen Hash läuft. Bei einem DB-Leak schützt das Hashing daher kaum. | Entweder bewusst so dokumentieren (der Admin muss den Link erneut anzeigen können) oder Token verschlüsselt (KMS) speichern. |
| S5 | Niedrig | `amplify/backend.ts` Z. ~21-28 | Der Entzug der Gruppe „Quizmasters“ greift erst nach Ablauf des ID/Access-Tokens (60 min). Refresh-Token gilt 1 Tag. | Bewusst dokumentieren. Bei Bedarf `AdminUserGlobalSignOut` beim Entzug ausführen. |
| S6 | Niedrig | `amplify/auth/resource.ts`, `amplify/backend.ts` | Selbstregistrierung offen. Der Cognito-User-Pool-Endpunkt ist nicht durch WAF geschützt, dadurch ist Missbrauch über Kosten bzw. E-Mail-Versand möglich (im README erwähnt). | WAF auf den User Pool anwenden, Registrierung einschränken oder Pre-Sign-up-Trigger einsetzen. |
| S7 | Niedrig | `customHttp.yml`, `public/robots.txt` | `noindex` für `/q/<token>` (Async-Teilnahmelinks) wird nur clientseitig per `useNoIndex` gesetzt. `X-Robots-Tag` und `robots.txt` decken `/q/` nicht ab, ebenso wenig `/join`. HSTS ist auskommentiert. | `/q/**` in `X-Robots-Tag` und `robots.txt` ergänzen. HSTS nach Festlegung der Domain aktivieren. |
| S8 | Info | `amplify/functions/api/handler.ts`, `amplify/backend.ts`, `amplify/data/resource.ts` | `publishGameEvent` ist dreifach geschützt: `allow.guest()`, explizite IAM-Deny-Policy und Handler-Check (`userArn` ohne `cognitoIdentityId`). Das funktioniert, ist aber fragil gegenüber Änderungen am Schema. | Kommentar im Schema und Regressionstest ergänzen, der einen Gast-Aufruf ablehnt. |
| S9 | Info | z. B. `closeQuestion` (`z.object({timerId}).parse(response.Item)`) | Rohe zod-/SDK-Fehlermeldungen gelangen bis zum Client (interne Struktur sichtbar, schlechte UX). | Zentrales Error-Mapping im Handler: bekannte Fehler übersetzen, unbekannte generisch melden und intern loggen. |
| S10 | Info | `src/config/legal.ts` | Enthält echte Anschrift und E-Mail. Für das Impressum notwendig, kein Fehler. Hinweis: Diese Daten sind im öffentlichen Repo dauerhaft sichtbar. | Gegebenenfalls Repository privat halten oder Werte zur Build-Zeit injizieren. |

### 2.3 Korrektheit und Logik

| ID | Schwere | Ort | Befund | Empfehlung |
|---|---|---|---|---|
| K1 | Niedrig | `src/server/participation.ts` (`deleteMyParticipation`) | Löschen in der LOBBY entfernt die `AVATAR#`-Reservierung nicht, der Avatar bleibt belegt. Beim Löschen in REVEAL wird RESULT entfernt, die Antwortverteilung (`REVEAL#`) zählt die Antwort aber weiter. | `AVATAR#` in derselben Transaktion löschen. Die Abweichung der Verteilung dokumentieren oder die Verteilung korrigieren. |
| K2 | Niedrig | `amplify/functions/api/handler.ts` | `deleteMyParticipation` nutzt den Rate-Limit-Bucket „join“, verbraucht also Join-Kontingent. | Eigenen Bucket verwenden. |
| K3 | Niedrig | `amplify/functions/api/handler.ts` (`closeQuestion`) | `finalizeQuestion` läuft synchron nach dem persistierten Close. Scheitert sie, sieht der Client einen Fehler, obwohl das Schließen erfolgreich war (Timer/Sweep holen es nach). | Fehler von `finalizeQuestion` hier loggen statt weiterwerfen, oder dem Client einen Teilerfolg melden. |
| K4 | Niedrig | `amplify/backend.ts` (DLQ `FailedTimerEvents`, Alarm „TimerDispatchFailures“) | Die DLQ wird von Timer-Dispatch und Event-Publisher gemeinsam genutzt, der Alarmname ist daher irreführend. Stream-Startposition `TRIM_HORIZON` verarbeitet beim ersten Deploy alte Records. | Getrennte DLQs/Alarme oder neutrale Benennung. Startposition `LATEST` für den Publisher erwägen. |
| K5 | Niedrig | `src/server/asyncQuiz.ts` | Ranking-Tiebreak nach `displayName`. `durationSeconds` der Fragen wird im Async-Modus ignoriert. | Fachlich bestätigen und im UI/README dokumentieren. |
| K6 | Niedrig | `src/CloudApp.tsx` `AsyncAdminResultsPage.loadMore` | Deduplizierung über `displayName#startedAt` kann bei Kollisionen Teilnehmende verwerfen. Ränge aus verschiedenen Seiten können bei zwischenzeitlichen Änderungen inkonsistent sein. | Eine stabile ID (z. B. Attempt-Hash) als Schlüssel liefern. Gesamtergebnis mit Snapshot-Zeitpunkt paginieren. |
| K7 | Niedrig | `src/CloudApp.tsx` `PublishAsyncPage` | Der Kopier-Button nutzt `navigator.clipboard.writeText` ohne Verfügbarkeitsprüfung. Der Fallback greift zwar über `catch`, das Verhalten ist aber uneinheitlich zu `AsyncPublicationCard`. `useEffect` hängt nur indirekt von `instants` ab. | Gemeinsame Copy-Komponente verwenden. |
| K8 | Info | `src/domain/session.ts` (`transition`, `canAcceptAnswer`) | Der Domain-Zustandsautomat wird nur in `session.test.ts` verwendet. Der Server bildet die Regeln separat in DynamoDB-Conditions ab, daher besteht Drift-Risiko. | Domain-Modell im Server nutzen (Conditions daraus ableiten) oder entfernen. |
| K9 | Info | `src/server/startQuestion.ts` Z. ~28-29 | Veralteter Kommentar („timer outbox needs a durable worker … before production“). Dispatch und Sweep existieren inzwischen. | Kommentar aktualisieren. |
| K10 | Info | `amplify/functions/api/handler.ts` (`startAsyncQuiz`), `src/AdminAuth.tsx` Z. ~40 | Uneinheitliche Nutzung von `now` und `Date.now()` innerhalb eines Requests. Falsche Einrückung in AdminAuth. | Einen Zeitstempel pro Request verwenden. Formatter/Linter einführen. |

### 2.4 Wartbarkeit, Betrieb und Hygiene

| ID | Schwere | Ort | Befund | Empfehlung |
|---|---|---|---|---|
| W1 | Niedrig | `src/CloudApp.tsx` (873 Zeilen) | Monolith mit 12 Komponenten und eigenem Live-State-Hook. Sehr dichte Einzeiler-JSX erschweren Reviews. Komponenten-/Hook-Tests fehlen. | In `pages/` und `hooks/useLiveState.ts` aufteilen. Prettier/ESLint einführen. Hook-Tests mit fake Timern ergänzen. |
| W2 | Niedrig | Repository | Kein Linter/Formatter konfiguriert (kein ESLint/Prettier im `package.json`). | ESLint (inkl. `react-hooks/exhaustive-deps`) und Prettier ergänzen und in die CI aufnehmen. |
| W3 | Niedrig | `amplify.yml`, `config/` | `legal:check` läuft im Build nur im Entwurfsmodus. Aktuell sind 8 Betreiber-Bestätigungen offen (u. a. AWS-AVV, Security-Header, Log-Retention, PITR, rechtliche Prüfung). Der Build schlägt trotzdem nicht fehl. | Für den Produktiv-Branch einen strikten Modus erzwingen. Offene Punkte vor dem Go-live abarbeiten. |
| W4 | Niedrig | CI | Im Build werden weder Tests noch Typecheck separat ausgeführt (nur `tsc -b` über `build`). Keine CI-Pipeline für PRs sichtbar. | GitHub Actions o. Ä. mit `typecheck`, `test`, gegebenenfalls `test:e2e`. |
| W5 | Info | `.gitignore` | `.DS_Store` und `.idea/` fehlen. In `spec/ratelama-mitspieler-icons/assets` liegen zwei untracked `.DS_Store`. | `.gitignore` ergänzen. |
| W6 | Info | `package.json` | Sehr neue Major-Versionen (TypeScript 7, Vite 8, Vitest 5, zod 4). Kompatibilität mit Amplify-Tooling beobachten. `npm audit` konnte wegen der Registry-Authentifizierung nicht laufen. | Abhängigkeiten per Dependabot/Renovate pflegen. Audit gegen die öffentliche Registry ausführen. |
| W7 | Info | `src/server/*` | Logging nur punktuell (`console.error` in `participation.ts`). Kein strukturiertes Logging, keine Korrelation-IDs. | AWS Lambda Powertools (Logger/Metrics) einsetzen. Metriken für Konflikt-Retries (P1/P2) erfassen. |

## 3. Positive Aspekte

- Konsequente Eingabevalidierung mit zod im Server und Domain-Modell.
- Autorisierung atomar in DynamoDB-Conditions (Owner-Checks), keine Read-then-Write-Lücken bei Besitzprüfungen.
- Idempotenz für Timer-Ausführungen und Async-Veröffentlichung (Request-ID), Transaktions-Retry für `TransactionConflict`.
- Datensparsamkeit: TTL-basierte Löschung, Ablauf der Gast-Identität (24 h, bei Async verlängert), Selbstlöschung der Teilnahme.
- Durchdachte Timer-Architektur (Step Functions + Stream-Dispatch + Sweep als Fallback, DLQ und Alarm).
- Restriktive CSP, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`, Permissions-Policy.
- Robustes Client-Verhalten: Serverzeit-Offset, Reconnect mit Backoff, Wiederherstellung unbestätigter Antworten, Barrierefreiheit (`role="status"`, `aria-*`).
- Gute Unit-Testabdeckung der Serverlogik inklusive optionaler AWS-Integrationstests.

## 4. Priorisierte Empfehlungen

1. **P1** beheben (Versionszähler/Events entkoppeln) und einen Lasttest durchführen. Das ist das größte Risiko für Live-Runden mit vielen Teilnehmenden.
2. **S1/S2/S6**: WAF-Limits senken, Cognito-Endpunkte schützen, Lesepfade limitieren.
3. **S3**: maximale Laufzeit für Async-Quizze erzwingen (Datenschutz-Konsistenz).
4. **P2/P3/P4/P5**: Konfliktanfällige Joins und Starts sowie unpaginierte bzw. N+1-Listen überarbeiten.
5. **W2/W4/W3**: Linter, CI und strikten Legal-Check für Produktion einführen.
6. Restliche Niedrig-/Info-Punkte im Rahmen regulärer Wartung erledigen.

## 5. Umsetzungsstand

Alle Befunde sind bearbeitet. Wo eine Empfehlung bewusst nur dokumentiert wird, steht das in der Spalte „Umsetzung“.

| ID | Umsetzung |
|---|---|
| P1 | `#version` nur bei Phasenwechseln; Publisher bündelt je Batch/Sitzung und sendet Zähler; Client patcht Zähler lokal (`src/hooks/useLiveState.ts`, `liveEvents.ts`). Lasttest mit 200–1000 Clients steht noch aus (`load.aws.test.ts`). |
| P2 | Avatar-/Namensvergabe per `attribute_not_exists` auf Slots, Zähler per `ADD` mit `< max`, 20 Versuche mit Backoff + Jitter; Async-Start analog. |
| P3 | Bedingung auf `participantCount` entfernt. |
| P4 | `listQuizzes` mit Projektion (Titel, Beschreibung, Fragenanzahl) und Cursor-Pagination. |
| P5 | Aggregierte Zähler an Async-Attempts/META, `BatchGet` in `listSessions`, fehlende META wird übersprungen, keine Schreibzugriffe in Lesepfaden. |
| P6 | Ergebnisse parallel (Concurrency 25). |
| P7 | Sweep prüft nur nicht übergebene oder > 2 min überfällige Timer. |
| P8 | Neuer Endpunkt `getSession`. |
| S1 | WAF-Standard 2000/5 min, Rate-Limit für Lesepfade; Identity-Pool kann technisch keine WAF erhalten (README). |
| S2 | Risiko im README dokumentiert. |
| S3 | Maximal 90 Tage, serverseitig erzwungen und im UI angezeigt. |
| S4 | Bewusst dokumentiert (README, „Bekannte Restrisiken“). |
| S5 | Dokumentiert inkl. `admin-user-global-sign-out`. |
| S6 | Eigene WAF am User Pool (`QUIZRUSH_AUTH_RATE_LIMIT`, Standard 300). |
| S7 | `X-Robots-Tag`/`robots.txt` für `/q/` und `/join`; HSTS bleibt bis zur Domainfestlegung aus. |
| S8 | Schema-Kommentar und Regressionstests (`apiHandler.test.ts`). |
| S9 | Zentrales Mapping `src/server/clientError.ts`, unbekannte Fehler werden geloggt. |
| S10 | Im README vermerkt; Entscheidung über Repo-Sichtbarkeit beim Betreiber. |
| K1 | Avatar-Slot wird beim Löschen freigegeben; REVEAL-Abweichung dokumentiert. |
| K2 | Eigener Bucket `delete`. |
| K3 | Finalize-Fehler nach Close werden geloggt, nicht geworfen. |
| K4 | Getrennte DLQs/Alarme, Publisher startet bei `LATEST`. |
| K5 | In UI und README dokumentiert; Tiebreak zusätzlich stabil über `attemptId`. |
| K6 | Dedupe über `attemptId`; bei Änderung zwischen Seiten Hinweis „Neu laden“. |
| K7 | Gemeinsame Copy-Komponente `src/components/CopyLink.tsx`; `instants` per `useMemo`. |
| K8 | `startQuestion` nutzt `transition()` aus dem Domain-Modell; Conditions bleiben die atomare Absicherung. |
| K9 | Kommentar aktualisiert. |
| K10 | Ein `now` pro Request; Einrückung korrigiert. |
| W1 | `useLiveState` ausgelagert und getestet; weitere Aufteilung von `CloudApp.tsx` optional. |
| W2 | oxlint (inkl. `react-hooks`), da `typescript-eslint` TypeScript 7 noch nicht unterstützt; kein Prettier, um ein Massen-Reformat zu vermeiden. |
| W3 | `legal:check --strict` auf `QUIZRUSH_PRODUCTION_BRANCH` (Standard `main`). |
| W4 | `.github/workflows/ci.yml`. |
| W5 | `.gitignore` ergänzt, `.DS_Store` entfernt. |
| W6 | `.github/dependabot.yml`; `npm audit --omit=dev` (öffentliche Registry): 0 Befunde. |
| W7 | Strukturierter JSON-Logger mit Request-ID (`src/server/logger.ts`), Konflikt-Retries werden geloggt. |
