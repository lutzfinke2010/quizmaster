# QuizRush

QuizRush ist eine deutschsprachige Live-Quiz-Anwendung mit React, TypeScript, Vite und AWS Amplify Gen 2. Quizmaster verwalten Quizze und steuern Sitzungen; Gäste spielen ohne Konto auf ihrem Smartphone. Eine optionale Präsentationsansicht ist schreibgeschützt.

**Status:** Der Live-Ablauf und ausgewählte Autorisierungs- und Lastfälle wurden in einer isolierten AWS-Sandbox geprüft. Vor produktivem Einsatz müssen Deployment, Alarme, Sicherheit und Lastgrenzen in der jeweiligen Zielumgebung erneut überprüft werden.

## Voraussetzungen und Entwicklung

Benötigt werden Node.js `^22.12.0`, `^24.0.0` oder `>=26.0.0`, npm, AWS-Zugang mit passenden Berechtigungen und ein für CDK gebootstrapptes AWS-Konto. Standardregion ist `eu-central-1`. Ressourcen wie WAF, AppSync, DynamoDB, Lambda und Step Functions verursachen Kosten.

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Ohne `amplify_outputs.json` bietet die Anwendung ausschließlich einen ausdrücklich gekennzeichneten lokalen Entwurfsmodus. Dieser ist **kein geschützter Admin-Bereich**; Entwürfe bleiben im Browserspeicher und sind nicht geräteübergreifend verfügbar.

## Oberfläche und Bedienung

Die helle Oberfläche nutzt warme Hintergrundfarben, Petrol und spielerische Farbakzente. Navigation, Formulare und Quizansichten passen sich vom schmalen Smartphone bis zum Desktop an; Schriftarten und Grafiken werden ohne externe Dienste geladen.

Im Editor zeigen Auswahlkreis, Rahmen, Häkchen und Lösungstext die richtige Antwort. Die Fragenübersicht führt direkt zur jeweiligen Frage und zeigt die gewählten Lösungen auch nach dem Umsortieren. Im Live-Spiel wird eine Antwort direkt beim Auswählen gesendet und lässt sich danach nicht mehr ändern. „Wird gesendet …“ und „Antwort ist drin“ sind getrennte Zustände; die Bestätigung erscheint erst nach Serverannahme. Die eigene Antwort bleibt während der Auswertung und Auflösung markiert und wird nach Neuladen oder Wiederverbindung vom Server wiederhergestellt. Auch nach einer verlorenen Sendebestätigung wird zuerst die gespeicherte Antwort geprüft, bevor eine weitere Auswahl möglich ist.

Frage, Auflösung, Zwischenstand und Endstand sind getrennte Ansichten derselben serverseitigen Spielphasen. Die Startseite bleibt unverändert; die Spielkomponenten in `src/components/GameView.tsx` nutzen ihre Systemschriftfamilie (`Avenir Next`, Avenir, Segoe UI, sans-serif) und Farben. Es gibt keine heruntergeladenen Fonts oder zusätzlichen Font-CDNs. Ergänzende semantische Spiel-Tokens und responsive Layouts stehen in `src/components/game.css`. Mobil sind Frage und vollständige Antworten, persönliche Rückmeldung, tatsächlicher Punktgewinn und Gesamtpunkte ohne Beamer verfügbar. Ein bereits bekannter Rang wird während der nächsten Frage ausdrücklich als letzter Rang bezeichnet; vor der ersten Wertung wird kein Rang erfunden. Rangänderungen werden erst ab einem echten Vergleich nach der zweiten Frage angezeigt.

Die Präsentation enthält keine Adminnavigation. Sie zeigt Stimmenbalken bezogen auf **alle abgegebenen Antworten**, nicht auf die Teilnehmerzahl; Nichtantworten werden separat genannt. Zwischen- und Endstand zeigen ein Podest in der Anordnung 2–1–3 mit unveränderten Serverrängen (gleiche Ränge haben gleiche Podesthöhe) und höchstens fünf weiteren Zeilen. Mobil stehen die eigene Position und benachbarte Plätze im Mittelpunkt. Lobby-Vorschauen sind auf zwölf Avatare, mobil auf sechs begrenzt; die Gesamtzahl bleibt sichtbar. Beim Quizmaster gibt es nur den zum Serverzustand passenden nächsten regulären Schritt. Countdown, Fristende und Auswertung bleiben automatisch; vorzeitiges Schließen und bestätigter Abbruch sind nachrangige Aktionen.

Die bestehende Abfrage `getMyResult` liefert zusätzlich `totalPoints` aus dem eigenen serverseitigen Teilnehmerdatensatz, ausschließlich nach abgeschlossener Auswertung und mit erneuter Snapshot-Prüfung. Für diesen Frontendstand ist das passende Backend-Schema aus `amplify/data/resource.ts` erforderlich; ein reines Frontend-Update gegen das alte Schema reicht nicht.

Richtige Antworten werden nach der serverseitigen Auflösung mit einem kurzen, automatisch endenden Konfetti-Effekt gefeiert. Bei `prefers-reduced-motion: reduce` entfällt der Effekt; Häkchen, Ergebnismeldung und Punkte bleiben sichtbar. Tastaturfokus, ein Sprunglink zum Inhalt, beschriftete Formularfehler und Textmarkierungen ergänzen die Farben. Die Browserprüfungen in `e2e/design.spec.ts` decken unter anderem schmale Ansichten, Tastaturbedienung, Auswahlzustände und reduzierte Bewegung ab; sie ersetzen keine vollständige Prüfung mit assistiven Technologien.

`npx playwright test e2e/design.spec.ts` prüft die Spielansichten bei 320, 390, 430 und 1440 px sowie die Präsentation bei 1920 px. Die Tests verwenden kontrollierte API-Antworten und prüfen auch lange Texte, zwei/vier/sechs Antworten, Nullstände, Gleichstände, Reconnect, Ergebnisfehler und verlorene Bestätigungen. Abschluss-Screenshots landen unter `test-results/design-*/*.png`. Diese Browserprüfung und `src/server/gameState.test.ts` belegen keine echte AWS-Mehrgeräterunde; dafür ist weiterhin der unten beschriebene Live-Test mit einer ausdrücklich bereitgestellten isolierten Sandbox nötig.

Datenschutz ist dort eingebettet, wo Entscheidungen fallen, statt als Banner über jeder Seite: Vertrauens-Chips direkt unter den Startseiten-Aktionen („Ohne Konto · Ohne Klarnamen · Ohne E-Mail“) führen zu einem eigenen Abschnitt „Datenschutz ohne Kleingedrucktes“ auf der Startseite. Die Beitrittskarte zeigt einen kompakten Hinweis mit aufklappbaren Details, die Fußzeile bietet auf jeder Seite – auch während des Spiels – eine aufklappbare Kurzinformation, und die Kontoanlage weist auf die Speicherung der E-Mail-Adresse hin. Lokale Browserentwürfe und Live-Spiele werden dabei unterschieden. Gäste müssen keinen Namen und keine E-Mail-Adresse eingeben; das bedeutet ausdrücklich **nicht**, dass keine Daten gespeichert werden: technische Kennungen, automatisch vergebene Spielnamen, Avatare, Antworten, Antwortzeiten und Punkte werden für den Spielbetrieb verarbeitet und gespeichert. Für Quizmaster-Konten werden außerdem E-Mail-Adressen gespeichert. Die Hinweise sind eine Kurzinformation, keine vollständige betreiberspezifische Datenschutzerklärung.

## AWS-Sandbox und Administration

AWS-Profil und Region auswählen; Sandbox-Namen müssen weniger als 15 Zeichen lang sein:

```sh
AWS_PROFILE=<profil> AWS_REGION=eu-central-1 npx ampx sandbox --identifier <kurzer-name>
```

Die Sandbox erzeugt `amplify_outputs.json`. Für den Vite-Entwicklungsserver die Datei unter `public/amplify_outputs.json` bereitstellen. Sie enthält öffentliche Ressourcenkennungen, aber keine Admin-Passwörter; die Datei wird nicht eingecheckt. Nach Änderungen an den Ressourcen die aktualisierte Ausgabe erneut bereitstellen.

```sh
mkdir -p public
cp amplify_outputs.json public/amplify_outputs.json
npm run dev
```

### Konto über die App anlegen und freigeben

Unter `/admin` **Konto anlegen** wählen, E-Mail-Adresse und Passwort eingeben und die E-Mail-Adresse mit dem zugesandten sechsstelligen Code bestätigen. Bei unterbrochener Bestätigung auf der Anmeldeseite **E-Mail-Bestätigung fortsetzen** verwenden; dort lässt sich auch ein neuer Code anfordern.

Anschließend anmelden. Neue Konten sehen zunächst **Freigabe ausstehend** und können keine Quizze oder Sitzungen verwalten. Die bestätigte E-Mail-Adresse allein verleiht keine Rechte.

Die Administration öffnet in der AWS-Konsole **Cognito → Benutzerpools → den passenden Pool → Benutzer**, wählt das neue Konto und fügt es der Gruppe **`Quizmasters`** hinzu. Der passende Pool steht in `amplify_outputs.json` unter `auth.user_pool_id`. Es muss eine **Gruppenzugehörigkeit im User Pool** zugewiesen werden, keine IAM-Rolle von Hand.

Danach klickt der Nutzer in der App auf **Zugriff erneut prüfen**. Dabei werden die Anmeldungstokens erneuert und die Gruppe erneut geprüft. Bei Problemen ab- und wieder anmelden. Konten werden niemals automatisch der Gruppe zugeordnet, auch nicht das erste Konto.

Die Selbstregistrierung muss durch Deployment des aktuellen Backends freigeschaltet sein; ein reines Frontend-Update genügt nicht. Anschließend die aktuelle `amplify_outputs.json` bereitstellen. Öffentliche Cognito-Registrierung sowie Bestätigungs- und erneute Code-E-Mails unterliegen Cognito-/SES-Versandlimits, Quoten und gegebenenfalls Kosten. Für produktiven Versand Absender, Zustellbarkeit und AWS-Quoten prüfen. Die bestehende AppSync-WAF schützt nicht den separaten Cognito-Registrierungsendpunkt; dessen Missbrauchsschutz muss zum öffentlichen Betrieb passen.

### Alternative: administrativ angelegtes Konto

Mit ausreichenden Cognito-Berechtigungen lässt sich weiterhin ein Konto anlegen und der Gruppe zuordnen:

```sh
aws cognito-idp admin-create-user --region eu-central-1 --user-pool-id <user-pool-id> \
  --username <email> --user-attributes Name=email,Value=<email> Name=email_verified,Value=true
aws cognito-idp admin-add-user-to-group --region eu-central-1 --user-pool-id <user-pool-id> \
  --username <email> --group-name Quizmasters
```

Beim ersten Login eines so angelegten Kontos muss das temporäre Passwort geändert werden. Die Anmeldung erfolgt ebenfalls über `/admin`. Dort kann auch das enthaltene Beispielquiz mit zehn Fragen angelegt werden. Die Gruppe allein reicht nicht zum Zugriff auf fremde Daten: Serveroperationen prüfen zusätzlich den jeweiligen Eigentümer.

Beim Deployment ausgewertete Umgebungsvariablen:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `AWS_REGION` | `eu-central-1` | AWS-Region |
| `QUIZRUSH_MAX_PARTICIPANTS` | `100` | Atomar durchgesetzte Sitzungsgrenze; gültig 1–1000, Zielwert des MVP ist 100 |
| `QUIZRUSH_RETENTION_DAYS` | `7` | Aufbewahrung neuer Sitzungen; gültig 1–365 Tage |
| `QUIZRUSH_IP_RATE_LIMIT` | `10000` | WAF-Anfragen pro Quell-IP und 5 Minuten; an gemeinsam genutzte Netze anpassen |

Die Werte müssen bei jedem Backend-Deployment gesetzt werden, wenn sie vom Standard abweichen. Die WAF-Grenze ist eine zusätzliche grobe IP-Schranke; getrennt davon begrenzt das Backend Beitritts- und Antwortversuche je technischer Identität. Geteilte IP-Adressen können gemeinsam betroffen sein.

## Architektur und Zugriff

Eine DynamoDB-Tabelle verwendet `pk` und `sk` für Vorlagen, Sitzungsmetadaten, immutable Frage-Snapshots, Identitätszuordnungen, Antworten, Ergebnisse und Timeraufträge. Ein GSI auf 16 Timer-Shards unterstützt die Wiederaufnahme ausstehender Aufträge. Codes werden transaktional reserviert. Gäste können keine Tabellen direkt lesen oder schreiben.

Admin-Queries und -Mutationen verwenden Cognito User Pool und die Gruppe `Quizmasters`. Gast-Queries und -Mutationen verwenden IAM-Credentials des Cognito Identity Pools; auch angemeldete Identity-Pool-Identitäten können dieselben Mitgliedschaftsprüfungen durchlaufen. Die Cognito-Gruppenrolle erhält dafür explizite Rechte auf die benötigten Gastoperationen, aber kein Veröffentlichungsrecht. Alle Teilnehmer-IDs stammen aus der serverseitigen Bindung an die technische Identität. Eine zweite Browseridentität kann erneut teilnehmen; das MVP kann Mehrfachteilnahme nicht zuverlässig verhindern.

AppSync-Subscriptions werden bei Registrierung durch Lambda auf gültige Mitgliedschaft, Eigentümerschaft oder Präsentationstoken geprüft und serverseitig nach Sitzung gefiltert. Ein Stream-Consumer veröffentlicht nur Sitzungs-ID und Versionsnummer über eine IAM-geschützte Mutation. Beide Identity-Pool-Rollen und die Quizmaster-Gruppenrolle erhalten eine explizite IAM-Verweigerung für diese Mutation. Clients laden daraufhin die jeweils autorisierte Projektion. Bei Wiederverbindung wird erneut abonniert und ein Snapshot geladen; ältere Versionen werden ignoriert. Verbindungsfehler werden mit begrenztem Backoff erneut versucht.

Lösung, Erklärung und Verteilung liegen im privaten Snapshot und werden erst nach vollständiger Auswertung in eine separate Projektion übernommen. Die Präsentationsadresse enthält einen zufälligen Token; gemeinsam genutzte Datensätze speichern nur dessen Hash. Der Eigentümer benötigt eine private Kopie zum Wiederöffnen. Die Anwendung setzt `Referrer-Policy: no-referrer` und lädt keine externen Tracker, Schriftarten oder Avatarbilder.

## Fristen und Auswertung

Eine Transaktion legt Countdown und dauerhaften Timerauftrag gemeinsam an. DynamoDB Streams starten einen Step-Functions-Standard-Workflow; ein minütlicher Sweep nimmt liegengebliebene Aufträge wieder auf. Step Functions rundet Wartezeitpunkte auf Sekunden ab, deshalb werden Öffnung und Deadline für den Wait-Zustand auf die nächste Sekunde aufgerundet. Ein verspäteter Workflow verlängert die Antwortfrist nicht.

`serverReceivedAt` wird beim Eintritt in den AppSync-Lambda-Handler gesetzt. Die Übertragung bis zu diesem Punkt einschließlich Netzwerk und AppSync zählt zur Antwortzeit; exakte Messung am Gerät wird nicht versprochen. Die Transaktion akzeptiert nur `opensAt <= serverReceivedAt < closesAt`, prüft Mitgliedschaft, Antwortoption und offenen Zustand und speichert Antwort sowie Zähler gemeinsam. Gleiche Wiederholungen sind idempotent.

Die Auswertung schließt zuerst atomar, liest danach konsistent und schreibt pro Person Ergebnis und Punkte idempotent. Nach vollständiger Auswertung erscheint die Auflösung; erst nach Freigabe durch den Quizmaster wechselt die Oberfläche zum Zwischenstand. Die bestehende Präsentationsprojektion kann bereits in der Auflösung Top-5-Daten enthalten, diese werden dort nicht mehr zusätzlich unter die Frage gerendert. Korrekte Antworten erhalten `500 + round(500 * (1 - elapsedMs / durationMs))` Punkte, falsche und fehlende Antworten null. Sortiert wird nach Punkten, Anzahl richtiger Antworten und deren gesamter Antwortzeit; identische Werte erhalten denselben Wettbewerbsrang.

## Hosting und Betrieb

In Amplify Hosting das Repository mit Gen-2-Backend verbinden und den Backend-Build mit den gewünschten Umgebungsvariablen konfigurieren. Die versionierte `amplify.yml` deployt das Backend und kopiert dessen erzeugte `amplify_outputs.json` vor dem Frontend-Build nach `public/amplify_outputs.json`. Das Build-Artefakt ist `dist`; der Build schlägt fehl, falls die Ausgabe fehlt.

Für React Router in Amplify Hosting unter **Rewrites and redirects** eine Rewrite-Regel mit Status **200 (Rewrite)** auf `/index.html` einrichten. Als Quelle eignet sich `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`; vorhandene Dateien wie `/amplify_outputs.json` müssen direkt ausgeliefert werden. Nach dem Deployment prüfen, dass `/admin` mit Status 200 die App und `/amplify_outputs.json` JSON mit den Kennungen des passenden Backend-Deployments liefert.

Die Definition benötigt unter anderem CloudFormation-, CDK-Bootstrap-, IAM-, Cognito-, AppSync-, WAFv2-, DynamoDB-, Lambda-, SQS-, EventBridge-, Step-Functions- und CloudWatch-Berechtigungen. IAM-Rollen und Policies werden durch CDK erstellt. Die Tabelle ist mit `RETAIN` definiert, dennoch kann `ampx sandbox delete` Sandbox-Ressourcen einschließlich dieser Tabelle löschen (so auch in der geprüften Sandbox). Vor jeder Löschung Daten sichern und den tatsächlichen Ressourcenstatus prüfen; gegebenenfalls erhaltene Tabellen nach Identitäts- und Inhaltsprüfung separat entfernen.

Sitzungsdaten, Codes, Teilnahmen, Antworten, Ergebnisse und Timeraufträge erhalten DynamoDB-TTL; die Bereinigung erfolgt asynchron. Der Zugriff endet bereits zum gespeicherten Ablaufzeitpunkt, nicht erst beim physischen TTL-Löschen. Quizvorlagen bleiben bis zur aktiven Löschung erhalten. CloudWatch-Alarme überwachen Workflowfehler, Sweep-Fehler und die gemeinsame Dead-Letter-Queue der Stream-Consumer; Alarmaktionen/Benachrichtigungsziele sind separat einzurichten. Bei Fehlern Logs und Queue prüfen; der Timer-Sweep versucht ausstehende Timer erneut und verarbeitet andere Aufträge auch bei einzelnen Fehlern weiter. Er läuft maximal 50 Sekunden pro Minute und ist kein Nachweis für eine beliebig große Zahl gleichzeitig laufender Sitzungen; bei dauerhaftem Rückstau Kapazität, Fehlermeldungen und AWS-Limits prüfen. Nicht zugestellte Echtzeitereignisse nach Wiederherstellung durch erneutes Abonnieren und Laden des Snapshots ausgleichen; es gibt keinen automatischen Replay-Worker für die Publisher-DLQ.

## Integrationsprüfungen

Die folgenden Tests erstellen isolierte Testdaten und benötigen passende AWS-Rechte. Sie können Kosten verursachen. Die DynamoDB-Tests legen eigene Tabellen an und löschen diese nach dem Test:

```sh
AWS_PROFILE=<profil> AWS_REGION=eu-central-1 npm run test:aws
AWS_PROFILE=<profil> AWS_REGION=eu-central-1 QUIZRUSH_LOAD_TEST=1 npx vitest run src/server/load.aws.test.ts
```

Für den browserbasierten Live-Test eine eigens dafür eingerichtete Sandbox-Ausgabe angeben. Die Tests erstellen und löschen temporäre Cognito-Benutzer und legen Spieltestdaten in der Sandbox an; bereits vorhandene `public/amplify_outputs.json` wird absichtlich nicht überschrieben. Der Registrierungstest nutzt die öffentliche Kontoanlage, bestätigt das Testkonto anschließend über `AdminConfirmSignUp` und prüft die manuelle Gruppenfreigabe samt Token-Aktualisierung. Er benötigt entsprechende Test-Adminrechte und prüft **keine echte E-Mail-Zustellung**. Bestätigungscode-Eingabe und Fehlerfälle sind separat mit kontrollierten Browserantworten abgedeckt; der Empfang einer echten Bestätigungs-E-Mail muss mit einem eigenen Testpostfach geprüft werden.

```sh
AWS_PROFILE=<profil> AWS_REGION=eu-central-1 QUIZRUSH_LIVE_OUTPUTS=<absoluter-pfad-zu-amplify_outputs.json> \
  npx playwright test e2e/live.spec.ts --workers=1
AWS_PROFILE=<profil> AWS_REGION=eu-central-1 QUIZRUSH_LIVE_OUTPUTS=<absoluter-pfad-zu-amplify_outputs.json> \
  QUIZRUSH_APPSYNC_LOAD_TEST=1 npx vitest run src/server/appsyncLoad.aws.test.ts
```

Der AppSync-Lasttest prüft in einer Sitzung 100 Gastidentitäten, gleichzeitige Beitritte und Antworten sowie 100 gleichzeitig angemeldete WebSocket-Abonnements, die alle mindestens die letzte Antwortversion empfangen. Er simuliert nicht 100 vollständige Browser mit Snapshot-Abfragen bei jedem Ereignis und hinterlässt Spieltestdaten in der angegebenen Sandbox; diese ist ausschließlich für Tests zu verwenden und danach einschließlich gegebenenfalls erhaltener Testtabellen zu bereinigen. Testergebnisse gelten nur für die konkret geprüfte Konfiguration und sind keine Zusage unbegrenzter Skalierbarkeit.

Die `shadcn/ui`-Buttonkomponente wird unter MIT-Lizenz verwendet (siehe `LICENSES/shadcn-ui.txt`). Sicherheitsupdates für die indirekten Entwicklungsabhängigkeiten Handlebars, Immutable und Lodash sind per `overrides` festgelegt. Beim letzten Audit meldete `npm audit --omit=dev` keine Advisories, der vollständige Audit aber noch 48 betroffene Entwicklungsabhängigkeiten (37 hoch, 11 mittel; keine kritisch). Die verbleibenden Grundursachen betreffen `@graphql-tools/utils`, `zod`, `glob`, `minimatch` und im Lockfile verzeichnete OpenTelemetry-Versionen in Amplify/CDK; teils sind sie fest gebündelt oder nur mit nicht kompatiblen Hauptversionswechseln aktualisierbar. Vor einem Deployment `npm audit` und Upstream-Fixes erneut prüfen; keine ungeprüften `--force`-Upgrades verwenden.
