# Implementierungsauftrag: Live-Quiz-App „QuizRush“

Du bist Senior Full-Stack Engineer. Entwickle eine deploybare Live-Quiz-Web-App mit AWS Amplify Gen 2 und DynamoDB. Liefere lauffähigen Code, Tests und nachvollziehbare Einrichtungs- und Betriebsdokumentation – nicht nur ein Konzept oder einen UI-Prototyp.

## 1. Produktziel und Umfang

Ein Quizmaster erstellt Quizze und steuert gemeinsame Live-Runden. Teilnehmende treten auf ihrem Smartphone per QR-Code oder sechsstelliger Eingabe bei, benötigen kein Konto und beantworten zeitbegrenzte Fragen. Die App muss vollständig ohne Beamer oder Präsentationsansicht spielbar sein. Eine optionale, nur lesende Präsentationsansicht ergänzt das Erlebnis für Beamer und große Bildschirme.

Der MVP umfasst Quizverwaltung, eine vollständige Live-Runde mit mehreren Fragen, serverseitige Antwortannahme und Auswertung, Zwischen- und Endranglisten, Realtime-Updates sowie die optionale Präsentationsansicht. Der Zielwert beträgt bis zu 100 gleichzeitige Teilnehmende je Sitzung. Keine unbegrenzte Skalierung behaupten.

Alle sichtbaren Texte sind auf Deutsch; Code, Typen und Bezeichner sind auf Englisch. Verwende keine externen Bezahldienste oder zusätzlichen Anwendungsserver. Avatare werden lokal als lizenzrechtlich geeignete SVGs oder eigene SVG-Kompositionen bereitgestellt; keine Laufzeit-Bilderzeugung.

## 2. Arbeitsweise und technische Leitplanken

1. Prüfe Repository, vorhandene Anweisungen und bestehende Architektur. Integriere dich in die Struktur; lege nur bei einem leeren Repository ein Grundgerüst an.
2. Erstelle einen knappen, umsetzbaren Plan und arbeite in kleinen, ausführbaren Schritten. Triff gewöhnliche Detailentscheidungen selbst und dokumentiere sie. Frage nur bei echten Blockern nach.
3. Prüfe offizielle, aktuelle Dokumentation und Paketkompatibilität, bevor du AWS- oder Bibliotheks-APIs verwendest. Nutze Amplify Gen 2, keine Gen-1-Anleitungen.
4. Die unten beschriebenen Sicherheits- und Produktinvarianten sind verbindlich. Wo ein konkreter AWS-Mechanismus nur als Beispiel genannt ist, darfst du eine gleichwertige Lösung wählen; dokumentiere die Entscheidung und weise ihre Wirksamkeit durch Tests oder nachvollziehbare Konfiguration nach.
5. Behaupte keine Tests, Sandbox-Prüfungen oder Deployments, die nicht tatsächlich ausgeführt wurden. Nenne fehlende AWS-Zugangsdaten, Berechtigungen oder Ressourcen als offene Voraussetzungen.

Technologie:

- React, TypeScript im Strict-Modus und Vite.
- Tailwind CSS, shadcn/ui, Lucide-Icons, Motion und React Router.
- React Hook Form und Zod für Formulare; dieselben fachlichen Regeln zusätzlich serverseitig validieren.
- AWS Amplify Gen 2, Amplify Data/AppSync, DynamoDB und Lambda für Backend-Logik; Infrastruktur als TypeScript-Code.
- Cognito User Pool für Quizmaster und Cognito Identity Pool mit unauthentifiziertem Gastzugriff für Teilnehmende. Gäste benötigen weder Registrierung noch Login-Dialog; die technische Gastidentität bleibt im Hintergrund.
- Serverseitige Fristverarbeitung mit Step Functions Standard und Wait-Zustand oder einem dokumentierten, gleichwertig verlässlichen AWS-Mechanismus. Zusätzliche Ressourcen über Amplify/CDK definieren.
- Lokal erzeugter QR-Code, z. B. mit `qrcode.react`.
- Vitest für Logik und Handler; Playwright für zentrale Nutzerabläufe.
- Standardregion `eu-central-1`, über Umgebungswerte konfigurierbar.

## 3. Rollen und Nutzeroberflächen

### Quizmaster

Der Admin-Login bietet öffentliche Selbstregistrierung mit E-Mail-Bestätigung. Neue Konten erhalten keine Adminrechte und warten auf manuelle Zuweisung der Cognito-Gruppe `Quizmasters`. Nach der Zuweisung kann der Nutzer seine Berechtigung durch explizite Erneuerung der Anmeldungstokens prüfen. Dokumentiere Kontoanlage und manuelle Freigabe. Nur berechtigte Admins dürfen Quizze verwalten oder Sitzungen steuern. Rolle, Sitzungseigentümerschaft und erwartete Zustandsversion sind serverseitig zu prüfen.

- `/admin`: Quizübersicht, Quiz anlegen/bearbeiten/duplizieren/löschen, Sitzungen erstellen und vergangene Ergebnisse ansehen.
- `/admin/quizzes/:quizId`: Editor für Quizmetadaten und geordnete Fragen.
- `/admin/sessions/:sessionId`: Live-Steuerung mit Spielstatus, Teilnehmerzahl, Countdown, Antwortfortschritt und eindeutigem nächsten Steuerschritt.

Editor-Regeln: 1–100 Fragen und 2–8 Antworten pro Frage; Fragetext, Antworttexte und genau eine richtige Antwort; Fragen und Antworten hinzufügen, löschen und umsortieren; Antwortzeit 5–120 Sekunden, Standard 20 Sekunden; optionale Erklärung. Unvollständige Texte, ungültige Antwortzahlen sowie keine oder mehrere richtige Antworten verhindern Speichern beziehungsweise Start. Ein Beispielquiz mit zehn unterhaltsamen Fragen ist enthalten.

### Teilnehmende

- `/join`: sechsstelligen Spielcode eingeben.
- `/join/:joinCode`: Beitritt über QR-Code oder Direktlink.
- `/play/:sessionId`: Lobby, Frage, Antwortbestätigung, Auflösung und Rangliste.

Der Server weist beim Beitritt einen lustigen, sitzungsweit eindeutigen Namen und Avatar zu. Bei Namenskollisionen ergänzt er einen kurzen Suffix. Es gibt keine freie Namenseingabe und keine Bild-Uploads. Die Zuordnung zur authentifizierten technischen Gastidentität muss im selben Browser wiederherstellbar sein; eine vom Client gelieferte Teilnehmer-ID ist kein Berechtigungsnachweis. Ein anderer Browser oder gelöschter Browserspeicher darf eine neue Teilnahme erzeugen; geräteübergreifende Wiederherstellung ist nicht Teil des MVP.

### Optionale Präsentationsansicht

`/present/:presentationToken` ist getrennt, schreibgeschützt und darf niemals Spielsteuerung ermöglichen. Der Token muss kryptografisch zufällig und nicht erratbar sein; speichere ihn nicht im Klartext in gemeinsam lesbaren Daten. Setze eine restriktive Referrer-Policy und verwende keine Drittanbieter-Tracker.

Die Ansicht zeigt in der Lobby QR-Code, Spielcode, Beitrittsadresse, Quiztitel, Namen, Avatare und Teilnehmerzahl; während einer Frage Antworttexte, Countdown und Antwortfortschritt; nach Fristende Lösung, Verteilung, Erklärung und Top 5; am Spielende Siegerpodest und vollständige Rangliste. Frage und Antworten sind immer auch auf Smartphones sichtbar, sodass die App ohne Präsentationsansicht funktioniert.

## 4. Spielablauf und verbindliche Invarianten

Quizvorlagen und Spielsitzungen sind getrennt. Beim Erstellen einer Sitzung wird ein unveränderlicher Snapshot des Quiz angelegt. Änderungen an der Vorlage beeinflussen laufende oder vergangene Sitzungen nicht.

Verwende serverseitig validierte Zustände und optimistische Nebenläufigkeitskontrolle mit erwarteter Versionsnummer:

`LOBBY → COUNTDOWN → QUESTION_OPEN → QUESTION_CLOSED → SCORING → REVEAL → LEADERBOARD`

Nach `LEADERBOARD` startet der Quizmaster die nächste Frage über `COUNTDOWN`; nach der letzten Frage wird `FINISHED` erreicht. Abbruch führt zu `CANCELLED`. Veraltete oder doppelte Steuerungsaufrufe dürfen keine Zustände überspringen. Während `SCORING` wird „Wird ausgewertet …“ angezeigt.

1. Das Backend reserviert beim Erstellen einer Sitzung atomar einen eindeutigen sechsstelligen Spielcode und erzeugt die optionale Präsentationsadresse.
2. Gäste treten nur vor Spielbeginn bei. Bereits registrierte Personen dürfen jederzeit wieder verbinden. Die Teilnehmerzahl bezeichnet registrierte Teilnehmende, nicht verlässlich online befindliche Geräte.
3. Beim Start einer Frage beginnt ein gemeinsamer dreisekündiger Countdown. Das Backend legt verbindliche `opensAt`- und `closesAt`-Zeitpunkte fest; der Client berechnet die Anzeige anhand eines Serverzeit-Offsets.
4. Pro Person und Frage wird genau eine Antwort angenommen. Nach Annahme kann sie nicht geändert werden. Während der offenen Frage bleiben Richtigkeit, Antworten anderer und Antwortverteilung verborgen.
5. Antwortfortschritt wird live angezeigt. Der Zähler-Nenner ist die beim Öffnen gespeicherte Teilnehmerzahl; fehlende Antworten zählen nicht als richtige Antworten.
6. Das Backend schließt die Frage bei Fristablauf automatisch – auch bei geschlossenem Admin-Tab – und wertet sie vollständig aus, bevor Lösung und Rangliste veröffentlicht werden.
7. Ein Quizmaster darf vorzeitig schließen; ab dem atomaren Schließen werden keine weiteren Antworten angenommen. Im MVP gibt es kein Pausieren und kein automatisches Schließen nach Eingang aller Antworten.

Die Anzeige eines Timers im Client entscheidet niemals über die Antwortberechtigung. Ein verspäteter Workflow darf die Frist nicht verlängern. Jeder Zustandsübergang und jede Veröffentlichung muss idempotent oder versionsgeschützt sein.

## 5. Zeitmessung, Punkte und Rangfolge

Zeit, Antwortannahme, Richtigkeit und Punkte werden vollständig serverseitig ermittelt. Der Client übermittelt nur Sitzungs-/Fragenreferenz und ausgewählte Antwort. Teilnehmeridentität stammt aus dem vertrauenswürdigen Request-Kontext.

```text
elapsedMs = clamp(serverReceivedAt - opensAt, 0, durationMs)
speedBonus = round(500 * (1 - elapsedMs / durationMs))
points = correct ? 500 + speedBonus : 0
```

Eine richtige Antwort ergibt 500–1.000 Punkte, falsche oder fehlende Antworten 0; es gibt keine Minuspunkte. Akzeptiere Antworten nur, wenn `opensAt <= serverReceivedAt < closesAt` und die Frage nicht atomar geschlossen wurde. Definiere und dokumentiere, an welcher vertrauenswürdigen Backend-Grenze `serverReceivedAt` gesetzt wird. Keine Genauigkeit versprechen, die die gewählte Infrastruktur nicht bietet; erläutere die enthaltene Netzwerklaufzeit in der Spielhilfe.

Rangfolge: Gesamtpunkte absteigend, Anzahl richtiger Antworten absteigend, Summe der serverseitigen Antwortdauer richtiger Antworten aufsteigend. Bei Gleichstand gleicher Wettbewerbsrang (z. B. 1, 1, 3); stabile Anzeige zusätzlich nach `participantId`.

## 6. Daten, Zugriffsschutz und Backend-Operationen

Entwirf konkrete Amplify-/DynamoDB-Modelle und passende Schlüssel/Indizes. Dies ist das fachliche Mindestmodell; sichere veröffentlichte Projektionen getrennt von Geheimnissen:

| Bereich | Wesentliche Daten und Zugriff |
| --- | --- |
| Quiz / QuizQuestion | Eigentümer, Metadaten, Reihenfolge, Antwortoptionen, Lösung, Erklärung, Dauer; nur berechtigter Quizmaster und erforderliche Backend-Operationen |
| GameSession / SessionQuestion | Eigentümer, Status, Version, aktuelle Frage, Zeitpunkte, Spielcode und unveränderlicher Fragen-Snapshot; Lösung nur für Admin/Backend |
| Participant | Sitzung, technische Gastidentität, Anzeigename, Avatar, Beitrittszeit; Backend und eigene freigegebene Projektion |
| Answer | Sitzung, Frage, Teilnehmer, Auswahl, Empfangszeit; Backend, Bestätigung ohne vorzeitige Lösung |
| QuestionResult / Score | Richtigkeit, Punkte, Antwortdauer und Gesamtstand; erst nach abgeschlossener Auswertung gezielt freigeben |
| PublicGameState | Nur aktuell freigegebener Status, Texte, Zeiten, Zähler und Ergebnisse; berechtigte Sitzungsteilnehmende bzw. Präsentationstoken |

Verwende einen eindeutigen Antwortschlüssel aus Sitzung, Frage und Teilnehmer. Vermeide Scans in häufigen Spieloperationen; greife nach Sitzung und Frage über Schlüssel oder Indizes zu. Spielcodes atomar reservieren und erst dann wiederverwenden, wenn alte Zuordnungen logisch ungültig sind. Abgelaufene Berechtigungen müssen sofort unwirksam sein; DynamoDB-TTL dient nur der späteren Bereinigung.

Gäste dürfen keine Tabellen beliebig lesen, listen oder ändern. `allow.guest()` allein autorisiert keine Sitzungsmitgliedschaft. Erratene `sessionId`- oder `participantId`-Werte dürfen keinen Zugriff ermöglichen. Öffentliche API-Keys sind kein Adminschutz. Prüfe Rolle, Mitgliedschaft, Eigentümerschaft, Eingaben, Status und Version in serverseitigen Operationen. Beschränke Datenantworten auf das jeweils erforderliche Minimum.

Implementiere mindestens folgende typisierte, serverseitig validierte Operationen:

- Quizverwaltung: `createQuiz`, `updateQuiz`, `deleteQuiz`, `duplicateQuiz`.
- Adminsteuerung: `createSession`, `startQuestion`, `closeQuestion`, `nextQuestion`, `finishSession`, `cancelSession`.
- Gast: `joinSession`, `getMyParticipation`, `submitAnswer`.
- Lesen: `getGameState`, `getMyResult`, `getLeaderboard`, `getPresentationState`.
- Intern: `finalizeQuestion` und ein ausschließlich serverseitig autorisierter Publish-Pfad.

Dokumentiere den tatsächlich verwendeten Authentifizierungspfad für Queries, Mutations und Subscriptions. Subscriptions für Zustand, Teilnehmerzahl und Antwortzähler müssen funktionieren und beim Einrichten Mitgliedschaft oder Präsentationsberechtigung prüfen; ein clientseitiger Filter nach `sessionId` genügt nicht. Direkte DynamoDB-Schreibvorgänge aus Lambda lösen nicht automatisch AppSync-Subscriptions aus: implementiere einen nachweislich funktionierenden, nicht von Gästen aufrufbaren Publish-Pfad. Keine GraphQL-Auswahl darf Lösungen vor der Freigabe offenbaren.

Nach Reconnect Subscription herstellen und aktuellen Snapshot laden; Versionsnummern zum Ignorieren verspäteter oder doppelter Ereignisse verwenden. Bei Verbindungsproblemen Zustand mit begrenztem Backoff erneut laden, kein dauerhaftes Polling im Sekundentakt.

## 7. Nebenläufigkeit und automatische Auswertung

- Antwortannahme muss atomar gegen Sitzungsmitgliedschaft, offene Frage, Frist und eindeutige Antwort prüfen. Antwortdatensatz und Antwortzähler werden konsistent gemeinsam aktualisiert; eine Transaktion oder gleichwertige bedingte Schreiboperation verhindert Read-then-Write-Rennen und Doppelzählung.
- Bei Retry derselben Antwort bestehende Annahme zurückgeben; eine abweichende zweite Antwort ablehnen. Verlorene Netzwerkantworten dürfen weder Mehrfachzählung noch Mehrfachpunkte erzeugen.
- Fristablauf serverseitig auslösen; Browser-Timer und DynamoDB-TTL sind keine alleinige Timerlösung. Der Workflow trägt Sitzungs-ID, Fragen-ID und Ausführungs-/Versionskennung. Veraltete Ausführungen dürfen keine spätere Frage schließen.
- Workflowstart und persistierter Zustand müssen ausfallsicher zusammenspielen (z. B. idempotenter Start aus einem gespeicherten Timer-Auftrag). Fehler zwischen Speicherung und Workflowstart dürfen keine Sitzung ohne automatische Finalisierung hinterlassen.
- Beachte Zeitauflösung und Grenzen des gewählten Wait-Zustands. Deadline-Prüfung bei jeder Antwort ist zwingend, auch wenn der Finalisierer verspätet läuft. Keine blockierend wartende Lambda; konfiguriere Retries und sichtbare Fehlerzustände.
- Sperre die Frage zuerst atomar, lies danach alle angenommenen Antworten konsistent und werte nur diese aus. Berücksichtige DynamoDB-Konsistenz und Transaktionsgrenzen; verarbeite größere Sitzungen in idempotenten Batches.
- Ergebnisse je Frage/Teilnehmer idempotent speichern. Wiederholte Finalisierung darf Punkte nicht erneut addieren. Lösung und Rangliste erst nach vollständiger Auswertung veröffentlichen; Veröffentlichung muss wiederholbar sein.

## 8. Gestaltung und Bedienbarkeit

Gestalte eine eigenständige Gameshow-Oberfläche, mobile-first für Teilnehmende und passend für Admin-Desktop sowie optionale Präsentation:

- Dunkles Navy/Violett, Akzente in Cyan, Pink und Limette, große Typografie, großzügige Abstände und abgerundete Karten.
- Antwortflächen mindestens 44 × 44 CSS-Pixel, mit unterscheidbaren Farben plus Buchstaben/Symbolen; Bedeutung nie ausschließlich durch Farbe vermitteln.
- Animierter Lobbybeitritt, Avatarkarten, runder Countdown, motivierende Übergänge, klares Feedback „Antwort gespeichert!“ und freundliche Auflösung ohne Bloßstellung.
- Persönliche Platzierung, Rangänderungen, Top 5 und Siegerpodest; Sound optional, standardmäßig aus.
- `prefers-reduced-motion`, Tastaturbedienung, sichtbare Fokuszustände und gute Kontraste berücksichtigen.
- Keine Trackingdienste, extern geladenen Schriften oder Avatar-Dienste für die Grundfunktion.

Leere Lobby, ungültiger/abgelaufener Code, volle oder bereits gestartete Sitzung, Netzverlust, Wiederverbindung, zu späte Antwort, Auswertung, Abbruch und Spielende müssen verständliche Zustände haben.

## 9. Betrieb, Datenschutz und Dokumentation

- Obergrenze von standardmäßig 100 Teilnehmenden je Sitzung konfigurierbar und beim Beitritt atomar durchsetzen. Gleichzeitige Beitritte und Antworten nahe der Deadline prüfen.
- Eingabelängen und Requestgrößen begrenzen; angemessene Rate-Limits für Code-Suche, Beitritt und Antwortversuche vorsehen. Keine Geheimnisse oder vollständigen Auth-Tokens loggen. Lambda-IAM auf notwendige Ressourcen begrenzen.
- Keine Klarnamen, E-Mail-Adressen oder Profilbilder von Gästen erheben. Ohne Registrierung ist Mehrfachteilnahme über getrennte Browser nicht zuverlässig verhinderbar; diese Grenze benennen.
- Konfigurierbare Aufbewahrungsfrist (Vorschlag: sieben Tage) und Bereinigung abgelaufener Sitzungen, Antworten, Ergebnisse und Code-Zuordnungen dokumentieren. Keine pauschale Behauptung „DSGVO-konform“.
- README mit lokaler Einrichtung, Amplify-Sandbox, Admin-Erstellung, Seed-Daten, Tests, Build und Hosting-Deployment. Ressourcen, IAM-Rechte, Umgebungswerte, Kostentreiber und manuelle Schritte benennen. Keine Secrets committen; Infrastruktur im Code definieren.

## 10. Umsetzungsreihenfolge und Prüfungen

Halte die Anwendung nach jedem Schritt ausführbar und priorisiere den durchgängigen Kernablauf:

1. Repository und Architektur prüfen, Grundgerüst/Designsystem bei Bedarf einrichten.
2. Datenmodell, Rollen, Gastidentität und geschützte Backend-Operationen umsetzen.
3. Quizeditor, Validierung und Beispielquiz bereitstellen.
4. Sitzung, Spielcode/QR-Beitritt, Identitätswiederherstellung und Live-Lobby umsetzen.
5. Eine komplette Frage inklusive Timer, Antwortannahme, vorzeitigem Schließen und automatischer Auswertung Ende-zu-Ende fertigstellen.
6. Mehrere Fragen, Zwischen-/Endrangliste und optionale Präsentationsansicht ergänzen.
7. Wiederverbindung, Fehlerfälle, Nebenläufigkeit, Autorisierung und Realtime absichern.
8. Bedienbarkeit/Animationen, Dokumentation und relevante Checks vervollständigen.

Automatisierte Tests müssen mindestens Punkteformel und Rangfolge, Zustandswechsel, Deadline-Grenzen, doppelte und parallele Antworten sowie wiederholte Finalisierung abdecken. Prüfe außerdem fremde Sitzungen, gefälschte Teilnehmer-IDs, nicht berechtigte Admins, unberechtigte Subscriptions und vorzeitigen Lösungszugriff. Mocks allein belegen keine AWS-Autorisierung.

Playwright-Kernablauf: Admin erstellt ein Quiz mit zwei Fragen; zwei getrennte Browserkontexte treten bei, antworten unterschiedlich schnell, sehen automatische Auflösung und korrekte Endrangliste. Prüfe, dass die Frage auch bei geschlossenem Admin-Tab automatisch endet. Nutze isolierte Testdaten und -ressourcen.

Eine echte Amplify-Sandbox-Prüfung der Berechtigungen sowie ein Lasttest für das Ziel von 100 Teilnehmenden sind Integrations-/Betriebsprüfungen. Führe sie aus, wenn isolierte Ressourcen und nötige AWS-Zugangsdaten/Berechtigungen verfügbar sind. Andernfalls dokumentiere sie samt konkretem Blocker als offen; ersetze sie nicht durch eine Erfolgsaussage aufgrund von Mocks.

## 11. Abnahmekriterien

- Quizze mit mehreren Fragen und genau einer richtigen Antwort sind erstellbar und validiert.
- QR-Code und manueller Spielcode führen ohne Konto/Login in dieselbe Lobby; Name und Avatar werden serverseitig zugeordnet und im selben Browser wiederhergestellt.
- Die komplette Runde funktioniert auf Smartphones ohne Beamer; die Präsentationsansicht ist optional und nur lesend.
- Lobby- und Antwortzähler werden auf berechtigten Ansichten ohne manuelles Neuladen aktualisiert.
- Nur der berechtigte Quizmaster kann steuern. Fremde Sitzungen, gefälschte IDs und Subscriptions erlauben keinen unberechtigten Datenzugriff.
- Fristen und Antwortannahme sind serververbindlich; nach Frist oder atomarem Schließen wird keine Antwort akzeptiert.
- Automatische Auswertung funktioniert unabhängig von offenen Browsern. Retries zählen Antworten und Punkte höchstens einmal.
- Antworten, Lösungen und Ranglisten bleiben bis zur jeweiligen Freigabe verborgen.
- Punkte entsprechen der Formel; schnellere richtige Antworten erhalten mindestens so viele Punkte wie langsamere, falsche Antworten keine Punkte.
- Zwischenrangliste, eigene Platzierung und finale Rangliste funktionieren mit dokumentierter Gleichstandsregel.
- Die App hat dokumentierte AWS-Deployment-Schritte. Typecheck, Build und relevante Tests laufen; nicht ausgeführte Sandbox-/Lasttests und andere offene Voraussetzungen werden konkret benannt.

## 12. Technische Referenzen

- Amplify-Autorisierung: https://docs.amplify.aws/react/build-a-backend/data/customize-authz/
- Eigene Queries und Mutations: https://docs.amplify.aws/react/build-a-backend/data/custom-business-logic/
- Eigene Realtime-Subscriptions: https://docs.amplify.aws/react/frontend/data/custom-subscription/
- Step-Functions-Wait-Zustand: https://docs.aws.amazon.com/step-functions/latest/dg/state-wait.html

> **Wichtig:** „Die App wird in einer gemeinsamen Runde vor Ort gespielt. Die meisten Teilnehmenden spielen mit ihrem eigenen Smartphone und benötigen lediglich einen Browser – keine Installation und kein Benutzerkonto. Nur der Quizmaster nutzt einen Computer zur Spielsteuerung. Optional wird die Präsentationsansicht über einen Beamer oder großen Bildschirm für alle angezeigt. Das Spiel muss auch ohne diesen gemeinsamen Bildschirm vollständig funktionieren.“
