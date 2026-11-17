# Änderungs-Spec: Kompakte Fragen, Async-Tempo und Admin-Top-5

## Auftrag und Priorität

Überarbeite die bestehende RateLama-App gezielt an vier Stellen:

1. Frage und Antworten sollen in der üblichen Smartphone-Ansicht ohne Scrollen sichtbar sein – im Live-Quiz und im Async-Quiz.
2. Im Async-Quiz werden richtige Antworten zusätzlich nach Geschwindigkeit bewertet.
3. Nach bestätigter Antwort folgt im Async-Quiz automatisch die nächste Frage; der bisherige Zwischenschritt entfällt.
4. In der Admin-Auswertung steht die Bestenliste mit den ersten fünf Teilnehmenden ganz oben. Weitere Plätze und Details sind aufklappbar, der übrige Inhalt wird kompakter.

Dies ist ein Änderungsauftrag zum bestehenden Projekt. Die folgenden Regeln ersetzen widersprechende Vorgaben aus älteren Specs, insbesondere aus `ratelama-asynchrones-quiz`:

| Bisher | Neu |
| --- | --- |
| Async-Wertung nur nach Richtigkeit | Richtigkeit plus Geschwindigkeitsbonus für neu veröffentlichte Async-Runden |
| Nach jeder Antwort Bestätigung mit „Nächste Frage“ | Nach erfolgreicher Speicherung unmittelbar nächste Frage |
| Großzügige Seiten-/Kartenabstände, sodass Frage/Antworten Scrollen erfordern | Kompakte Spielansicht mit Fokus auf Frage und Antworten |
| Zusammenfassung/Statistiken vor der Rangliste | Top 5 als erster Ergebnisbereich, weitere Daten darunter kompakt/aufklappbar |

Nicht betroffene Regeln bleiben bestehen: globale Async-Deadline, Gastzugang, stabile Identität und Avatare, Zugriffsschutz, unveränderlicher Veröffentlichungssnapshot, Aufbewahrung und keine Lösungen für Gäste vor Quizende. Keine Neuentwicklung der App und kein Branding-Wechsel.

## 1. Fragen beantworten ohne unnötiges Scrollen

### Geltungsbereich und Ziel

- Gemeinsame kompakte Fragenkomponenten für Live- und Async-Teilnahme verwenden, soweit dies zur vorhandenen Architektur passt.
- Schwerpunkt ist die Smartphone-Teilnahme. Auch Desktop- und Präsentationsansichten dürfen durch die Änderung nicht schlechter werden.
- Im normalen Spielzustand sollen der vollständige Fragetext, alle Antwortoptionen und gegebenenfalls „Antwort abgeben“ gleichzeitig im sichtbaren Bereich liegen.
- Nach Start, Reload und jedem Fragenwechsel befindet sich die Ansicht oben bei der aktuellen Frage. Die Scrollposition der vorherigen Frage darf nicht übernommen werden.
- Allein `scrollTo(0, 0)` ist keine Lösung für ein zu hohes Layout. Ursache und benötigten Platz tatsächlich reduzieren.

### Konkrete Layoutvorgaben

- Während der Beantwortung eine fokussierte Spielansicht statt des vollständigen Landingpage-Layouts nutzen.
- Kopfzeile auf eine schmale Zeile reduzieren: kleine Marke/Avatar, kurzer Name, kompakter Fortschritt. Keine großen Begrüßungsflächen, Podeste oder dekorativen Hero-Karten oberhalb der Frage.
- Frage unmittelbar unter der kompakten Metazeile; keine großen leeren Außenabstände oder mehrfach ineinander geschachtelten Karten.
- Typische Ausgangswerte: 12–16 px Außenabstand, 8–12 px zwischen Antwortoptionen, 20–26 px Frageschrift und mindestens 16 px Antworttext. Vorhandene Designtokens verwenden und an Inhalt/Viewport anpassen.
- Antwortflächen mindestens 48 CSS-Pixel hoch; Höhe bei mehrzeiligem Text automatisch vergrößern. Keine künstlich hohen Karten bei einzeiligen Antworten.
- Bei zwei oder vier kurzen Antworten ein 2-Spalten-Raster auch mobil prüfen, wenn vollständige Texte und ausreichend große Touchziele darin lesbar bleiben. Bei längeren Antworttexten eine Spalte. Nicht starr jede Anzahl in zwei Spalten zwingen.
- Auf breiteren Displays sinnvolle 2-Spalten-Anordnung und begrenzte Inhaltsbreite; nicht die ganze Smartphone-Ansicht proportional verkleinern.
- Timer/Bonusinformation und Fortschritt in derselben kompakten Metazeile oder einem schmalen Balken bündeln. Kein eigener großer Timerblock.
- Optionalen Hilfetext/Regelerläuterungen außerhalb des unmittelbaren Spielbereichs zusammenklappen. Wesentliche Aufgaben- oder Antworttexte dürfen dadurch nicht verschwinden.
- Vorhandene rechtliche Links erreichbar halten, aber keinen hohen Footer im Fragenbereich reservieren. Kein zusätzlicher globaler Navigationsblock, der die Antworten nach unten verdrängt.
- Bei Bildern die Höhe begrenzen und Platz passend verteilen. Für eine bildabhängige Frage muss das Bild erkennbar und bei Bedarf vergrößerbar bleiben.
- Dynamische sichtbare Viewporthöhe, Browserleisten, Drehung und Safe Areas berücksichtigen; geeignete responsive CSS-Mittel wie `dvh` mit Fallback verwenden. Kein pauschales Abschneiden über `height: 100vh; overflow: hidden`.
- Wenn eine feste/sticky Abgabezeile verwendet wird: Sie darf weder letzte Antwort noch Text überdecken und muss bei kleinen Viewports/Zoom korrekt mitfließen.

### Prüfreferenz für „ohne Scrollen“

Bei normaler Schriftgröße auf 360 × 640, 375 × 667 und 390 × 844 CSS-Pixeln: eine typische reine Textfrage bis ca. 120 Zeichen mit vier Antworten bis jeweils ca. 50 Zeichen vollständig inklusive benötigter Abgabeaktion darstellen. Dies ist eine konkrete Layout-Prüfreferenz, keine neue Zeichenbegrenzung für vorhandene Quizdaten.

Für beliebig lange Fragen, sechs oder mehr umfangreiche Antworten, sehr niedrige Querformatfenster oder starke Textvergrößerung lässt sich vollständiger Inhalt nicht immer gleichzeitig lesbar darstellen. In solchen Fällen kontrolliertes, nachvollziehbares vertikales Scrollen zulassen. Keine Texte abschneiden, keine Antwortoptionen verstecken, keine Mini-Schrift und keine unbedienbaren Touchziele erzwingen. Möglichst einen natürlichen Scrollbereich statt mehrerer ineinander verschachtelter Scrollflächen verwenden.

## 2. Async: Geschwindigkeitspunkte

### Wertungsregel

Verwende für **neue Async-Veröffentlichungen** die versionierte Regel `ASYNC_SPEED_V1`. Parameter zentral definieren und bei Veröffentlichung in der Wertungsregel der Runde festhalten:

- Richtige Antwort: **1.000 Grundpunkte** plus bis zu **500 Geschwindigkeitspunkte**.
- Falsche oder nicht abgegebene Antwort: **0 Punkte**, unabhängig vom Tempo.
- Bonusfenster: **30 Sekunden pro Frage**.
- Innerhalb des Bonusfensters fällt der Bonus linear von 500 auf 0 Punkte.
- Nach 30 Sekunden bleibt die Antwort weiterhin zulässig und erhält bei Richtigkeit 1.000 Grundpunkte, sofern die globale Quizfrist noch nicht erreicht ist.
- Das Bonusfenster ist **kein neues hartes Zeitlimit pro Frage**. Die vorhandene globale Deadline bleibt maßgeblich.

Berechnung mit serverseitig bestimmter Antwortzeit in Millisekunden:

```text
elapsedMs = max(0, answerAcceptedAt - questionStartedAt)
bonus = round(500 * max(0, 1 - elapsedMs / 30000))
points = isCorrect ? 1000 + bonus : 0
```

Beispiele für richtige Antworten: sofort 1.500 Punkte, nach 15 Sekunden 1.250 Punkte, ab 30 Sekunden 1.000 Punkte. Die vorhandene Live-Wertung nicht ändern. Bereits vorhandene gemeinsame Berechnungsbausteine wiederverwenden, wenn diese die neue ausdrücklich festgelegte Async-Regel abbilden können.

### Zeitmessung je Teilnehmer und Frage

- Der Timer gehört zur einzelnen Frage eines einzelnen Versuchs, nicht zur gesamten Runde und nicht zum Veröffentlichungszeitpunkt.
- `questionStartedAt` beim erstmaligen autorisierten Bereitstellen der aktuellen Frage serverseitig festlegen und persistieren. Der erste Fragebeginn wird durch den tatsächlichen Quizstart ausgelöst, nicht durch einen bloßen Linkaufruf.
- Den Start der nächsten Frage zusammen mit dem bestätigten Fortschritt bereitstellen. Next-Frage und deren Zeitstart konsistent behandeln; ein verwaister Timer für eine fachlich noch gesperrte Frage ist zu vermeiden.
- Die Frageinhalte müssen erst ab diesem Freigabeschritt für den Gast verfügbar sein. Kein kompletter Fragenkatalog oder Vorladen künftiger Fragen zum ungemessenen Vorauslesen.
- Serverantwort enthält die freigegebene aktuelle Frage, ihren gespeicherten Startzeitpunkt und bei Bedarf die Serverzeit zur UI-Anzeige. Lösungsschlüssel bleiben geschützt.
- Antwortzeit aus serverseitigem Start-/Annahmezeitpunkt bestimmen. Clientseitiges `Date.now()`, mitgesendete Dauer oder die lokale Stoppuhr sind keine Wertungsquelle.
- Die Zeitmessung umfasst technisch den Zeitraum zwischen serverseitiger Freigabe und Annahme einschließlich Übertragung. Keine exakt gemessene reine Lesezeit oder perfekte Gleichheit unterschiedlicher Netzverbindungen behaupten.
- Refresh, Wiederbeitritt, Mehrfachtabs, Zurücknavigation und erneutes Abrufen derselben Frage setzen den Start nicht zurück.
- Tabwechsel, Hintergrundmodus und Verbindungsabbruch pausieren den Bonus-Timer nicht. Bestätigte Antworten/Versuch bleiben erhalten, auch wenn der Bonus nach längerer Unterbrechung auf null fällt.
- Serverzeit und Quizfrist wie bisher autoritativ prüfen. Kein Bonus und keine neue Speicherung für erst nach der globalen Deadline angenommene Antworten.
- Idempotente Wiederholung einer bereits angenommenen Antwort liefert dieselben gespeicherten Punkte und denselben Annahmezeitpunkt zurück. Kein erneutes Stoppen oder Neuberechnen mit späterem Retry-Zeitpunkt.
- Nach Speicherung der Antwort deren Punkte unveränderlich halten, passend zur versionierten Wertungsregel.

### Anzeige

- Vor Beginn kurz erklären: „Richtig antworten bringt 1.000 Punkte. Je schneller du bist, desto mehr Bonus bekommst du – bis zu 500 Punkte zusätzlich.“
- Während der Frage kompakt „Tempo-Bonus“ mit verbleibendem Bonus oder Bonusfenster anzeigen. Nach Ende des Bonusfensters „Kein Tempo-Bonus mehr · richtige Antwort weiterhin 1.000 Punkte“ oder eine ebenso klare kurze Darstellung.
- Nicht „Zeit abgelaufen“ anzeigen, wenn nur das Bonusfenster endet.
- Anzeige ist rein informativ; Punkte kommen ausschließlich vom Backend.
- Vor dem globalen Quizende weder richtige Option noch tatsächlichen Punktgewinn der abgegebenen Antwort offenlegen. Sonst würde der Punktestand verraten, ob die Antwort richtig war. Diese bisherige Auflösungsregel bleibt bestehen.
- Bei der späteren eigenen Auflösung und Admin-Details Grundpunkte, Bonus, Gesamtpunkte und Antwortzeit nachvollziehbar darstellen.
- Ranking nach Gesamtpunkten; echte Gleichstände bleiben Gleichstände. Keine zusätzliche versteckte Start-/Endzeitwertung einführen.

### Bestehende Daten und laufende Quizze

- Ältere veröffentlichte Async-Runden und bereits abgeschlossene Ergebnisse nicht rückwirkend umwerten. Dort fehlen möglicherweise verlässliche Fragebeginn-Zeitpunkte, und die zugesagte Regel war eine andere.
- Neue Regel für neue Veröffentlichungen aktivieren. Laufende alte Runden bleiben mit ihrer gespeicherten bzw. eindeutig als Legacy erkannten Regel kompatibel.
- Fehlende `scoringVersion` in historischen Runden bedeutet die bisherige Wertung, nicht automatisch `ASYNC_SPEED_V1`.
- Innerhalb einer Veröffentlichung keine 1-Punkt- und 1.500-Punkte-Regeln mischen. Für einen neuen Durchlauf eines alten Quizentwurfs wird eine neue Veröffentlichung mit der neuen Regel erstellt.
- Keine Antwortzeit aus fehlenden historischen Daten erfinden. Admin bei Bedarf kompakt die verwendete Wertungsregel anzeigen.

## 3. Async: unmittelbar zur nächsten Frage

### Neuer Ablauf

1. Antwort auswählen.
2. Mit der vorhandenen Aktion „Antwort abgeben“ verbindlich absenden; den Bestätigungsklick vor der Abgabe in dieser Änderung beibehalten.
3. Während des Requests kurz „Wird gespeichert …“ am bestehenden Button anzeigen, Eingaben gegen Doppelsenden sperren.
4. Nach bestätigter Annahme **automatisch direkt die nächste Frage anzeigen**.
5. Nach der letzten bestätigten Antwort unmittelbar zur vorhandenen Abschlussseite wechseln.

Es entfallen die separate „Antwort gespeichert“-Zwischenseite, ein weiterer „Nächste Frage“-Button und jede künstliche Pause. Insbesondere keine mehrsekündige Erfolgsanimation und kein automatischer Auflösungsbildschirm zwischen den Fragen.

- Keine optimistische Weiterleitung vor bestätigter Speicherung. Fehler müssen beim aktuellen Stand bleiben und Wiederholen ermöglichen.
- Wo möglich, die nächste freigegebene Frage und ihren Startzeitpunkt mit der Antwortbestätigung zurückgeben. Keine unnötige Kette aus Bestätigungsseite, Folgeaktion und erneutem Fragenabruf.
- Aktuelle Frage, Optionen, Auswahl und Fortschritt als zusammengehörigen Zustand wechseln. Keine Millisekunden mit alter Frage/neuen Antworten oder umgekehrt anzeigen.
- Bei Fragewechsel Auswahl zurücksetzen, vorherige Scrollposition zurücksetzen und Fokus sinnvoll zur neuen Fragenüberschrift führen. Statusänderung für Screenreader angemessen ankündigen; Bonusanzeige nicht jede Sekunde vorlesen lassen.
- Feste Abmessungen nur dort einsetzen, wo dadurch keine Texte abgeschnitten werden. Kurze Übergänge sind erlaubt, dürfen die eigentliche Anzeige und Zeitmessung aber nicht unnötig verzögern. `prefers-reduced-motion` respektieren.
- Bei verlorenem Response/Retry dieselbe akzeptierte Antwort wiedererkennen und aktuellen bestätigten Fortschritt laden. Nicht versehentlich zwei Fragen überspringen oder die neue Frage erneut starten.
- Veraltete Responses, Mehrfachtabs und Doppelklicks über eindeutige Frage-/Versuchsbezüge abfangen. Eine alte Antwort darf niemals der inzwischen nächsten Frage zugeordnet werden.
- Wenn nach Antwortannahme keine weitere Frage mehr geöffnet werden darf, weil die Runde inzwischen beendet ist, den tatsächlichen gespeicherten Stand und passenden Endzustand zeigen. Keine neue Frage mit noch offenem Bonus vortäuschen.

Die Live-Fragensteuerung bleibt beim Quizmaster. Im Live-Modus nach eigener Antwort nicht eigenmächtig zur nächsten Frage wechseln.

## 4. Admin-Auswertung: Top 5 zuerst, Details kompakt

### Reihenfolge

Auf der Ergebnisseite direkt unter einer kompakten Kopfzeile mit Titel, Status und Aktualisierungsaktion:

1. **Top 5** als erster und visuell wichtigster Inhaltsbereich.
2. Zugeklapptes Element **„Weitere Platzierungen anzeigen (n)“** für alle übrigen Teilnehmer.
3. Eine kompakte Zusammenfassungszeile mit Teilnehmerzahl, abgeschlossenen Versuchen, offenen/abgelaufenen Versuchen und gegebenenfalls Quizende.
4. Weitere Analysebereiche standardmäßig eingeklappt, z. B. „Fragenauswertung“, „Teilnehmerdetails“ und „Quizinformationen“.

Kein großer Statistikblock, kein Veröffentlichungshinweis und keine große Gewinnerkarte oberhalb der ersten fünf. Gilt für die vorhandenen Admin-Ergebnisansichten von Live- und Async-Runden, soweit sie dieselbe Auswertung anbieten. Keine Änderungen an einer separaten öffentlichen Beamer-Siegerehrung aus diesem Auftrag ableiten.

### Bestenliste

- Kompakte Zeilen mit tatsächlichem Rang, Avatar, Spielname und Gesamtpunkten. Bei Bedarf kleiner Status für unvollständigen Versuch.
- Erste drei Plätze dürfen dezent hervorgehoben sein; kein hohes Podest, das die Plätze 4 und 5 aus dem sichtbaren Bereich drängt.
- Während einer laufenden Runde Überschrift „Aktuelle Top 5“ mit kleinem Hinweis „Vorläufig“. Erst nach Abschluss/Ende als Gewinner bzw. endgültige Bestenliste bezeichnen.
- Bis zu fünf Teilnehmer standardmäßig sichtbar. Bei weniger Teilnehmern nur vorhandene Einträge anzeigen. Bei null Teilnehmern ein kompakter Leerzustand.
- Bei Gleichstand den tatsächlich geteilten Rang anzeigen. Für die auf fünf Personen begrenzte Vorschau einen stabilen nicht wertenden Sortierschlüssel verwenden. Ein eventueller Gleichstand an der fünften Zeile bleibt kenntlich; weitere gleichplatzierte Personen finden sich unter „Weitere Platzierungen“.
- Rangnummern nicht einfach aus dem Arrayindex erzeugen, wenn Gleichstände bestehen.
- Vorhandene Filterregeln für abgeschlossene/unvollständige Async-Versuche beibehalten und sichtbar machen; Teilversuche nicht heimlich aus der Grundgesamtheit entfernen.
- Top 5 aus der gesamten relevanten Ergebnismenge bestimmen, nicht aus einer beliebigen ersten Datenbankseite. Weitere Plätze paginieren bzw. mit vorhandener Nachladefunktion anzeigen.
- Aufklappen und Aktualisieren dürfen keine doppelten Einträge erzeugen. Die Top 5 nicht noch einmal als Plätze 6+ im Zusatzbereich wiederholen.

### Kompaktere übrige Informationen

- Niedrigere Kartenabstände, weniger Überschriftenwiederholungen, zusammengehörige Kennzahlen in einer Zeile bzw. einem kleinen responsiven Raster bündeln.
- Keine für wenige Zahlen übergroßen Einzelkarten.
- Detaildaten und bestehende Funktionen behalten: Einzelantworten, Verteilungen, Zeiten und Status bleiben über aufklappbare Bereiche erreichbar.
- Native `details`/`summary` oder die vorhandene zugängliche Accordion-Komponente verwenden. Tastaturbedienung und korrekten Offen-/Geschlossen-Zustand gewährleisten.
- Accordion-Zustand bei einem Datenrefresh möglichst erhalten. Nur gezielt benötigte Detaildaten laden.
- Smartphone: Name, Punkte und Rang lesbar halten; sekundäre Spalten bei Bedarf in eine zweite kompakte Zeile verschieben. Keine winzige Tabelle mit horizontalem Zwangsscrollen als Standard.

## Umsetzungshinweise

1. Repository-Anweisungen, echte Implementierung und bestehende Tests lesen. Besonders die vorhandene Fragenansicht, Async-Mutationskette, Fragefreigabe, aktuelle Wertung und Admin-Ergebnisse prüfen.
2. Kurz die betroffenen Komponenten/Operationen nennen, dann umsetzen. Diese Spec beschreibt den Sollzustand; keine Dateinamen oder bereits existierenden Backend-Funktionen unterstellen.
3. Kompakte Layoutregeln möglichst zentral statt zweimal fast identisch implementieren. Frageninhalt und Modusverhalten sauber trennen.
4. Geschwindigkeitsmessung und automatische Folgefrage gemeinsam entwerfen. Eine reine Frontend-Stoppuhr reicht nicht, und ein Timer-Reset beim Render ist unzulässig.
5. Wertungsdaten additiv/versioniert erweitern und vorhandene Backend-/Auth-/Gastmechanismen beibehalten. Keine Migration mit rückwirkender Neubewertung.
6. Passende bestehende Lint-/Typecheck-/Build-Prüfungen ausführen und die relevanten Fälle in `Abnahmefaelle.md` prüfen. Vorhandene Testinfrastruktur nutzen; besonders Zeitmessung, Retries und Grenzfälle gezielt absichern.
7. Die UI auf realistischen Smartphone-Viewportgrößen und Desktop visuell prüfen. Wenn Browser-/Backendzugang fehlt, Einschränkungen offen dokumentieren.
8. Keine Veröffentlichung und kein produktives Deployment aus diesem Auftrag ableiten.

## Startauftrag für GitHub Copilot

```text
Implementiere Spec/ratelama-ui-async-update/Anleitung.md als gezielte Änderung der bestehenden RateLama-App. Priorität gegenüber älteren Specs: kompakte Frage-/Antwortansichten für Live und Async, ASYNC_SPEED_V1 mit serverseitigem Geschwindigkeitsbonus für neue Async-Veröffentlichungen, direkter automatischer Wechsel nach bestätigter Antwort und Admin-Ergebnisse mit Top 5 ganz oben sowie aufklappbaren weiteren Plätzen/Details. Erhalte die globale Deadline, den Schutz vor vorzeitiger Auflösung, historische Wertungsregeln und die Live-Steuerung. Lies zuerst die Repository-Anweisungen und tatsächliche Implementierung, beginne dann direkt mit der Umsetzung. Prüfe die Fälle in Abnahmefaelle.md und führe passende vorhandene Checks aus. Kein Deployment.
```
