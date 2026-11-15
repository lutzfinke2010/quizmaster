# Copilot-Auftrag: QuizRush-Spielansichten neu gestalten

## Auftrag und Ziel

Setze das neue Design für den bestehenden QuizRush-Spielablauf um. Die vorhandene Startseite gefällt und ist die visuelle Grundlage. Übernimm ihre Gestaltung in die Spielansichten. Ersetze die bisherige blockartige Fragen-/Auflösungsansicht durch klar getrennte Spielphasen mit einer auf Smartphones optimierten Teilnahmeansicht und einer gut lesbaren gemeinsamen Präsentationsansicht. Passe die Quizmaster-Steuerung entsprechend an.

Arbeite im vorhandenen Repository, verwende vorhandene Komponenten und behalte die bestehende Spielmechanik, Authentifizierung und AWS-Anbindung bei. Die beigefügte Vorschau ist ein Designprototyp, kein Ersatz für das Produktionsfrontend.

## So verwendest du dieses Paket

1. Entpacke den Ordner `quizrush-spieldesign` direkt unter `Spec/` im Repository. Falls der Ordner im Repository anders geschrieben wird, verwende die bestehende Schreibweise.
2. Öffne `vorschau/designentwurf.html` im Browser. Über die oberen Schaltflächen wechselst du zwischen den vier Spielphasen. Auf dem Smartphone kannst du eine Antwort antippen.
   Die Vorschau nutzt Google Fonts für die Darstellung; ohne Internet erscheinen Ersatzschriften. Im Produktivcode lokal gehostete Fonts verwenden. Countdown und Werte sind Demo-Daten. Die vollständigen Produktionsanforderungen stehen in dieser Anleitung.
3. Übergib Copilot den Auftrag am Ende dieser Datei. Die enthaltenen Pfade sind relativ zu diesem Ordner.

## Enthaltene Referenzen und ihre Bedeutung

| Datei | Verwendung |
| --- | --- |
| `referenzen/01-bisherige-fragenansicht-ersetzen.png` | Bisheriger Zustand: nicht als Ziel übernehmen. Zu große Leerflächen, zu viele gleichartige Boxen und Auflösung/Rangliste untereinander vermeiden. |
| `referenzen/02-startseite-stil-beibehalten.png` | Maßgebliche Stilreferenz für Typografie, Farben, Formen, Buttons und spielerische Details. Startseite beibehalten. |
| `referenzen/03-startseite-details-stil-beibehalten.png` | Ergänzende Stilreferenz; keine Vorgabe für Änderungen an Datenschutztexten. |
| `vorschau/designentwurf.html` | Interaktive Zielansicht mit Frage, abgegebener Antwort, Auflösung und Zwischenstand, jeweils auf gemeinsamem Bildschirm und Smartphone. |

Priorität bei Konflikten: vorhandene fachliche Regeln und diese Anleitung, dann Stil der Startseite, dann die interaktive Beispielansicht. Beispieltexte, Spielcode, Namen, Kategorien, Teilnehmerzahlen, Zeiten und Punkte aus dem Prototyp nicht fest in den Produktivcode schreiben.

## Nutzungssituation

- Gemeinsame Runde vor Ort, zunächst für ein Arbeits-Event.
- Die meisten Teilnehmenden nutzen ihren Smartphone-Browser ohne Installation oder Registrierung.
- Der Quizmaster steuert am Computer.
- Ein Beamer oder großer gemeinsamer Bildschirm ist optional. Fragen und Antworttexte müssen auf dem Handy vollständig verfügbar sein.
- Die Präsentationsansicht zeigt keine Verwaltungsaktionen und keine privaten Teilnehmerinformationen.

## Gestaltungsregeln

Verwende die vorhandenen Schriftarten, Farbvariablen und Komponenten der Startseite, wenn sie verfügbar sind. Neue Designwerte zentral als semantische Tokens einführen. Die folgenden Werte beschreiben die Richtung der Vorschau:

| Rolle | Referenzwert |
| --- | --- |
| Hintergrund, warmes Creme | `#F8F8F0` |
| Haupttext, dunkles Grün | `#203E37` |
| Primärfarbe, Tannengrün | `#205C4E` |
| Akzent, Limette | `#DAF18E` |
| Ergänzung, Pfirsich | `#F8D3BB` |
| Ergänzung, Lavendel | `#E6DEF6` |
| Zurückhaltende Fläche | `#EAF0DF` |
| Dezente Trennlinien | `#CDD6C8` |

- Markante, runde und kräftige Überschriften wie auf der Startseite; gut lesbare normale Schrift für Erklärungen und Metadaten. Die Vorschau verwendet Outfit und DM Sans; vorhandene passende Projektfonts haben Vorrang. Produktionsfonts lokal hosten, keine neuen Google-Fonts-Anfragen einführen.
- Klare Hierarchie: aktuelle Frage oder aktuelles Ergebnis ist der Fokus. Keine mehrfach ineinander geschachtelten Karten.
- Runde Ecken, feine Konturen und sparsame versetzte Schatten. Sticker, Sterne und Limetten-Unterstreichungen gezielt einsetzen.
- Antwortoptionen im aktiven Zustand ruhig und einheitlich halten. Dunkelgrün markiert die eigene gewählte Antwort. Vor der Auflösung bedeutet diese Markierung nur „abgegeben“, nicht „richtig“.
- Nicht alle Texte fett setzen. Sekundärtexte erhalten weniger visuelles Gewicht.
- Spielerische Animationen kurz halten, etwa 150–250 ms. Keine springenden Layouts oder dauerhaft blinkenden Elemente. `prefers-reduced-motion` respektieren.

## Ansichten und Verhalten

### Lobby / Warten auf den Start

Führe den bestehenden Stil fort: Spielname, QR-Code und gut lesbarer Spielcode in der gemeinsamen Anzeige; Teilnehmerzahl und eine Auswahl der zufälligen Avatare. Auf dem Handy eigener Spielname und Avatar mit klarer Rückmeldung „Du bist dabei“. Platz für längere Namen und bis zu viele Teilnehmende über eine begrenzte Vorschau plus Gesamtzahl vorsehen. Keine übergroße endlose Avatarliste.

### Laufende Frage

Gemeinsame Anzeige:

- Kleine Metazeile mit „Frage x von n“, optional vorhandener Kategorie und Countdown.
- Frage groß und gut lesbar. Lange Fragen müssen umbrechen dürfen.
- Antwortkarten mit einem eindeutigen Buchstaben und dem vollständigen Antworttext. Kein doppelter Buchstabe als vermeintlicher Antworttext, sofern die tatsächliche Antwort nicht selbst so lautet.
- Bei genügend Breite zwei Spalten, bei schmalen Ansichten eine Spalte. Beliebige vorhandene Anzahl an Antwortmöglichkeiten unterstützen; vier Optionen sind nur ein Beispiel.
- Darunter kompakt „18 von 24 haben geantwortet“ und ein dazu passender Fortschrittsbalken. Antwortverteilung und richtige Antwort erst nach der Auflösung anzeigen.

Smartphone:

- Kompakter Kopf mit Identität, vorhandenem Punktestand und optional Rang. Vor dem ersten Ergebnis „Noch keine Wertung“ statt eines erfundenen Rangs anzeigen.
- Frage, Countdown und große Antwortbuttons mit mindestens 48 px Höhe, bevorzugt 56–64 px.
- In der Regel eine Antwort pro Zeile, mit genug Platz für lange Texte.
- Die gesamte Karte ist per Touch und Tastatur bedienbar. Kein zusätzlicher Bestätigungsbutton, sofern das bestehende Spiel direktes Antworten vorsieht.
- Bei typischen Fragen passen alle Optionen möglichst in die Bildschirmhöhe. Lange Inhalte dürfen natürlich scrollen; niemals Texte abschneiden, um Scrollen zu verhindern.

### Antwort wird gesendet / Antwort abgegeben

- Bei Tippen den bestehenden Submit-Aufruf verwenden, Doppelsenden verhindern und einen kurzen Zustand „Wird gesendet …“ anzeigen.
- Erst nach bestätigter Annahme „Antwort ist drin“ anzeigen. Bei Fehler sichtbar informieren und eine fachlich erlaubte Wiederholung anbieten.
- Eigene gewählte Antwort anzeigen; keine vorzeitige Aussage über ihre Richtigkeit.
- Bis zur Auflösung wird die Auswahl gesperrt, wenn dies die bestehende Spielregel ist.
- Auf dem gemeinsamen Bildschirm bleibt die Frage sichtbar. Dort wird lediglich die bestätigte Zahl eingegangener Antworten aktualisiert.

### Auflösung

- Eigene Spielphase, keine dauerhaft darunter angehängte Ergebnisbox.
- Gemeinsame Anzeige: Frage oder eindeutiger Bezug zur Frage, richtige Antwort mit Häkchen und Textkennzeichnung, Stimmen pro Antwort und proportionaler Balken. Bei langen Fragen bleibt deren Inhalt zugänglich.
- Auf null Stimmen und nicht beantwortete Fragen vorbereitet sein. Keine Division durch null, keine ungültigen Balkenbreiten. Falls Prozentwerte sichtbar sind, den Nenner eindeutig festlegen.
- Optional vorhandene fachliche Erklärung anzeigen. Keine Erklärung erfinden oder eine leere große Fläche reservieren.
- Smartphone: persönliche Rückmeldung „Richtig“, „Leider daneben“ oder „Zeit abgelaufen / Keine Antwort“, tatsächlicher Punktgewinn und tatsächliche neue Gesamtpunkte.
- Bei falscher oder fehlender Antwort die richtige Antwort sichtbar nennen. Die Auflösung muss auch ohne Beamer verständlich sein.
- Antwortzeit nur anzeigen, wenn sie tatsächlich vorliegt. Rangaufstieg nur bei realem Vergleich zum vorigen Rang ausweisen.
- Punkte, Antwortzeiten und Rang ausschließlich aus den autoritativen Spielinformationen übernehmen.

### Zwischenstand

- Separate Phase mit „Zwischenstand · nach Frage x“.
- Auf dem gemeinsamen Bildschirm die ersten drei Plätze als Podest in der Reihenfolge 2–1–3 darstellen. Platz 1 ist am höchsten. Darunter eine begrenzte, kompakte Liste weiterer Plätze statt riesiger Karten.
- Auf dem Smartphone die eigene Position, Gesamtpunkte und tatsächliche Platzveränderung hervorheben; benachbarte Plätze optional ergänzen.
- Ein oder zwei Teilnehmende, Gleichstände und geteilte Ränge gemäß bestehender Ranglogik korrekt behandeln. Keine leeren erfundenen Podestplätze.
- Der Quizmaster bestimmt wie bisher, wann die nächste Frage startet. Falls Zwischenstände bisher optional sind, bleibt diese Einstellung erhalten.

### Finale

- Nach der letzten Frage eine eigene finale Ranglistenphase mit „Endstand“ und Siegerpodest.
- Kleiner Konfettieffekt möglich, reduziert bei Bewegungseinschränkung. Keine Animation, die Namen oder Punkte verdeckt.
- Auf dem Handy eigene Endposition, Gesamtpunkte und Anzahl richtiger Antworten anzeigen, soweit vorhanden.
- „Neue Runde“ oder vergleichbare Aktionen nur in der Quizmaster-Steuerung anbieten und bestehende Bestätigungen beibehalten.

### Quizmaster am Computer

- Gleiche Designsprache, aber funktionale kompakte Steuerung.
- Aktuelle Spielphase, Frage x/n, Restzeit und eingegangene Antworten klar sichtbar.
- Pro Phase genau eine hervorgehobene nächste reguläre Aktion, etwa „Frage starten“, „Auflösung anzeigen“, „Zwischenstand anzeigen“ oder „Nächste Frage“. Zulässige Aktionen aus dem bestehenden Spielzustand ableiten.
- Vorhandene automatische Zeitlimits und Phasenwechsel beibehalten. Buttons dürfen keine zweite parallele Zeitsteuerung implementieren.
- Beenden, Überspringen und andere Sonderaktionen visuell nachrangig; vorhandene Schutzmechanismen beibehalten.
- Bestehende separate Präsentationsansicht weiterhin separat öffnen können. Keine Adminnavigation auf dem Beamer.

## Technische Umsetzung im bestehenden Projekt

1. Lies zuerst Repository-Anweisungen, `AGENTS.md`, Copilot-Instruktionen, vorhandene Spezifikationen und relevante Design-/UI-Komponenten.
2. Ermittle die vorhandenen Routen für Teilnahme, Präsentation und Quizmaster sowie den autoritativen Zustandsfluss des Spiels. Keine zweite fachliche State Machine anlegen.
3. Übernimm Tokens und Schriften der vorhandenen Startseite. Prüfe tatsächliche Fontfamilie und verfügbare Schnitte, statt die Vorschau blind zu kopieren.
4. Extrahiere passende wiederverwendbare Komponenten, z. B. Spielkopf, Frage, Antwortkarte, Countdown, Antwortfortschritt, Feedback, Podest und Ranglistenzeile. Komponenten nur dort aufteilen, wo dies Wiederverwendung und Verständlichkeit verbessert.
5. Spiele serverseitige Phasen in die jeweilige Ansicht aus. „Antwort abgegeben“ ist ein persönlicher Unterzustand und darf die gemeinsame Phase nicht verändern.
6. Zähle die Zeit aus dem bestehenden Serverzeitpunkt/Deadline herunter; keinen neuen lokalen Countdown bei jedem Render starten. Der Browser beendet keine Frage auf eigene Autorität.
7. Bestehende serverseitige Punkteberechnung, Deadlineprüfung, Gastidentität, Reconnect- und Aktualisierungsmechanismen erhalten. Keine richtigen Antworten vorzeitig an Gastgeräte ausliefern.
8. Verbindungsabbruch, Wiederverbinden, verspätete Antwort, bereits beantwortete Frage und Neuladen verständlich darstellen. Bereits bestätigte Antworten bei Wiederbeitritt wieder anzeigen.
9. Datenschutz-/Impressumszugänge und bestehende rechtliche Seiten erhalten. Keine zusätzlichen Tracker, externen Avatar-Dienste oder Font-CDNs einführen.
10. Den HTML-Prototyp nicht als iframe oder komplett getrennte App einbauen. Die lokalen Phasen-Schaltflächen ganz oben sind reine Vorschau-Steuerung und gehören nicht in die Teilnehmer- oder Präsentationsansicht.

## Responsive Gestaltung und Barrierefreiheit

- Teilnahmeansicht bei 320, 390 und 430 px Breite sowie auf einem Desktop prüfen. Keine horizontale Scrollleiste.
- Präsentationsansicht für große Querformatbildschirme optimieren; Schrift skalieren und lange Inhalte sinnvoll umbrechen. Nicht die gesamte Ansicht als Bild verkleinern.
- Text und Buttons müssen bei Zoom und längeren Antworttexten benutzbar bleiben.
- Bedeutung nie allein durch Farbe vermitteln: Auswahl, richtige Antwort und Fehler zusätzlich mit Text, Symbolen und passenden ARIA-Attributen markieren.
- Sichtbare Tastaturfokusse, semantische Buttons und ausreichende Kontraste vorsehen. Statusänderungen angemessen ankündigen, keinen Screenreader jede Sekunde mit dem Timer unterbrechen.
- Die Vorschau zeigt beispielhaft eine feste helle Gestaltung. Vorhandenen Dark Mode erhalten, falls das Produkt bereits einen hat; kein zusätzlicher Theme-Umbau ist erforderlich.

## Abnahmekriterien

- Die Startseite bleibt visuell erhalten; die Spielansichten wirken klar als Teil derselben App.
- Frage, Auflösung, Zwischenstand und Finale sind unterscheidbare Phasen. Keine endlose Seite mit allen Phasen untereinander.
- Auf dem Handy kann ohne gemeinsamen Bildschirm gespielt und die richtige Antwort nach der Auflösung erkannt werden.
- Falsche, richtige, nicht abgegebene und abgelehnte/verspätete Antworten zeigen unterschiedliche korrekte Zustände.
- Antworten und Punkte funktionieren weiterhin mit den bestehenden APIs und Echtzeit-Updates.
- Antwortzahl und Fortschrittsbalken passen zusammen; bei null Teilnehmenden ist die Anzeige stabil.
- Layout funktioniert mit zwei, vier und sechs Antwortoptionen, langen Fragen, langen Namen sowie einem, zwei und vielen Teilnehmenden.
- Rangfolge, Podest und persönliche Position stimmen mit dem tatsächlichen Serverergebnis überein.
- Kein Richtig/Falsch-Feedback vor der offiziellen Auflösung und kein bestätigtes „abgegeben“ vor Serverbestätigung.
- Reconnect und Neuladen erzeugen weder doppelte Antworten noch verlorene bestätigte Antworten.
- Vorhandene passende Lint-/Typecheck-/Build-Prüfungen laufen erfolgreich. Relevante bestehende Tests ausführen und bei geänderter Zustandsdarstellung gezielt um sinnvolle Fälle ergänzen.
- Falls eine Browser-Testumgebung vorhanden ist, Desktop-/Mobilansichten anhand der Referenzen visuell prüfen und Abschluss-Screenshots erstellen. Fehlende Live-Testzugänge offen benennen, keine erfolgreiche Mehrgeräteprüfung behaupten.

## Vorgehen und Abschlussbericht

Analysiere zunächst kurz die bestehenden Komponenten und beginne dann mit der Umsetzung. Triff übliche reversible UI-Entscheidungen selbstständig. Frage nur nach, wenn eine fachliche Entscheidung mit dem bestehenden Verhalten kollidiert und sich nicht aus dem Projekt klären lässt. Keine Bereitstellung oder Veröffentlichung aus diesem Auftrag ableiten.

Berichte am Ende knapp über geänderte Bereiche, ausgeführte Prüfungen und tatsächlich noch offene Punkte. Verweise auf relevante Dateien und gegebenenfalls erstellte Screenshots.

## Startauftrag zum Kopieren in Copilot

```text
Setze den Designauftrag in Spec/quizrush-spieldesign/Anleitung.md vollständig im bestehenden Projekt um. Lies zuerst die Anleitung und die Repository-Anweisungen. Nutze die Bilder unter referenzen/ als Einordnung des bisherigen Zustands und der beizubehaltenden Startseite. Die interaktive Vorschau unter vorschau/designentwurf.html zeigt die neue Richtung für Spielansichten und Smartphones. Öffne und prüfe dort alle vier Phasen. Wenn du die Vorschau nicht ausführen kannst, lies deren Markup und Styles zusammen mit den detaillierten Vorgaben dieser Anleitung.

Behalte den Stil der Startseite sowie die bestehenden Spielregeln, AWS-Anbindung, serverseitige Zeitsteuerung und Punkteberechnung bei. Setze die getrennten Spielphasen und die passende Quizmaster-Steuerung um. Beginne nach einer kurzen Bestandsaufnahme direkt mit der Umsetzung und führe die passenden vorhandenen Prüfungen aus. Veröffentliche oder deploye nichts.
```
