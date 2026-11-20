# RateLama: Funktionen, Design und Technik

**Stand: 20. November 2026.** Diese Übersicht beschreibt den im Repository implementierten Stand. Welche Cloud-Funktionen tatsächlich verfügbar sind, hängt vom jeweiligen Deployment und seiner Konfiguration ab. Die angegebenen Paketversionen stammen aus der versionierten `package-lock.json`; `package.json` definiert die zulässigen Versionsbereiche.

**Inhalt:** [Überblick](#1-was-ist-ratelama) · [Funktionen](#2-funktionen) · [Design](#3-visueller-stil-und-bedienkonzept) · [Technik](#4-aktuell-verwendete-technik) · [Seiten und Code](#5-wichtige-seiten-und-quelltextstellen)

## 1. Was ist RateLama?

RateLama ist eine deutschsprachige Quiz-Web-App für gemeinsames Rätseln. Sie läuft im Browser und ist für Smartphones, Desktop und große Präsentationsflächen ausgelegt. Eine Installation als native App ist nicht erforderlich.

Quizmaster erstellen und verwalten Multiple-Choice-Quizze. Gäste spielen ohne Konto, Klarnamen oder E-Mail-Adresse mit. Zwei Spielarten stehen zur Verfügung:

| | Live-Quiz | Quiz zum Mitmachen |
| --- | --- | --- |
| Ablauf | Alle spielen gleichzeitig; der Quizmaster steuert die Runde. | Alle spielen selbstständig und zeitversetzt bis zu einem festgelegten Ende. |
| Einstieg | Sechsstelliger Code oder QR-Code in der Lobby. | Sechsstelliger Code, kurzer Link oder QR-Code auf der Einladung. |
| Antwort | Bis zum Ende der Fragezeit änderbar; die letzte rechtzeitig vom Server angenommene Antwort zählt. | Ein Tipp sendet sie sofort; nach serverseitiger Annahme ist sie endgültig. |
| Zeit | Jede Frage hat ein Zeitlimit. | Kein hartes Zeitlimit pro Frage, aber Tempo-Bonus und ein Ende für die gesamte Runde. |
| Auswertung | Gemeinsame Auflösung und Zwischenstände nach jeder Frage. | Persönliche Auflösung je nach Einstellung sofort oder nach Ende der Runde; Verwaltungsansicht mit Zwischen- und Endstand. |
| Kapazität | Standardmäßig 100, beim Backend-Deployment auf 1–1.000 einstellbar. | 250 Teilnahmen je neuer Veröffentlichung. |

Die Kapazitätswerte sind technische Grenzen, keine Zusicherung, dass eine bestimmte Last in jeder Betriebsumgebung bereits geprüft wurde.

## 2. Funktionen

### Startseite und Zugang

- Die Startseite erklärt den Ablauf in drei Schritten und führt direkt zu **Mitspielen** oder **Quiz vorbereiten**.
- Auf der gemeinsamen Beitrittsseite geben Gäste einen sechsstelligen Quiz-Code ein. Leerzeichen, Bindestriche und Punkte werden bei der Eingabe entfernt; führende Nullen bleiben erhalten. Der Server erkennt, ob der Code zu einem Live-Quiz oder einer Quizrunde zum Mitmachen gehört.
- Gäste erhalten einen automatisch erzeugten Spielnamen und einen Tieravatar. Der Server ordnet beides der technischen Gastidentität und der jeweiligen Runde zu; ein eigener Name ist nicht erforderlich.
- Ein Quizmaster kann sich mit E-Mail-Adresse und Passwort registrieren und die E-Mail mit einem sechsstelligen Code bestätigen. Ein neuer Bestätigungscode kann angefordert werden. Die Quizmaster-Rechte entstehen **nicht** automatisch: Eine Administration muss das Konto der Cognito-Gruppe `Quizmasters` zuordnen. Danach kann die Freigabe in der App erneut geprüft werden.
- Administrativ angelegte Konten können bei der ersten Anmeldung ein neues Passwort setzen. Die Abmeldung ist in der Quizübersicht verfügbar.

### Quizverwaltung und Editor

Angemeldete, freigeschaltete Quizmaster können eigene Quizze erstellen, bearbeiten, duplizieren und nach Bestätigung löschen. Ein Beispielquiz mit zehn Fragen dient als Einstieg. Die Übersicht zeigt Quizkarten sowie laufende Live-Sitzungen und veröffentlichte Quizrunden; beendete Einträge stehen in einklappbaren Archivbereichen.

Der Editor bietet eine Fragenübersicht mit direktem Sprung zur jeweiligen Frage. Fragen und Antworten lassen sich hinzufügen, entfernen und mit Pfeilen umsortieren. Die gewählte Lösung ist durch Auswahlkreis, Rahmen, Häkchen und Text erkennbar. Formularfehler werden am jeweiligen Feld angezeigt.

| Inhalt | Regel |
| --- | --- |
| Quiztitel | Pflichtfeld, höchstens 120 Zeichen |
| Beschreibung | Optional, höchstens 500 Zeichen |
| Fragen | 1–100 Fragen mit je höchstens 500 Zeichen |
| Antworten | 2–8 Antworten pro Frage, je höchstens 200 Zeichen; genau eine ist richtig |
| Antwortzeit | 5–120 Sekunden je Frage; relevant für Live-Quizze |
| Erklärung | Optional, höchstens 1.000 Zeichen; erscheint bei der Auflösung |

Beim Start einer Live-Sitzung oder beim Veröffentlichen einer Quizrunde wird ein eigener Fragen-Snapshot angelegt. Spätere Änderungen an der Quizvorlage verändern diese bereits gestartete Runde nicht.

### Quiz mit KI erstellen

Freigeschaltete Quizmaster können ein Quiz anhand von Titel und Thema generieren lassen. Einstellbar sind 1–50 Fragen, 2–8 Antworten, Schwierigkeit, Tonalität, Zielgruppe, Sprache, Antwortzeit und optionale Erklärungen. Zusätzliche Hinweise können Schwerpunkte, Ausschlüsse oder eigenen Quelltext enthalten.

Die Generierung läuft als asynchroner Hintergrundauftrag. Ungültige Fragen werden verworfen, Antworten gemischt und das Ergebnis gegen das Quiz-Schema geprüft; dadurch kann der Vorschlag weniger als die gewünschte Anzahl an Fragen enthalten. Der Vorschlag öffnet sich zur Prüfung im Editor und wird erst durch ausdrückliches Speichern zu einem Quiz. KI-Inhalte können falsch sein und müssen fachlich geprüft werden.

Die eingegebenen Angaben werden an OpenAI übermittelt. Deshalb sollen keine vertraulichen oder personenbezogenen Inhalte in das Formular eingegeben werden. Für die Funktion muss serverseitig ein OpenAI-Schlüssel eingerichtet sein.

### Live-Quiz

1. Der Quizmaster startet ein Live-Quiz aus einer Quizkarte und kann vorher optionale Streak-Bonuspunkte aktivieren.
2. In der Lobby werden Code, QR-Code, Teilnehmerzahl und eine Vorschau der Spielnamen und Avatare angezeigt. Neue Gäste können nur beitreten, solange die Lobby offen ist.
3. Der Quizmaster startet die erste Frage. Nach einem dreisekündigen Countdown öffnet der Server die Frage und schließt sie nach der konfigurierten Zeit automatisch. Ein vorzeitiges Schließen ist möglich.
4. Gäste sehen die vollständige Frage und ihre Antwortmöglichkeiten auf ihrem Gerät. Ein Tipp sendet die Auswahl sofort. Bis zum Fristende kann sie geändert werden; während eines ausstehenden Sende- oder Wiederherstellungsvorgangs sind Eingaben kurz gesperrt. Die Oberfläche unterscheidet zwischen „Wird gesendet“ und einer vom Server bestätigten Antwort.
5. Nach Schließen und serverseitiger Auswertung erscheinen richtige Antwort, optionale Erklärung und Stimmenverteilung. Persönlich werden zusätzlich Antwort, Punkte und gegebenenfalls Serien oder Abzeichen angezeigt. Stimmenbalken beziehen sich auf abgegebene Antworten; Nichtantworten werden gesondert genannt.
6. Der Quizmaster gibt den Zwischenstand frei und startet anschließend die nächste Frage. Nach der letzten Frage kann er den Endstand anzeigen. Eine Sitzung lässt sich nach Bestätigung auch abbrechen.

Die Spieleransicht zeigt die eigene Platzierung und benachbarte Plätze. Die gemeinsame Ansicht zeigt ein Podium in der Reihenfolge **2–1–3** und bis zu fünf weitere Einträge; bei Gleichstand bleibt die tatsächliche Ranghöhe erhalten. Eine separate, schreibgeschützte Präsentationsansicht kann über einen zufälligen Link geöffnet werden und enthält keine Quizmaster-Steuerung.

Bei Verbindungsproblemen versucht die App erneut, den Spielstand zu laden. Nach einer Wiederverbindung oder einem Neuladen wird auch die zuletzt gespeicherte eigene Antwort wiederhergestellt. Während eine Änderung gesendet wird, zeigt die Oberfläche weiterhin die zuvor bestätigte Antwort. Geht die Bestätigung verloren, wird der Serverstand geprüft; bei einem abgelehnten Wechsel bleibt die vorherige Antwort gültig.

### Quiz zum Mitmachen

Beim Veröffentlichen wählt der Quizmaster ein Enddatum mit Uhrzeit in der Browser-Zeitzone, höchstens 90 Tage in der Zukunft. Die Oberfläche berücksichtigt dabei auch nicht vorhandene oder doppelte Uhrzeiten bei einer Zeitumstellung. Optional sind Streak-Bonuspunkte und die **sofortige Auflösung**; letztere ist bei neuen Veröffentlichungen standardmäßig eingeschaltet.

- Die Veröffentlichung erhält einen eigenen sechsstelligen Quiz-Code und einen kurzen Link. Beides lässt sich kopieren; falls die Zwischenablage nicht verfügbar ist, bietet die App den Text zum manuellen Kopieren an. Ältere lange Token-Links bleiben verwendbar.
- Eine separate Einladung zeigt Titel, Code, Anleitung, Endzeit und einen lokal erzeugten QR-Code. Sie ist für Screenshots im 16:9-Format und für Vollbild ausgelegt; auf schmalen Geräten wird sie untereinander angeordnet. Nach Rundenende werden Code und QR-Code nicht mehr als aktive Einladung angezeigt.
- Gäste starten das Quiz selbst und beantworten die Fragen nacheinander. Eine bestätigte Antwort ist endgültig. Nach jeder Frage können sie pausieren und bis zum Rundenende auf demselben Gerät fortsetzen.
- Die nächste Frage wird erst über **Weiter** geöffnet. Erst dann beginnt ihr Tempo-Bonus; Neuladen setzt die bereits gestartete Zeit nicht zurück. Auch ohne verbleibenden Tempo-Bonus kann die Frage bis zum Rundenende beantwortet werden.
- Bei sofortiger Auflösung sieht die Person nach ihrer bestätigten Antwort die eigene Lösung, Erklärung, Punkte und Serie. Ohne diese Option bleiben Lösungen, Punkte, Serien und Abzeichen bis zum Ende der Runde verborgen. Noch nicht beantwortete Fragen werden nicht vorzeitig aufgelöst.
- Der Quizmaster kann die Runde vorzeitig beenden. Offene Teilnahmen enden dann ebenfalls; weitere Antworten sind nicht mehr möglich.

Die Ergebnisverwaltung zeigt Teilnahmestatus, vorläufige oder endgültige Rangliste, aggregierte Antwortverteilungen pro Frage und bei Bedarf aufklappbare Teilnehmerdetails. Diese lassen sich nach Abschlussstatus filtern und nach Rang, Spielname oder Startzeit sortieren. Der Stand wird in einem sichtbaren Tab ungefähr alle zehn Sekunden aktualisiert; bei Verbindungsfehlern bleibt der letzte Stand mit einem Hinweis sichtbar.

Eine bildschirmfüllende Ergebnispräsentation zeigt Podium, weitere Plätze und Teilnehmerzahlen, aber keine Frage- oder Antwortdetails. Weitere Plätze werden bei Platzmangel automatisch durchgeblättert; die Rotation kann pausiert werden. Diese Ansicht ist **kein öffentlicher Präsentationslink**: Sie erfordert die Quizmaster-Anmeldung und die Berechtigung für die eigene Runde. Wenn die Fullscreen-API nicht verfügbar ist, bleibt eine bildschirmfüllende Fensteransicht nutzbar.

### Punkte, Ranglisten und Gamification

Die Wertung wird serverseitig berechnet. Die angezeigte Uhr bzw. Tempo-Anzeige ist eine Orientierung; maßgeblich sind die vom Server erfassten Zeitpunkte einschließlich des Übertragungswegs.

| Regel | Live-Quiz | Quiz zum Mitmachen |
| --- | --- | --- |
| Richtige Antwort | 500 Grundpunkte plus bis zu 500 Geschwindigkeitspunkte, linear fallend über die verfügbare Fragezeit. | 1.000 Grundpunkte plus bis zu 500 Tempo-Punkte, linear fallend während der ersten 30 Sekunden nach Öffnung der Frage. |
| Falsche oder fehlende Antwort | 0 Punkte. | 0 Punkte. |
| Antwortzeit | Bei Änderungen zählt der Zeitpunkt der letzten tatsächlichen Änderung. | Zählt ab serverseitigem Öffnen der Frage bis zum Eingang der Antwort. |
| Rangfolge | Punkte, dann Anzahl richtiger Antworten, dann deren gesamte Antwortzeit; identische Werte teilen sich den Rang. | Punkte; gleiche Punkte teilen sich den Rang. Innerhalb eines Gleichstands dient der Spielname der Anzeigeordnung. |

Ältere Veröffentlichungen ohne Tempo-Wertung behalten ihre bisherige Regel mit einem Punkt pro richtiger Antwort. Bei beiden Spielarten kann der Quizmaster zusätzlich **Streak-Bonuspunkte** aktivieren: ab drei richtigen Antworten in Folge +100, bei vier +150 und ab fünf jeweils +200 Punkte. Eine falsche oder fehlende Antwort unterbricht die Serie.

Serien und Abzeichen gibt es auch ohne aktivierte Bonuspunkte. Die Abzeichen heißen „Erstes Aha!“, „Dreier-Serie“, „Unaufhaltsam“ und „Perfekte Runde“; das letzte setzt einen vollständigen, ausschließlich richtigen Abschluss voraus. Abzeichen selbst vergeben keine Punkte.

Bestätigte Erfolge werden unter anderem mit Punkte-Popups, animierten Zählern, Rangaufstiegs-Hinweisen, Podium und kurzem Konfetti begleitet. Neuladen allein löst keine erneute Punkte- oder Abschlussfeier aus.

### Lokaler Entwurfsmodus

Wenn der Abruf von `/amplify_outputs.json` keine erfolgreiche HTTP-Antwort oder keinen JSON-Inhalt liefert, startet die App im ausdrücklich gekennzeichneten lokalen Modus. Dort sind Quiz-Editor, Beispielquiz sowie das Duplizieren und Löschen lokaler Entwürfe nutzbar; Anmeldung, KI-Generierung, Live-Spiel und Veröffentlichungen sind nicht verfügbar. Der lokale Bereich ist kein geschützter Admin-Bereich.

Entwürfe bleiben zunächst nur im Arbeitsspeicher. Erst nach Aktivierung der Speicherfunktion werden vorhandene Entwürfe aus dem `localStorage` gelesen; neue Entwürfe werden erst beim ausdrücklichen Speichern dauerhaft in diesem Browser abgelegt. Das Ausschalten löscht sie nicht. Einzelne oder alle Entwürfe können in der Übersicht gelöscht werden. Beim Verlassen eines ungespeicherten lokalen Entwurfs warnt die App.

Eine vorhandene, aber ungültige JSON-Konfiguration oder ein Netzwerkfehler beim Abruf führen zu einer sichtbaren Fehlermeldung statt stillschweigend in den lokalen Modus zu wechseln.

### Datenschutz und rechtliche Seiten

- Gäste brauchen kein Konto, keinen Klarnamen und keine E-Mail-Adresse. Für den Spielbetrieb werden trotzdem eine technische Kennung, Spielname, Avatar, Antworten, Antwortzeiten, Punkte und abgeleitete Erfolge verarbeitet.
- Auf der Startseite, beim Beitritt und im Footer erläutert die App die Datennutzung. **Impressum** und **Datenschutzerklärung** sind ohne Anmeldung erreichbar. Für Quizmaster-Konten wird eine E-Mail-Adresse gespeichert.
- In Live-Sitzungen können Gäste ihre Teilnahme und zugehörigen Antworten und Punkte selbst löschen, sofern gerade keine Frage läuft oder ausgewertet wird. Bereits veröffentlichte anonyme Antwortverteilungen werden dadurch nicht rückwirkend geändert.
- Die Gastkennung im Browser läuft standardmäßig nach 24 Stunden ab. Für ein Quiz zum Mitmachen kann sie bis zur beim Start bekannten Ergebnisaufbewahrungsfrist verlängert werden, damit die Teilnahme auf demselben Gerät fortgesetzt werden kann. Eine bereits verlängerte Frist wird durch ein vorzeitiges Rundenende nicht verkürzt.
- Der Frontend-Code setzt selbst keine Cookies und lädt keine Analyse- oder Werbe-Tracker, externen Schriftarten oder Avatar-Dienste. Die KI-Funktion übermittelt ihre Eingaben allerdings an OpenAI.
- Betreiberangaben und Rechtstexte sind projektspezifisch zu prüfen und zu vervollständigen; die vorhandenen Texte sind keine Rechtsberatung.

## 3. Visueller Stil und Bedienkonzept

### Markenwirkung

RateLama wirkt freundlich, hell und spielerisch, ohne wie eine grelle Gameshow auszusehen. Die Oberfläche spricht die Nutzenden auf Deutsch direkt mit „du“ an. Kurze motivierende Texte wie „Kleine Fragen. Große Momente.“ oder „Gemeinsam spielen, gemeinsam staunen.“ unterstützen den gemeinschaftlichen Charakter.

Das RateLama-Logo, das Lama-Icon, Tieravatare und Gamification-Grafiken liegen lokal im Projekt. Auf schmalen Kopfzeilen ersetzt das Icon mit Markenname das breite Logo. Es gibt 50 Tieravatar-Motive; für die Anzeige existieren ein- und zweifach aufgelöste Varianten sowie ein neutraler Fallback.

### Farbpalette

Die App verwendet ein helles Farbschema mit dunkler, gut lesbarer Schrift, Petrol als Primärfarbe und zurückhaltenden Pastellakzenten. Die wichtigsten CSS-Tokens stehen in [`src/styles.css`](../src/styles.css) und [`src/components/game.css`](../src/components/game.css).

| Einsatz | Farbe | Wert |
| --- | --- | --- |
| Seitenhintergrund | warmes Off-White | `#f7f7ef` |
| Schrift und dunkle Konturen | dunkles Grün | `#203c38` |
| Sekundärtext | gedämpftes Graugrün | `#556563` |
| Primäraktionen und Hervorhebungen | Petrol | `#21574c` |
| Positive Akzente und Podium | helles Lime | `#d8ef91` |
| Spielflächen | warmes Weiß | `#fffef9` |
| Spielerische Akzente | Pfirsich / Flieder | `#f8d7c4` / `#e3def5` |
| Tastaturfokus | Blau | `#245cbe` |

Es gibt keinen in der Anwendung umschaltbaren Dark Mode. Farben werden nicht allein zur Kennzeichnung von Auswahl, Fehlern oder richtigen Antworten verwendet: Symbole und erklärender Text ergänzen sie.

### Typografie, Komponenten und Layout

- **Schrift:** Systemschriftstapel `Avenir Next`, Avenir, Segoe UI, sans-serif; keine heruntergeladenen Webfonts. Große, kräftige Überschriften mit enger Laufweite kontrastieren mit ruhigen Fließtexten. Kleine, gesperrte Großbuchstaben dienen als Bereichsmarkierungen.
- **Formensprache:** Abgerundete Karten, Buttons und Eingabefelder, feine Konturen und zum Teil harte, leicht versetzte Schatten. Kleine gedrehte Sticker und lokale Illustrationen geben der sonst ruhigen Oberfläche einen spielerischen Akzent.
- **Aktionen:** Primäre Buttons sind petrolfarben, sekundäre hell mit Kontur; gefährliche Aktionen werden zurückhaltend rot dargestellt und teilweise über gestaltete Bestätigungsdialoge abgesichert. Standard-Buttons sind mindestens 48 px hoch, kleine Aktionen mindestens 44 px.
- **Quizansicht:** Großflächige Antwortkacheln mit Buchstaben und Statusanzeigen. Ausgewählte Antworten werden petrolfarben hervorgehoben, ausstehende Sendungen anders markiert. Fortschrittsbalken, Timer, Ergebnisverteilungen und Podium machen den Spielzustand sichtbar.
- **Responsive Gestaltung:** Die Oberfläche unterstützt Breiten ab 320 px. Auf Smartphones werden Navigation, Karten und Editorbereiche gestapelt; die persönliche Frageansicht bleibt kompakt. In der persönlichen Frageansicht werden zwei oder vier Antworten nur dann zweispaltig dargestellt, wenn alle Antworttexte höchstens 18 Zeichen lang sind; längere Texte stehen einspaltig. Die Präsentation nutzt größere Flächen und Schrift.
- **Zugänglichkeit:** Sprunglink, sichtbarer Tastaturfokus, beschriftete Felder und Fehlermeldungen, Statusansagen, Fokusführung in Dialogen und Unterstützung für reduzierte Bewegung und erzwungene Farben sind implementiert. Die vorhandenen Prüfungen ersetzen keine vollständige Prüfung mit assistiven Technologien.

Für Bewegung nutzt die App kurze Übergänge, Einblendungen, animierte Punkte und Konfetti. Bei `prefers-reduced-motion` werden unter anderem Partikel und Bewegungsanimationen unterdrückt; die eigentlichen Ergebnisse und Erfolge bleiben sichtbar. Fehlende Icons und Abzeichen fallen von SVG auf PNG und schließlich auf ein einfaches Symbol zurück; Illustrationen nutzen kleinere PNG-Varianten oder einen Sticker als Fallback.

## 4. Aktuell verwendete Technik

### Frontend und Entwicklungswerkzeuge

Die folgenden Versionen sind die im Lockfile aufgelösten Versionen, nicht zwingend die Versionen eines bereits veröffentlichten Deployments.

| Bereich | Eingesetzte Technik | Verwendung |
| --- | --- | --- |
| Sprache und UI | TypeScript **7.0.2**, React und React DOM **19.3.1** | Typisierte Single-Page-App und Komponenten |
| Routing | React Router DOM **7.18.5** | Clientseitige Seiten und Direktlinks |
| Entwicklung und Build | Vite **8.3.8**, npm | Entwicklungsserver und statischer Produktionsbuild |
| Gestaltung | Tailwind CSS **4.3.5**, eigene CSS-Dateien | Utility-Klassen und das eigens definierte RateLama-Design |
| UI-Bausteine | Radix UI **1.8.1**, shadcn-Button, class-variance-authority **0.7.1** | Zugängliche Dialogprimitive und Button-Varianten |
| Formulare und Validierung | React Hook Form **7.92.0**, Zod **4.6.7**, Hookform-Resolver **7.0.6** | Editor, Anmeldung, Generator und Prüfung von Daten |
| Animationen | Motion **14.14.0** und CSS-Animationen | Punkte, Ranglisten, Übergänge und Feiern |
| Icons und QR-Codes | Lucide React **1.73.0**, qrcode.react **4.2.0** | Icons und lokal im Browser erzeugte QR-Codes |
| AWS-Client | AWS Amplify JavaScript **6.22.2** | Anmeldung, Gast-Credentials, GraphQL und Subscriptions |
| Qualitätssicherung | Vitest **5.1.0**, Playwright **1.65.1**, oxlint **1.94.0** | Unit-/Integrationstests, Browserprüfungen und Linting |

Für die lokale Entwicklung verlangt `package.json` Node.js `^22.12.0`, `^24.0.0` oder `>=26.0.0`. Die GitHub Actions verwenden Node.js 24.

### Backend und Datenfluss

Das Backend ist mit **AWS Amplify Gen 2** definiert (`@aws-amplify/backend` **1.25.1**) und wird um Ressourcen aus dem **AWS CDK** (**2.277.0**) ergänzt. Die serverseitige Logik ist in TypeScript geschrieben und verwendet das AWS SDK for JavaScript v3.

```text
Browser
  ├─ Cognito User Pool / Identity Pool
  └─ AppSync GraphQL ──> API-Lambda ──> DynamoDB
                              └─────────> Generator-Lambda ──> OpenAI API

DynamoDB Streams ──> Event-Publisher ──> AppSync-Subscription ──> Browser
DynamoDB Streams ──> Timer-Dispatch ──> Step Functions ──> Timer-Lambda
EventBridge (minütlich) ──> Timer-Sweep ──> Step Functions
```

| Dienst | Aufgabe in RateLama |
| --- | --- |
| **Amazon Cognito** | User Pool für Quizmaster-Konten und Gruppe `Quizmasters`; Identity Pool für technische Gastidentitäten und deren IAM-Credentials. |
| **AWS AppSync** | GraphQL-Queries und -Mutationen für Verwaltung und Spiel sowie autorisierte Subscriptions für Live-Ereignisse. |
| **AWS Lambda** | API-Operationen, Berechtigungsprüfungen, Spielablauf und Wertung, KI-Auftrag, Event-Veröffentlichung und Timer-Verarbeitung. |
| **Amazon DynamoDB** | Eine On-Demand-Tabelle für Quizvorlagen, Snapshots, Sitzungen, Teilnahmen, Antworten, Ergebnisse und Timeraufträge. Ein Index unterstützt ausstehende Timer; TTL bereinigt zeitlich begrenzte Daten asynchron. |
| **DynamoDB Streams und AppSync** | Bündeln Änderungen zu Live-Ereignissen. Clients übernehmen Zählerstände oder laden bei einer neuen Spielversion den berechtigten Snapshot; nach Verbindungsabbrüchen wird erneut synchronisiert. |
| **AWS Step Functions und EventBridge** | Ein dauerhafter Workflow öffnet und schließt Live-Fragen zeitgesteuert. Ein minütlicher Sweep versucht liegengebliebene Timer erneut. |
| **Amazon SQS und CloudWatch** | Dead-Letter-Queues für fehlgeschlagene Stream-Verarbeitung sowie Logs und Alarme für Timer- und Eventfehler. Alarmziele müssen für den Betrieb separat eingerichtet werden. |
| **AWS WAF und IAM** | Getrennte IP-Ratenbegrenzungen für AppSync und den Cognito User Pool sowie rollen- und operationsbezogene Berechtigungen. Das Backend begrenzt zusätzlich einzelne Operationen je Identität. |
| **OpenAI Chat Completions API** | Optionale KI-Quizgenerierung mit Structured Outputs; Standardmodell `gpt-4.1-mini`, beim Deployment konfigurierbar. Der Schlüssel wird als Amplify-Secret `open_ai_key` erwartet und nicht im Frontend verwendet. |
| **AWS Amplify Hosting** | Backend-Deployment und Build der statischen SPA; `dist` ist das Frontend-Artefakt. Eine SPA-Rewrite-Regel muss für Direktlinks eingerichtet werden. |

Der Server prüft neben der Quizmaster-Gruppe auch die Eigentümerschaft von Quizzen und Runden. Gastoperationen sind an die technische Identität und Teilnahme gebunden; Gäste greifen nicht direkt auf die Tabelle zu. Lösungen und Erklärungen werden erst für die jeweils erlaubte Spielphase freigegeben. Quiz- und Spielzustände werden mit Versionen und DynamoDB-Transaktionen gegen konkurrierende Änderungen abgesichert.

Die Live-Präsentation nutzt einen zufälligen Präsentationstoken. Geteilte Datensätze speichern dessen Hash; eine private Kopie bleibt beim Eigentümer zum erneuten Öffnen erhalten. Sechsstellige Codes sind dagegen keine geheimen Passwörter. Neue Gastidentitäten können mehrfach erzeugt werden; Mehrfachteilnahme und das Auffüllen einer Runde lassen sich damit nicht zuverlässig verhindern. WAF und Ratenlimits begrenzen diese Risiken, beseitigen sie aber nicht.

### Speicherung, Konfiguration und Betrieb

- **Aufbewahrung:** Live-Sitzungen standardmäßig sieben Tage ab Erstellung, Ergebnisse von Quizrunden zum Mitmachen standardmäßig 30 Tage nach dem tatsächlichen Rundenende. Beide Werte sind beim Backend-Deployment konfigurierbar. Der Zugriff endet zur gespeicherten Frist; die physische TTL-Löschung kann später erfolgen. Quizvorlagen bleiben bis zur aktiven Löschung erhalten.
- **Code-Ausnahme:** Der Reservierungseintrag eines Codes für eine Quizrunde zum Mitmachen bleibt ohne Teilnehmerdaten dauerhaft bestehen, damit ein alter Link nicht auf eine andere Runde zeigt. Live-Codes können nach Ablauf wiederverwendet werden.
- **Browser:** Lokale Entwürfe liegen nur nach Aktivierung und Speichern im `localStorage`; Gastidentität und Anmeldung verwenden den für die jeweilige Funktion benötigten Browserspeicher.
- **Konfiguration:** Das Frontend lädt `/amplify_outputs.json` zur Laufzeit. Die Datei enthält öffentliche AWS-Ressourcenkennungen und wird nicht eingecheckt. Wichtige Deployment-Optionen sind `QUIZRUSH_MAX_PARTICIPANTS`, `QUIZRUSH_RETENTION_DAYS`, `QUIZRUSH_ASYNC_RETENTION_DAYS`, `QUIZRUSH_IP_RATE_LIMIT`, `QUIZRUSH_AUTH_RATE_LIMIT`, `QUIZRUSH_OPENAI_MODEL` und `VITE_PUBLIC_BASE_URL`. Bei geänderten Aufbewahrungswerten müssen auch die angezeigten rechtlichen Angaben angepasst werden.
- **Hosting-Schutz:** [`customHttp.yml`](../customHttp.yml) definiert unter anderem Content Security Policy, `no-referrer`, weitere Sicherheitsheader und `noindex` für sensible Routen. Die CSP ist auf die dort konfigurierte AWS-Region abgestimmt und muss bei einem abweichenden Deployment geprüft werden.
- **CI:** Die GitHub Action führt Typecheck, oxlint, Vitest, den Legal-Check und ein npm-Audit aus. Die Konfiguration des produktiven Legal-Checks kann den Build bei offenen Betreiberangaben abbrechen.

## 5. Wichtige Seiten und Quelltextstellen

| Pfad | Zweck |
| --- | --- |
| `/` | Startseite mit Einstieg und Datenschutzhinweisen |
| `/join`, `/join/:joinCode` | Gemeinsamer Beitritt zu Live-Quiz und Quiz zum Mitmachen |
| `/play/:sessionId` | Persönliche Live-Spielansicht |
| `/present/:presentationToken` | Schreibgeschützte Live-Präsentation über Token |
| `/q/:token` | Quiz zum Mitmachen über kurzen Code oder älteren Token |
| `/einladung/:code` | Öffentliche Einladungsansicht für eine Quizrunde zum Mitmachen |
| `/admin` | Anmeldung bzw. Quiz-, Sitzungs- und Veröffentlichungsübersicht |
| `/admin/quizzes/:quizId` | Editor; `new` legt ein neues Quiz an |
| `/admin/quizzes/generate` | KI-Quizgenerator |
| `/admin/quizzes/:quizId/publish` | Veröffentlichung eines Quiz zum Mitmachen |
| `/admin/sessions/:sessionId` | Steuerung einer Live-Sitzung |
| `/admin/async/:publicationId` | Ergebnisse und geschützte Vollbildpräsentation einer Quizrunde |
| `/impressum`, `/datenschutz` | Öffentliche rechtliche Seiten |

Die zentralen Implementierungen liegen in [`src/CloudApp.tsx`](../src/CloudApp.tsx), [`src/QuizEditor.tsx`](../src/QuizEditor.tsx), [`src/components/GameView.tsx`](../src/components/GameView.tsx), [`src/domain/`](../src/domain/), [`src/server/`](../src/server/) und [`amplify/`](../amplify/).

Konkrete Schritte für lokale Entwicklung, AWS-Sandbox, Deployment und Betrieb stehen im [README](../README.md); zusätzliche Hinweise zu den lokalen Spielgrafiken in [Gamification-Assets](gamification-assets-chatgpt.md).
