# RateLama: Gamification-Assets und ChatGPT-Auftrag

> **Historisch:** Dieser Auftrag beschreibt die frühere Oberfläche. Die heutige App unter `src/ui/` zeichnet Lama, Abzeichen und Illustrationen als SVG-Komponenten und lädt `public/assets/gamification/` nicht mehr; das gelieferte Paket liegt nur noch unter `spec/ratelama-gamification-assets/`.

## Verwendung

Kopiere **ab „Auftrag an ChatGPT“ bis zum Ende dieser Datei** in einen ChatGPT-Chat mit Bildgenerierung und Dateierstellung. Das dort gewünschte Ergebnis ist ein herunterladbares ZIP mit echten Bilddateien, Asset-Katalog, Vorschau und einem Einbindungsauftrag für dieses Repository.

Optional als Stilreferenzen hochladen:

- `public/brand/ratelama-icon.png`
- `public/assets/avatars/256/avatar-005-lama.png`
- `spec/ratelama-mitspieler-icons/Uebersicht.png`

Diese Markdown-Datei ist die Bestandsaufnahme und der Generierungsauftrag, **noch nicht das Bildpaket**. Die App funktioniert bereits ohne neue Assets. „Benötigt“ bedeutet hier: für eine eigene, einheitliche Bildsprache statt generischer Symbole und für die ausdrücklich beschriebenen ergänzenden Illustrationen.

---

## Auftrag an ChatGPT

Du bist Art Director, Illustrator und Asset-Produzent für **RateLama**, eine deutschsprachige Quiz-App. Erstelle ein zusammenhängendes Gamification-Bildpaket anhand der folgenden vollständigen Spezifikation.

**Liefere als Endergebnis `ratelama-gamification-assets.zip` zum Herunterladen.** Das ZIP muss die tatsächlich erzeugten Einzelbilder und eine deutsche `INTEGRATION.md` mit konkreten Anweisungen zur Einbindung enthalten. Keine bloße Bildbeschreibung, keine Sammlung von Prompts und keine Dateinamen ohne Dateien.

Nutze verfügbare Bildgenerierungs- und Dateiwerkzeuge. Falls du kein echtes ZIP oder einzelne geforderte Dateien erzeugen kannst, benenne die Einschränkung und die fehlenden Dateien ausdrücklich. Behaupte nicht, ein Paket erstellt oder geprüft zu haben, wenn es nicht existiert. Verwende keine Platzhalter als vermeintlich fertige Illustrationen und erfinde keine Downloadlinks.

### 1. Anwendung und Grenzen des Auftrags

Die Anwendung verwendet React, TypeScript, Vite, `motion/react` und `lucide-react`. Sie bietet:

- Live-Quiz auf Smartphones, mit Quizmaster-Steuerung und Präsentationsansicht.
- Quiz per Link: eigenständiges Spielen mit optional sofortiger Auflösung.
- Punktegewinne, Tempo-Bonus, Serien, Abzeichen und Rangaufstiege.
- Zwischenstände, ein dynamisches 2–1–3-Podium und gemeinsame Endstände.
- Persönlichen Quizabschluss, auch wenn die Person nicht gewonnen hat.

Die Assets ergänzen ausschließlich die Darstellung. **Keine neuen Spielregeln, Abzeichen, Währungen, Level, Multiplikatoren oder Belohnungsversprechen erfinden.** Die Bilddateien dürfen keine variable Information enthalten.

Bestehende Mechanik:

- Serienbonus ist pro neuer Runde optional, standardmäßig ausgeschaltet.
- Dritte richtige Antwort in Folge: +100 Punkte; vierte: +150; ab fünfter: jeweils +200.
- Eine falsche oder fehlende Antwort unterbricht die Serie.
- Serien und Abzeichen existieren auch ohne eingeschaltete Bonuspunkte.
- Abzeichen vergeben selbst keine Punkte.
- Es gibt genau vier fachliche Abzeichen: `FIRST_CORRECT`, `STREAK_3`, `STREAK_5`, `PERFECT`.
- `PERFECT` bedeutet vollständiger Abschluss mit ausschließlich richtigen Antworten, nicht erster Platz.
- Sofortige Auflösung ist bei neuen Link-Runden standardmäßig an, aber separat abschaltbar. Ohne Sofortauflösung bleiben Lösungen, Punkte, Serien und Abzeichen bis zum Rundenende verborgen. Historische Runden behalten ihr Verhalten.
- Ein gespeicherter Antwortversuch ist nicht automatisch eine richtige Antwort.
- Ein vorläufiger erster Platz ist kein endgültiger Sieg. Auch mehrere Personen können Rang 1 haben.

### 2. Vollständige Bestandsaufnahme

| Gamification-Stelle | Aktuelle Darstellung | Asset-Bedarf |
| --- | --- | --- |
| Lobby und Beitritt | Vorhandene Tier-Avatare, animiertes Erscheinen, Teilnehmerzähler und QR-Code | Avatare behalten; ergänzende Lobby-Illustration |
| Countdown vor der Live-Frage | `Sparkles`-Sticker und animierte Sekunden | Eigenes Bereitschaftssymbol; ergänzende Illustration ohne eingebrannte Ziffern |
| Frage und verbleibende Zeit | `Clock3`, dynamischer Timer, Hervorhebung der letzten Sekunden | Eigenes Timer-Symbol; Timer selbst bleibt Code |
| Tempo-Bonus im Link-Quiz | `Zap`, berechnete Bonuszahl und Fortschrittsbalken | Eigenes Tempo-Symbol; Zahl/Balken bleiben Code |
| Antwort wird gesendet / ausgewertet | Uhrsymbol und Statusmeldung | Timer-Symbol wiederverwenden, keine Erfolgsillustration |
| Antwort gespeichert | `Check` / `CheckCircle2`, animierte Antwortmarkierung | Eigenes neutrales Bestätigungssymbol, nicht mit „richtig“ verwechseln |
| Richtige Antwort | `Sparkles`, „Richtig!“, Punkte und Konfetti | Eigenes Richtig-Symbol und positive Lama-Illustration |
| Falsche Antwort | Im Live-Ergebnis bisher Uhrsymbol auf Pfirsich-Sticker | Eigenes Daneben-Symbol und freundlich ermutigende Illustration |
| Keine Antwort / Frist abgelaufen | Uhrsymbol und ausdrückliche Meldung | Timer-Symbol; keine falsche Erfolgsfeier |
| Punktegewinn | Zahlen-Popup und animierter Punktestand | Wiederverwendbares Punkte-Symbol; Zahlen und Popup nicht als Bild |
| Streak und beste Serie | `Flame`, Text, Fortschrittsbalken | Ruhiges und aktives Serien-Symbol |
| Serien-Meilenstein und Streak-Bonus | `Flame` im Pop-up und bei Bonuspunkten | Meilenstein-Symbol; Bonuszahl bleibt Text |
| Erreichte Abzeichen | Dasselbe `Award` für alle Abzeichen, zusätzlich Abzeichen-Pop-up | Vier unterscheidbare Abzeichen plus neutrales Fallback-Symbol |
| Persönlicher Rangaufstieg | `TrendingUp`, animiertes Banner mit Anzahl gewonnener Plätze | Eigenes Aufstiegssymbol |
| Rang verloren / gehalten | Text mit `↓` beziehungsweise `↔` | Eigene ruhige Richtungssymbole; keine zusätzliche Verlustanimation |
| Rangliste und Zwischenstand | Animierte Zeilen, vorhandene Avatare, echte Plätze/Punkte | Symbole wiederverwenden; keine Ranglisten-Gesamtgrafik |
| Podium im Zwischen- und Endstand | CSS-Podest, vorhandene Avatare, `Trophy` über Rang 1 und Feuer-Emoji bei Serien | Eigenes Krönchen; aktives Serien-Symbol statt Emoji |
| Persönlicher Zwischen-/Endstand | `Trophy`-Sticker, Punkte, Rang und Abzeichen | Eigenes Pokalsymbol |
| Persönlicher Abschluss | `Finale` mit Pokal und größerem Konfetti | Abschlussillustration für alle; Siegerillustration nur bei bestätigtem Sieg |
| Gemeinsamer Endstand | `Finale`, animiertes Podium und Rangliste | Pokalsymbol und allgemeine Abschlussillustration |
| Link-Runden: Admin- und Vollbild-Zwischenstand/Endstand | Gemeinsame Podium-/Gamification-Komponenten | Dasselbe Set, keine zweite Bildfamilie |
| Aktivierung der Spielregeln | Checkboxen und verständlicher Regeltext | Keine neuen Bilder erforderlich |
| Abbruch, Fehler, fehlende Ergebnisse | Sachliche Status-/Fehlermeldungen | Keine Erfolgsassets; vorhandene Statusdarstellung erhalten |

Relevante Integrationsorte:

- `src/components/Gamification.tsx`: `Achievements`, `ScoreAward`, `RankRise`, `Finale`, `AnimatedPoints`.
- `src/components/GameView.tsx`: `Avatar`, `Timer`, `AnswerTiles`, `Reveal`, `Ranking`, `RankChange`, `Podium`, `Leaderboard`, Lobby und Countdown.
- `src/components/QuestionLayout.tsx`: `SpeedBonus`.
- `src/components/AsyncStandingsPresentation.tsx`: Vollbild-Zwischenstände und Endstände.
- `src/CloudApp.tsx`: Link-Quiz, Antwortpause, persönlicher Abschluss und Admin-Ergebnisse.
- `src/domain/gamification.ts`: bestehende Abzeichen-IDs, Beschriftungen und Serienregeln.
- `src/components/game.css` und `src/styles.css`: bestehende Darstellung und Animationen.

Du erhältst damit Integrationsziele, nicht den vollständigen Quellcode. Erstelle eine präzise Einbindungsanleitung, aber keine angeblich bereits angewendeten Codeänderungen.

### 3. Gemeinsame Bildsprache

Freundlich, clever, leicht verspielt, für Kinder und Erwachsene passend. Eigenständige Lama-Bildsprache, keine fremden Marken, Figuren oder kopierten Künstlerstile. Klare Silhouetten, abgerundete Formen, dunkelgrüne Konturen, Creme und zurückhaltende Pastelltöne. Kein aggressives Feuer, Glücksspiel-Look, Neon, Fotorealismus oder schweres 3D.

Wenn Referenzbilder beigefügt sind, nutze sie zur visuellen Abstimmung. Ohne beigefügte Bilder arbeite anhand dieser schriftlichen Beschreibung und behaupte nicht, die Repository-Dateien gesehen zu haben:

Das bestehende Maskottchen ist ein cremefarbenes, freundlich lächelndes Lama mit langen aufrechten Ohren, flauschiger Stirnlocke und dunkelgrünen Konturen. Tier-Avatare stehen auf abgerundeten Pastellkacheln mit transparenter Umgebung. Neue Illustrationen sollen zu diesem Charakter passen, aber keinen Teilnehmer-Avatar ersetzen.

| Farbe | Wert | Verwendung |
| --- | --- | --- |
| Dunkles Grün | `#203c38` | Konturen |
| Petrol | `#21574c` | Hauptfarbe der Symbole |
| Limette | `#d8ef91` | Erfolg und positive Akzente |
| Creme | `#fffef9` | Helle Motivflächen |
| Pfirsich | `#f8d7c4` | Ermutigung und Serien |
| Lavendel | `#e3def5` | Erfolge und Abschluss |
| Helles Grün | `#eaf0df` | Ruhige Zustände |

Wichtige Formen müssen sich auf hellen Flächen und bei kleiner Anzeige erkennen lassen. Bedeutung nicht allein durch Farbe vermitteln. Symbole nach Silhouette unterscheiden, insbesondere „gespeichert“, „richtig“, „daneben“, „perfekt“ und „gewonnen“.

**In Einzelassets keinerlei Text, Buchstaben, Zahlen, Spielnamen, Punkte, Wasserzeichen oder UI-Rahmen einbacken.** Vorschau und Kontaktbogen dürfen hingegen Dateinamen und Beschriftungen enthalten. Die vorhandenen Teilnehmer-Avatare mit ihren 50 IDs sowie Logo/Favicon unverändert lassen.

### 4. Asset-Liste: 16 kompakte Symbole

Alle folgenden Symbole sind Pflicht für das individuell gestaltete Symbolset. Die Tabelle nennt die Dateistämme, ohne Dateiendung.

| ID / Dateistamm | Motiv | Einsatz / Zielgröße |
| --- | --- | --- |
| `points` | Klarer vierzackiger Belohnungsfunke, keine Münze/Währung | Punktegewinn und Punktsumme; 16–24 CSS-Pixel |
| `speed` | Abgerundeter Blitz mit kurzem Bewegungshinweis | Tempo-Bonus in `SpeedBonus` und Einleitung; 15–22 |
| `streak-idle` | Kleiner ruhiger Funke, eindeutig keine große Flamme | Serie unter drei / neue Serie; 16–22 |
| `streak-active` | Freundliche stilisierte Flamme | Aktive Serie ab drei, Streak-Bonus und Podium; 16–22 |
| `streak-milestone` | Flamme mit wenigen klaren Strahlen | Meilenstein-Pop-up, ohne eingebrannte Streak-Zahl; 20–28 |
| `rank-up` | Klarer Pfeil aufwärts mit zwei aufsteigenden Stufen | `RankRise` und Aufstiegsmarkierung; 16–24 |
| `rank-down` | Schlichter Pfeil abwärts, ohne dramatische Verlustsymbolik | Text „Plätze zurück“; 16–20 |
| `rank-steady` | Ruhiger waagerechter Doppelpfeil | Text „Platz gehalten“; 16–20 |
| `trophy` | Freundlicher Pokal mit einfachen Griffen | Persönlicher Rang-Sticker und `Finale`; 28–34 |
| `crown` | Kleine Krone mit drei abgerundeten Zacken | Alle tatsächlichen Rang-1-Teilnehmer im Podium; 24–28 |
| `answer-correct` | Häkchen in einer eigenständigen Erfolgsform mit kleinem Funken | Bestätigt richtig, Auflösung und richtige Lösung; 17–34 |
| `answer-incorrect` | Weiches Kreuz in einer runden Form, keine Warnsirene | Bestätigt falsch, „Leider daneben“; 20–34 |
| `answer-saved` | Schlichter Haken in einer Dokument-/Kartenkontur | Nur Speicherung bestätigt, ohne Aussage zur Richtigkeit; 15–34 |
| `timer` | Einfache Uhr mit gut erkennbaren Zeigern, ohne Ziffern | Countdown, Zeit, ausstehende Antwort, keine Antwort; 15–34 |
| `ready` | Zwei klare Bereitschafts-/Aha-Funken, vom Punkte-Symbol unterscheidbar | Countdown-Sticker und „Bereit für nächste Frage?“; 24–34 |
| `badge-generic` | Neutrales Auszeichnungsband ohne Leistungszahl | Fallback bei unbekannter Abzeichen-ID; 16–20 |

Technik: pro Symbol **eine echte SVG-Vektordatei** mit quadratischem `viewBox="0 0 64 64"` und transparente PNG-Exporte desselben Motivs in **64×64 und 128×128**. Keine Illustrationen in winzige Icons pressen. Prüfe Erkennbarkeit bei 16, 22 und 34 CSS-Pixeln.

### 5. Asset-Liste: vier fachliche Abzeichen

Die fachlichen IDs exakt erhalten. Jede Abzeichenform muss auch ohne Farbe von den anderen unterscheidbar sein. Ein eigener Rahmen ist hier Teil des Abzeichens erlaubt, keine zusätzliche UI-Karte.

| Fachliche ID | Dateistamm | Deutscher Name / Bedeutung | Motiv |
| --- | --- | --- | --- |
| `FIRST_CORRECT` | `first-correct` | Erstes Aha! – mindestens eine richtige Antwort | Abgerundetes Abzeichen mit Glühbirne und einem Aha-Funken |
| `STREAK_3` | `streak-3` | Dreier-Serie – beste Serie mindestens drei | Eigenständige Bandform mit drei klaren Funken, keine gedruckte Ziffer |
| `STREAK_5` | `streak-5` | Unaufhaltsam – beste Serie mindestens fünf | Auffälligeres Flammen-Abzeichen, klar andere Silhouette als Dreier-Serie |
| `PERFECT` | `perfect` | Perfekte Runde – vollständig und alles richtig | Rosetten-/Siegelmotiv mit Häkchen und Stern; keine Siegerkrone |

Technik: pro Abzeichen **eine echte SVG-Vektordatei** mit `viewBox="0 0 64 64"` und transparente PNG-Exporte in **256×256 und 512×512**. Kleine Anzeige als Listenicon: 16–20 CSS-Pixel; Pop-up: 18–32; größere Vorstellung des Abzeichens höchstens 64–96. Motive entsprechend einfach halten. Keine gesperrten/grauen Varianten nötig: die App zeigt tatsächlich erreichte Abzeichen.

### 6. Asset-Liste: sechs ergänzende Lama-Illustrationen

Diese Illustrationen sind eine **zusätzliche visuelle Aufwertung**, nicht die Behebung fehlender Bilder. Sie sind Teil des gewünschten ZIP, werden aber sparsam ergänzt: auf dem Smartphone höchstens eine kompakte Illustration pro Ansicht. Symbol und Illustration nicht beide groß und redundant darstellen.

| ID / Dateistamm | Motiv | Vorgesehene Einbindung |
| --- | --- | --- |
| `lobby-welcome` | Ein freundliches Lama lädt mit offener Geste zum gemeinsamen Quiz ein | Neue, kleine Ergänzung der Lobby; nicht über QR-Code oder Spielcode |
| `countdown-ready` | Dasselbe Lama aufmerksam und startbereit, mit wenigen Bereitschaftsfunken | Optionale Ergänzung des Countdowns; Sekunden bleiben daneben als echter Text |
| `answer-celebrate` | Dasselbe Lama freut sich über ein Aha, mit wenigen Sternchen | Ergänzung der bestätigten richtigen Antwort; keine eingebrannte Punktzahl |
| `answer-encourage` | Dasselbe Lama freundlich und gelassen, „weiter geht’s“-Haltung | Falsche Antwort oder verpasste Frage; keine Beschämung, Tränen oder Schadenfreude |
| `finale-participant` | Dasselbe Lama feiert den gemeinsamen Abschluss | Allgemeines Finale und persönlicher vollständiger Abschluss ohne bestätigten Sieg |
| `finale-winner` | Dasselbe Lama mit kleiner Krone und Pokal | Nur persönlicher, bestätigter endgültiger Rang 1; keine „1“ im Bild |

Technik: pro Motiv **zwei transparente PNG-Dateien in 512×512 und 1024×1024**, aus derselben Master-Illustration abgeleitet. Transparente Umgebung, keine Fotohintergründe oder Hintergrundkachel. Motiv mittig und vollständig innerhalb des Quadrats mit ungefähr 8–12 % Sicherheitsabstand. Kein Abschneiden von Ohren, Krone, Pokal oder Händen. Darstellung in der App mit `object-fit: contain`.

Richtgrößen: 64–96 CSS-Pixel in kompakten persönlichen Ansichten, 96–160 in Lobby/Countdown, bis 240 in ausreichend großen Präsentationsansichten. Eine Illustration darf auf engem Smartphone-Layout kleiner werden oder entfallen; Bedeutung und Information bleiben im Text.

### 7. Was NICHT als Bild erzeugt werden soll

- Keine neuen 50 Tier-Avatare und kein neues Branding.
- Keine Countdown-Bilder für jede Sekunde.
- Keine Bilder für konkrete Punkte, Rangnummern, Bonusbeträge oder Spielerzahlen.
- Keine Gesamtbilder von Zwischenstand, Rangliste oder 2–1–3-Podium.
- Keine QR-Codes oder Spielcodes: diese entstehen weiterhin dynamisch.
- Keine fertigen Antwortkacheln mit A/B/C/D oder Lösungstexten.
- Keine Screenshots als Ersatz für funktionierende UI.
- Keine GIFs, Videos, Lottie-Dateien oder Sprite-Sheets erforderlich.
- Keine Konfetti-Bildwolke: `AnswerCelebration` erzeugt bereits 18 CSS-Partikel, im Finale 48. Das bleibt leichtgewichtig, endlich und abschaltbar.
- Kein Bild für jeden Serienwert: ein aktives Symbol genügt, der tatsächliche Wert steht daneben.
- Keine zusätzlichen Bilder für Buttons wie Weiter, Vollbild, Aktualisieren oder Abbrechen. Vorhandene funktionale Icons bleiben.

### 8. Dateiformate und tatsächlicher Lieferumfang

Es sind **26 eigenständige Motive**, nicht 26 Varianten derselben Grafik:

- 16 Symbole: 16 SVG + 32 PNG.
- 4 Abzeichen: 4 SVG + 8 PNG.
- 6 Illustrationen: 12 PNG.
- Insgesamt **20 SVG und 52 PNG = 72 produktive Asset-Dateien**, zusätzlich Kontaktbogen und Paketdokumentation.

SVG: echte Pfade/Formen, transparente Zeichenfläche, keine eingebetteten Rasterbilder, Scripts, Eventhandler, `foreignObject`, externen URLs, Schriften oder `<text>`-Elemente. Keine „PNG in SVG-Hülle“. PNG: RGBA mit echtem Alpha-Kanal; kein eingebranntes Schachbrett, kein weißer Hintergrund als angebliche Transparenz. Kleine Symbole müssen auch direkt aus SVG exportierbar sein.

Alle Dateinamen klein, ASCII und mit Bindestrichen. Die verschiedenen Auflösungen eines Motivs müssen denselben Bildinhalt haben. Illustrationen tatsächlich als Illustrationen gestalten; SVGs für einfache Symbole sauber konstruieren, statt unsauberes automatisches Nachzeichnen komplexer Rasterbilder als Vektorsystem auszugeben.

### 9. Exakte ZIP-Struktur

Das ZIP hat keinen zusätzlichen äußeren Verpackungsordner. Die folgende Struktur beginnt direkt an seiner Wurzel. `<id>` steht jeweils für alle Dateistämme der zugehörigen Liste:

```text
public/
  assets/
    gamification/
      icons/
        <id>.svg
        png/
          64/<id>.png
          128/<id>.png
      badges/
        <id>.svg
        png/
          256/<id>.png
          512/<id>.png
      illustrations/
        512/<id>.png
        1024/<id>.png
manifest.json
INTEGRATION.md
ASSET-LISTE.md
HERKUNFT.md
vorschau.html
kontaktbogen.png
```

`manifest.json` enthält genau 26 Einträge und `version: 1`. Pro Eintrag: `id`, `kind` (`icon`, `badge`, `illustration`), deutschen Titel, Motivbeschreibung, Dateipfade und vorgesehene Komponenten/Verwendungen. Abzeichen erhalten zusätzlich `badgeId` mit der fachlichen ID. Pfade im Manifest sind ZIP-relative Pfade mit `public/assets/gamification/...`. Für PNGs die Pixelgröße je Datei nennen; für SVG den `viewBox`. Keine erfundenen Dateien referenzieren.

`ASSET-LISTE.md` enthält alle 26 Motive, ihre konkreten Dateien und Einsätze. `HERKUNFT.md` dokumentiert tatsächlich verwendete Werkzeuge und gegebenenfalls Referenzen; nicht vorhandene Referenzen oder rechtliche Garantien nicht erfinden.

`vorschau.html` ist eine lokal öffnende HTML/CSS-Galerie mit relativen Bildpfaden, Beschriftung, transparenter Vorschau auf heller und dunkler Fläche und Größenbeispielen. Keine CDNs, Tracker, externen Fonts oder Netzwerkanfragen. `kontaktbogen.png` zeigt alle 26 tatsächlich gelieferten Motive mit IDs auf hellem Hintergrund.

### 10. Pflichtinhalt von INTEGRATION.md

Schreibe den folgenden Einbindungsauftrag für den Coding-Agenten konkret aus. Er muss ohne diesen Chat verständlich sein und Asset-Zuordnung, Regeln und Abnahme enthalten.

**Ablage und Laden**

1. Zuerst vorhandene Repository-Anweisungen und aktuelle Komponenten lesen. Das Paket nicht als ungeprüften Quellcode ausführen.
2. Nur `public/assets/gamification/` in die produktive Asset-Struktur kopieren. Manifest, Dokumentation und Vorschau können unter `spec/ratelama-gamification/` liegen; die Anwendung lädt nicht aus `spec/`.
3. Die App referenziert Pfade ohne `public/`, zum Beispiel `assets/gamification/icons/rank-up.svg`. Wie bei `Avatar` in `GameView.tsx` `import.meta.env.BASE_URL` voranstellen, damit Subpfad-Deployments funktionieren. Keine externen Bild-URLs.
4. Eine kleine typisierte Asset-Zuordnung für bekannte Symbol-IDs und die vier Abzeichen verwenden; bei Bedarf eine gemeinsame Bildkomponente. Das wäre neue Integrationslogik, kein bereits vorhandener Katalog. Keine unkontrollierten Pfade aus Server-Strings bauen.
5. Symbole und Abzeichen bevorzugt als SVG über `<img>` laden, ohne SVG-Inhalt als HTML einzufügen. PNGs als lokale Alternative/Exporte mitliefern. Für Illustrationen 512er-Quelle mit 1024er-`srcSet` für 2x verwenden. Nicht vorsorglich alle Bilder in voller Auflösung laden.
6. Feste Anzeigeabmessungen oder `aspect-ratio: 1` gegen Layoutsprünge. `object-fit: contain`, keine abgeschnittenen Motive.
7. Bei unbekannter Abzeichen-ID bestehende Textbeschriftung behalten und `badge-generic` verwenden. Bei Bildladefehler bisherigen lokalen Lucide-/SVG-Fallback und Status behalten; fehlende Assets erkennbar melden, keine Endlosschleife oder externe Ersatzquelle.

**Zuordnung zu bestehenden Komponenten**

| Ziel | Einbindung |
| --- | --- |
| `Achievements` | `streak-idle` unter drei, `streak-active` ab drei; vier Abzeichen über ihre IDs statt überall `Award`; Fortschrittsbalken/Text erhalten |
| `ScoreAward` | `points` beim Gewinn, `streak-active` beim echten Bonus, `streak-milestone` im Serien-Pop-up; Abzeichen-Pop-up zeigt das konkret erreichte Abzeichen |
| `RankRise` | `rank-up` statt `TrendingUp`; Anzahl gewonnener Plätze und bestehende Ereignissperre erhalten |
| `RankChange` | `rank-up`, `rank-down`, `rank-steady` neben unverändertem Text; keine Bewegung für verlorene Plätze hinzufügen |
| `Podium` | `crown` für alle dargestellten Spieler mit tatsächlichem Rang 1; `streak-active` statt Feuer-Emoji; Avatare und dynamische Podesthöhen behalten |
| Persönliche `Ranking` | `trophy` als Rang-Sticker; reale Rangzahl bleibt Text, keine Gewinnillustration für beliebige Platzierungen |
| `Finale` | `trophy` und sparsame Abschlussillustration; Siegerillustration nur bei fachlich bestätigtem Sieg, allgemeine Illustration sonst |
| `Reveal` | Richtige Antwort: `answer-correct` und optional `answer-celebrate`; falsche: `answer-incorrect` und optional `answer-encourage`; keine Antwort: `timer`, ausdrücklich keine Erfolgsfeier |
| `AnswerTiles` / Antwortfeedback | Bestätigte Speicherung: `answer-saved`; ausstehende Speicherung: `timer`; nicht als „richtig“ vorwegnehmen |
| `Timer` / Countdown | `timer` für kompakte Zeitangabe; `ready` im Bereitschaftssticker; optional `countdown-ready`; echte Zahlen und Fristlogik erhalten |
| `SpeedBonus` | `speed` statt `Zap`; laufende Bonuszahl und Balken nicht verändern |
| Lobby | Optional `lobby-welcome` ergänzen; bestehende Avatare, Namen, Teilnehmerzähler, Code und QR-Code nicht verdrängen |
| Link-Quiz in `CloudApp.tsx` | Dieselben Symbole/Illustrationen in Antwortpause und persönlichem Abschluss, mit Berücksichtigung der Reveal-Einstellung |
| Link-Quiz-Admin und `AsyncStandingsPresentation` | Änderungen an gemeinsamen Komponenten wiederverwenden; gleichwertige Darstellung in normaler Ansicht und Vollbild |

**Wichtige semantische Fälle**

- In der Link-Quiz-Antwortpause zeigt der aktuelle Sticker ein Häkchen bei frisch gespeicherter Antwort, auch wenn die Auflösung „Leider daneben“ ergibt. Bei der Asset-Einbindung anhand des bestätigten Ergebnisses wählen: richtig → `answer-correct`, falsch → `answer-incorrect`; ohne sichtbare Auflösung → ausschließlich `answer-saved` oder `ready`. Die Bestätigung nicht als Richtigkeit darstellen.
- Bei ausgeschalteter Sofortauflösung und vor Rundenende keine erfolgsabhängigen Bilder, Serienzustände oder erreichten Abzeichen zeigen, die versteckte Ergebnisse verraten.
- Persönlicher vollständiger Abschluss einer noch aktiven Link-Runde bekommt `finale-participant`, auch bei vorläufigem Rang 1. Erst endgültiger bestätigter Rang 1 erlaubt `finale-winner`.
- Gemeinsame Endstandsansichten bekommen die allgemeine Abschlussillustration; die Krone kennzeichnet Rang 1 im Podium, ohne alle Betrachter als Sieger anzusprechen.
- `PERFECT` niemals anhand von Rang, Punktzahl oder einer bloß ununterbrochenen Teilserie im Browser vergeben.
- Bei Gleichstand echte Serverränge respektieren; keine künstlichen Plätze 1/2/3 aus der Listenposition ableiten.
- Falsche Antworten, Abbruch, unvollständige Teilnahme, Verbindungsfehler und fehlende Ergebnisse nicht mit einer Siegerillustration oder neuer Punktefeier darstellen.

**Animation, Barrierefreiheit und unverändertes Verhalten**

- Bestehende Animationen über `motion/react`, CSS und `AnswerCelebration` erhalten, keine neue Animationsbibliothek oder Dauerschleifen hinzufügen.
- Bilder selbst sind statisch; kurze Bewegung am vorhandenen Wrapper, nicht in GIFs. Keine zusätzliche Feier bei Refresh/Reconnect oder mehrfach zugestellten gleichen Ergebnissen.
- Bestehende Ereignis-IDs und `claimGameEvent` nicht durch bildabhängige Trigger ersetzen.
- Bei `prefers-reduced-motion: reduce` keine Partikel, Zählerfahrt, Positionsbewegung, Pulsieren oder Rotieren. Statische Motive und tatsächliche Ergebnistexte bleiben sichtbar.
- Bilder neben vorhandenem Text dekorativ behandeln (`alt=""`, bei Bedarf `aria-hidden="true"`); Rang, Punkte, Lösung, Serienwert und Abzeichenname bleiben als zugänglicher Text erhalten.
- Vorhandene `role="status"`-Meldungen und Fokusführung behalten. Keine zusätzlichen doppelten Live-Ansagen durch Bilder.
- Startseite, Branding, Gastidentität, Avatare, Punkteberechnung, Backend, GraphQL-Verträge, gespeicherte Abzeichen und historische Regeln nicht verändern.
- Keine neuen Abhängigkeiten, externen Dienste, Tracking, automatische Commits, Pushes oder Deployments.

**Abnahme im Repository**

- Alle 26 Motive korrekt zugeordnet; keine kaputten Pfade, fehlenden Varianten, externen Requests oder Layoutsprünge.
- Live und Link-Quiz prüfen: richtig, falsch, keine Antwort, gespeicherte aber noch nicht aufgelöste Antwort, Serienbonus an/aus, vier Abzeichen.
- Sofortauflösung an/aus, Zwischenstand, Rangaufstieg/-verlust/-gleichstand, Rang-1-Gleichstand, endgültiger Sieg und normaler Abschluss prüfen.
- Kein neuer Punkte-/Abzeichen-Event beim Neuladen oder Reconnect.
- Persönliche Ansichten bei 320/390/430 Pixel Breite, Admin/Desktop und Präsentation bei 1920 Pixel Breite sowie Reduced Motion prüfen.
- Bisherige lokale Fallbacks bei fehlender/unbekannter Grafik prüfen.
- Vorhandene Typecheck-, Lint-, Build- und passende Browserprüfungen ausführen; nichts deployen.

Beende `INTEGRATION.md` mit diesem kopierfertigen Startauftrag:

```text
Integriere spec/ratelama-gamification/INTEGRATION.md und die gelieferten Assets in das bestehende RateLama-Repository. Prüfe zuerst die aktuellen Komponenten und Repository-Anweisungen. Verwende die individuellen Symbole, die vier Abzeichen mit unveränderten fachlichen IDs und sparsam die sechs Lama-Illustrationen. Berücksichtige Live-Quiz, Link-Quiz, Antwortpause, Zwischenstände, Podium, persönlichen Abschluss und Vollbild-Endstand. Erhalte Serverwertungen, Reveal-Schutz, Gleichstände, bestehende Ereignissperren, Avatare, Fokusführung und Reduced Motion. Keine neuen Spielregeln oder Abhängigkeiten, kein Commit, Push oder Deployment. Prüfe Darstellung und vorhandene passende Tests und melde verbleibende Einschränkungen ausdrücklich.
```

### 11. Prüfung des ZIP vor der Ausgabe

Prüfe mit verfügbaren Dateiwerkzeugen tatsächlich:

1. Genau 20 lesbare SVGs und 52 lesbare PNGs unter `public/assets/gamification/`; alle Pflichtmotive vorhanden.
2. PNG-Abmessungen, Alpha-Kanal und echte transparente Umgebung; keine angeschnittenen Motive.
3. SVGs enthalten echte Vektorgeometrie, keine Rastereinbettung, Scripts, externen Ressourcen oder Texte.
4. Manifest hat 26 eindeutige Einträge; jeder Dateipfad existiert und Größe/Typ stimmen.
5. Dateinamen und Ordner entsprechen exakt dieser Spezifikation; Auflösungsvarianten gehören zum selben Motiv.
6. Vorschau und Kontaktbogen verwenden die tatsächlich finalen Assets und lassen alle Motive erkennen.
7. Einbindungsanleitung ist vorhanden und unterscheidet Speicherung/Richtigkeit, perfekten Abschluss/endgültigen Sieg und vorläufigen/finalen Rang.

Gib abschließend den echten ZIP-Download und eine kurze Inhaltsangabe mit tatsächlicher Motiv-/Dateianzahl sowie gegebenenfalls offenen Einschränkungen aus. Keine vollständigen Base64-Bilddaten in den Chat ausgeben.
