# Copilot-Spec: 50 Mitspieler-Icons für RateLama

## Einstieg

Entpacke den enthaltenen Ordner nach `Spec/ratelama-mitspieler-icons/` im bestehenden Repository. Falls das Projekt `spec/` oder eine andere vorhandene Schreibweise verwendet, behalte diese bei. Dieses Paket ergänzt das RateLama-Branding und den Spielansichten-Entwurf.

## Auftrag

Jeder Mitspieler bekommt beim Beitritt neben dem zufälligen Spielnamen einen zufälligen Tier-Avatar aus diesem Set. Der Avatar dient der schnellen Wiedererkennung in Lobby, Spiel, Auflösung, Rangliste und Finale. Verwende die mitgelieferten Bilder; ersetze sie nicht durch Emojis oder externe Avatar-Dienste.

Die bestehende Anmeldung ohne Benutzerkonto, Gastidentität und Spielmechanik bleiben erhalten. Das Paket enthält fertige Bilddateien und Datenreferenzen, aber keine ungeprüfte Implementierung für das konkrete Repository.

## Paketinhalt

| Pfad | Zweck |
| --- | --- |
| `Anleitung.md` | Implementierungsauftrag, Spielregeln und Abnahme |
| `assets/avatars/256/` | 50 quadratische PNG-Dateien für die normale Anzeige |
| `assets/avatars/512/` | Dieselben 50 Motive in höherer Auflösung |
| `avatars.json` | Katalog mit 50 stabilen IDs, Beschriftungen und relativen Bildpfaden |
| `Uebersicht.png` | Nummerierte Gesamtübersicht aller 50 Motive |
| `vorschau.html` | Lokal öffnende Galerie mit Motiven, IDs und Dateinamen |
| `Bildgenerierung.md` | Stilvorgaben und Herkunft der Motive |

Die beiden Größen sind Ableitungen derselben Motive, keine 100 verschiedenen Avatare. Die Vorschaunummern 01–50 entsprechen dem Suffix der IDs `avatar-001` bis `avatar-050`.

## Gestaltung

- Freundliche, leicht freche Tierfiguren im RateLama-Stil.
- Dunkelgrüne Konturen, Creme und helle Kachelfarben wie Limette, Lavendel und Pfirsich.
- Unterschiedliche Tierarten und Silhouetten, damit nicht nur die Farbe unterscheidet.
- Transparente Umgebung um die abgerundete Kachel. Die mitgelieferten Dateien sind PNG-Rastergrafiken, keine Vektoren.
- Die Bilder enthalten keinen Spielnamen. Name und Bild werden als getrennte UI-Elemente angezeigt.
- Avatare proportional darstellen. Keine quadratische Kachel automatisch kreisförmig beschneiden: Ohren, Hörner oder Flossen könnten verloren gehen.

## Katalog und produktive Assets

1. Lies zuerst Repository-Anweisungen, `AGENTS.md`, Copilot-Instruktionen und bestehende Specs. Prüfe die aktuelle Gast-/Teilnehmeridentität und Avatarvergabe.
2. Kopiere die verwendeten Bilddateien in die bestehende produktive Asset-Struktur. Die laufende App darf keine Dateien aus `Spec/` laden.
3. Integriere `avatars.json` in den vorhandenen Code-Stil, z. B. als typisierten TypeScript-Katalog oder importierbares JSON. Die Pfade im Paket sind relativ zur Paketwurzel; passe sie an den Produktionspfad und die vorhandene Bundler-/Base-URL-Konfiguration an.
4. Die stabile ID ist der persistierte fachliche Wert. Speichere nicht die vollständigen PNG-Daten, keine temporären URLs und keine frei vom Client vorgegebenen Bild-URLs im Teilnehmerobjekt.
5. `avatarId` ist pro neuem Teilnehmer innerhalb einer Runde verpflichtend. Für bestehende Datensätze ohne ID ist eine verträgliche Migration bzw. einmalige Zuordnung notwendig. Bereits vorhandene gültige Bildzuordnungen während laufender Runden nicht zufällig austauschen.
6. Der Katalog wird lokal ausgeliefert. Keine neuen Dienste, Tracker, Fonts oder Bibliotheken nur für die Avatarvergabe hinzufügen.

## Zufallsvergabe und Stabilität

### Neuer Beitritt

- Verwende eine zentrale, autoritative Vergabe im vorhandenen Join-Ablauf. Der Client zeigt das bestätigte Ergebnis an und würfelt nicht bei jedem Render selbst.
- Wähle zufällig aus den in dieser Runde noch unbenutzten IDs. Bei bis zu 50 Teilnehmern dürfen keine Icons doppelt vergeben werden.
- Ziehung über zufällige Auswahl eines verfügbaren Kandidaten oder eine korrekt gemischte Liste realisieren; kein `sort(() => Math.random() - 0.5)` zum Mischen.
- Zwei gleichzeitig eintretende Teilnehmer dürfen nicht denselben noch freien Avatar erhalten. Nutze die im vorhandenen Backend geeigneten atomaren/transaktionalen Mechanismen. Ein bloßes „Teilnehmer lesen, freie ID im Browser wählen, speichern“ genügt nicht.
- Eine mögliche Umsetzung bei passender bestehender DynamoDB-Struktur ist eine bedingte Reservierung pro `(sessionId, avatarId)` zusammen mit der Teilnehmerzuordnung. Dies ist eine Architekturidee, keine Pflicht für ein neues Datenmodell. Wähle die kleinste mit der vorhandenen Architektur korrekte Lösung.
- Wiederholte Join-Aufrufe derselben bestehenden Gastidentität müssen idempotent sein. Bei einem Retry nach verlorenem Response dieselbe Zuordnung zurückgeben, statt weitere Icons zu reservieren.
- Reservierung und Zuordnung müssen konsistent bleiben; bei abgebrochenem Join keine dauerhaft blockierten, unzugeordneten Icons zurücklassen. Datenbank- oder Netzwerkfehler dürfen den Spieler nicht als erfolgreich beigetreten darstellen.

### Mehr als 50 Teilnehmer

- Den Beitritt weiterhin ermöglichen. Das Set ist keine Teilnehmerbegrenzung.
- Wenn alle 50 Icons benutzt werden, Wiederholungen zulassen und bevorzugt einen zufälligen Avatar aus den aktuell am seltensten vergebenen Motiven wählen.
- Einzigartigkeitsregeln für die ersten 50 und Wiederverwendung danach müssen auch bei gleichzeitigen Beitritten konsistent funktionieren. Dokumentiere die gewählte Lösung.
- Der Spielname und die vorhandene technische Teilnehmer-ID bleiben zusätzlich die Identität. Backend-Logik niemals über das Bild oder den Spielnamen adressieren.
- Beim Austritt oder kurzzeitigem Verbindungsverlust nicht sofort neu vergeben. Reservierungen mindestens so lange erhalten, wie dieselbe Gastidentität in dieser Runde zurückkehren kann. Bereinigung am bestehenden Session-Lebenszyklus ausrichten, nicht am Schließen des Browser-Tabs.

### Neuladen, Reconnect und neue Runde

- Refresh, Reconnect und Navigation behalten denselben Avatar, dieselbe Gastidentität und denselben bestätigten Namen.
- Teilnehmer-ID plus vorhandenen Wiederbeitrittsmechanismus verwenden. Keine neue Gastidentität erzeugen, nur weil der WebSocket getrennt war.
- Verschiedene Quizrunden haben getrennte Vergabepools; derselbe Avatar darf parallel in verschiedenen Runden vorkommen.
- Bei einer tatsächlich neuen Teilnahme kann neu zufällig vergeben werden. Bestehende Regeln zum Übernehmen von Teilnehmern in eine Folgerunde berücksichtigen; bei übernommenen Teilnehmern den Avatar beibehalten.
- Keine neue Benutzerregistrierung, E-Mail-Abfrage oder Profilverwaltung einführen.

## Zufälliger Name

- Behalte die vorhandene Zufallsnamen-Funktion bei. Kein echter Name ist erforderlich.
- Wenn die vorhandene Namenslogik Tiernamen nutzt, soll der Tieranteil nach Möglichkeit zum bestätigten Avatar passen: z. B. Fuchs-Bild und „Flotter Fuchs“. Nutze dafür das `label` aus dem Katalog sowie eine sprachlich passende vorhandene oder kleine lokale Namenstabelle.
- Nicht blind jeden Tiernamen mit derselben Adjektivendung kombinieren: „Neugieriger Koala“, „Neugierige Eule“ und „Neugieriges Huhn“ benötigen unterschiedliche Formen. Auch „Roter Panda“ und „Seeotter“ sinnvoll behandeln.
- Wenn Namen bisher unabhängig vom Tier gebildet werden, bleibt dies zulässig. Die Vergabe des Avatars darf keinen bestehenden bestätigten Spielnamen unbemerkt verändern.
- Gleiche Spielnamen entsprechend der vorhandenen Namensregel vermeiden bzw. unterscheidbar machen; das Icon allein garantiert keine eindeutigen Namen.

## Anzeige in der App

| Ort | Richtgröße | Verhalten |
| --- | --- | --- |
| Eigener Kopf im Smartphone | 36–44 CSS-Pixel | Neben Spielname, ggf. Punktestand |
| Lobby / Teilnehmerliste | 44–56 CSS-Pixel | Bild und Name zusammen sichtbar |
| Kompakte Ranglistenzeile | 32–44 CSS-Pixel | Mit Platz und Punkten konsistent ausrichten |
| Podest | 72–104 CSS-Pixel | Größer, vollständiges Motiv ohne Beschnitt |
| Persönliches Ergebnis | 56–80 CSS-Pixel | Derselbe Avatar wie in allen anderen Ansichten |

- Richtgrößen an die vorhandene Oberfläche anpassen, ohne die Startseite umzugestalten.
- Vorhandene Ranglisten und Lobbylisten wiederverwenden. Eine gemeinsame kleine `PlayerAvatar`-Komponente oder gleichwertige zentrale Darstellung nutzen.
- Für kleine Anzeigen 256er-Dateien verwenden; bei größeren Darstellungen/hoher Pixeldichte die 512er-Dateien über vorhandene Bildoptimierung oder `srcset` bereitstellen. Kein unnötiges Laden aller 50 hochauflösenden Bilder im initialen Smartphone-View.
- Feste Bildabmessungen bzw. `aspect-ratio: 1` verhindern Layoutsprünge. `object-fit: contain` verwenden.
- Bild und Name bei langen Namen sauber umbrechen oder passend begrenzen; vollständiger Name bleibt zugänglich.
- Bei Bildladefehler einen lokalen neutralen Fallback anzeigen, ohne die gespeicherte Avatar-ID zu verändern. Endlose `onError`-Schleifen vermeiden.
- Für eine unbekannte historische Avatar-ID ebenfalls stabilen Fallback anzeigen. Nicht aus einer fremden ID eine beliebige externe URL bauen.
- Keine Auswahlgalerie und keinen „Neu würfeln“-Button einführen. Zunächst erfolgt die Vergabe automatisch.

## Barrierefreiheit

- Wenn der Name direkt danebensteht, den Avatar in der Regel mit leerem `alt` als dekorativ behandeln, um doppelte Ansagen zu vermeiden.
- Wenn das Bild allein der zugängliche Inhalt eines Bedienelements ist, eine passende Beschriftung aus dem bestätigten Spielnamen verwenden.
- Status und Identität nicht ausschließlich durch Farbe oder Tierbild kommunizieren.
- Avatare sind keine Rang-, Leistungs- oder Richtig/Falsch-Markierungen. Farben bleiben über alle Phasen unverändert.

## Gezielte Prüfungen und Abnahme

- Genau 50 stabile Katalogeinträge, eindeutige IDs, vorhandene Bildpfade und richtige quadratische Bildmaße.
- Für eine Runde mit 50 neuen Gästen 50 verschiedene Avatar-IDs; auch bei parallelen Beitritten.
- Der 51. und weitere Gäste dürfen teilnehmen; Wiederverwendung folgt der definierten Regel.
- Derselbe Gast mit wiederholtem Join, Refresh oder Reconnect erhält dieselbe bestätigte Avatar-ID.
- Parallele Join-Retries derselben Identität erzeugen keine zusätzlichen Reservierungen oder Teilnehmer.
- Zwei gleichzeitige unterschiedliche Gäste erhalten vor Ausschöpfung des Sets verschiedene Icons.
- Unabhängige Sessions können dieselben IDs vergeben.
- Im Join-Fehlerfall bleiben keine widersprüchlichen Zuordnungen zurück.
- Lobby, Handy, Präsentationsansicht, Zwischenstand und Finale zeigen pro Teilnehmer dasselbe Motiv.
- Bestehende Teilnehmer ohne Avatar und unbekannte IDs führen nicht zu Fehlern oder zufälligen Wechseln.
- Fehlerhaftes Bild zeigt Fallback, ohne Neuzuweisung oder Endlosschleife.
- Sichtprüfung bei 320/390/430 px und Desktop sowie bei 32/48/96 CSS-Pixeln Avatargröße.
- Bestehende passende Typecheck-/Lint-/Build-Prüfungen ausführen. Die Vergabe- und Konkurrenzlogik gezielt testen; keine Tests nur zur Spiegelung der Bilddateinamen schreiben.
- Wenn Backend- oder Mehrgeräteprüfungen mangels Zugang nicht möglich sind, die Einschränkung im Abschlussbericht offen nennen.

## Umsetzung und Abschluss

Nach kurzer Bestandsaufnahme direkt implementieren. Routineentscheidungen im Stil des vorhandenen Projekts treffen. Keine neue Infrastruktur auf Verdacht anlegen, nichts veröffentlichen und keine bestehenden Teilnehmerdaten löschen. Falls eine Schemaerweiterung für `avatarId` nötig ist, diese additiv und kompatibel mit vorhandenen Daten planen.

Berichte abschließend knapp über geänderte Komponenten, gewählte Vergabestrategie, Datenmodelländerungen, ausgeführte Prüfungen und noch offene technische Schritte.

## Startauftrag zum Kopieren

```text
Setze Spec/ratelama-mitspieler-icons/Anleitung.md im bestehenden RateLama-Projekt um. Nutze die 50 mitgelieferten Icons und avatars.json. Vergib beim Beitritt serverseitig einen zufälligen Avatar; in einer Runde mit bis zu 50 Gästen ohne doppelte Icons und mit stabiler Zuordnung bei Refresh und Reconnect. Bei mehr als 50 Gästen sind ausgeglichene Wiederholungen erlaubt. Zeige denselben Avatar konsistent neben dem Namen in allen Spielansichten. Berücksichtige gleichzeitige Beitritte, Join-Retries und bestehende Gastidentitäten. Behalte Spiellogik und Design bei und führe passende Prüfungen aus. Kein Deployment.
```
