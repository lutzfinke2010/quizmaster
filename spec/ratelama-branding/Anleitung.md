# Copilot-Spezifikation: RateLama Branding einbinden

## Verwendung

Entpacke diesen Ordner unter `Spec/ratelama-branding/` im bestehenden Repository. Verwende die vorhandene Schreibweise des Spec-Ordners, falls diese abweicht.

## Ziel

Die bestehende Quiz-App erhält den sichtbaren Namen **RateLama** und die beigefügten Markenbilder. Die vorgesehene Domain lautet **ratelama.de**. Behalte die bestehende Gestaltung der Startseite und die Funktionalität bei. Dieses Paket ergänzt den bereits vorhandenen Spielansichten-Designauftrag.

## Dateien

| Datei | Bedeutung |
| --- | --- |
| `assets/ratelama-icon-original.png` | Quadratisches Lama-Motiv auf limettenfarbener Kachel, transparente Umgebung; Quelle für App-Icon und Favicon. |
| `assets/ratelama-logo-original.png` | Horizontales Logo mit Lama-Symbol und Schriftzug RateLama, transparenter Hintergrund; für Seitenkopf und größere Markenplatzierungen. |

Die Dateien sind PNG-Rasterbilder, keine SVG-Vektoren. Originale unverändert aufbewahren und Produktivvarianten separat erzeugen. Keine PNG-Datei nur in `.svg` oder `.ico` umbenennen.

## Gestaltungsrichtung

- Warmes Creme, Dunkelgrün und Limette passen zur vorhandenen Startseite.
- Visueller Appname: `RateLama`, genau mit großem R und L.
- Domain in passenden Hinweisen: `ratelama.de`.
- Bestehenden Claim „Einfach. Zusammen. Spielen.“ bei Bedarf als echten HTML-Text erhalten, nicht zusätzlich in das Bild einbauen.
- Keine neue Farbwelt und keine Änderung des Spielablaufs aus diesem Auftrag ableiten.
- Das vollständige Logo enthält bereits Symbol und Schriftzug. Daneben weder einen zweiten Lama-Kopf noch einen zweiten identischen Schriftzug anzeigen.

## Umsetzung

1. Lies Repository-Anweisungen, `AGENTS.md`, Copilot-Instruktionen und vorhandene Spezifikationen. Ermittle Framework, Asset-Pipeline, Seitenkopf, HTML-Metadaten, Manifest und vorhandene PWA-/Service-Worker-Einstellungen.
2. Suche nach bisherigen sichtbaren Appnamen wie `QuizRush` und passe relevante Benutzeroberflächen und Seitentitel auf RateLama an. Technische Identifikatoren wie AWS-Ressourcennamen, Cognito-Clients, Datenmodelle, Storage-Keys, API-Namen, Manifest-ID und Routen nicht pauschal umbenennen. Bestehende Sitzungen und Infrastruktur erhalten.
3. Kopiere benötigte Bilddateien aus diesem Spec-Ordner in die vorhandene produktive Asset-Struktur. Die laufende App darf nicht aus `Spec/` laden.
4. Binde das horizontale Logo auf der Startseite und in geeigneten Desktop-Kopfzeilen ein. Ausgangsrichtung: etwa 180–230 CSS-Pixel breit, proportional und mit sinnvoller Maximalhöhe. Die exakte Größe am vorhandenen Layout ausrichten.
5. Verwende bei engen mobilen Spielkopfzeilen vorzugsweise das einzelne Icon, etwa 32–40 CSS-Pixel groß. Wenn zusätzlich der Name sinnvoll ist, verwende daneben echten HTML-Text. Kein breites Logo so stark verkleinern, dass der Name unlesbar wird.
6. Seitenverhältnis erhalten, kein Strecken und kein unabsichtliches Abschneiden der Ohren. Intrinsische Bildmaße bzw. `aspect-ratio` vorsehen, um Layoutsprünge zu verhindern. Die hochauflösenden Originale für kleine Anzeigen nicht unnötig vollständig ausliefern; passende optimierte Ableitungen erzeugen.
7. Die transparenten Ränder und mögliche feine Randartefakte der generierten PNGs beim Ableiten visuell prüfen. Bei Bedarf nur die technische Freistellung und den Beschnitt einer Kopie bereinigen; Lama, Ausdruck und Logoform nicht neu zeichnen oder stilistisch verändern. Keine weiße oder schwarze Matte hinzufügen.
8. Falls vorhanden, Appname im Web-App-Manifest als `RateLama` und `short_name` passend aktualisieren. Keine neue PWA oder Service-Worker-Architektur allein für diesen Auftrag einführen.
9. Bestehende Datenschutz-/Impressumsseiten funktional erhalten. Nur sichtbare Produktbezeichnungen anpassen; Betreibername und andere rechtliche Angaben nicht ändern oder erfinden.
10. Domain nur dort eintragen, wo sie tatsächlich die konfigurierte öffentliche Basisadresse ist. Keine DNS-, Hosting-, AWS- oder OAuth-Änderung und kein Deployment durchführen. Notwendige Konfigurationshinweise im Abschlussbericht nennen.

## Favicon und App-Icons

Erzeuge aus der Icon-Quelldatei mithilfe der vorhandenen Bildwerkzeuge echte skalierte Dateien in folgenden Größen. Diese Ableitungen werden durch Copilot im Repository erzeugt; im Paket liegen die beiden hochauflösenden Originale.

| Zieldatei | Größe | Verwendung |
| --- | --- | --- |
| `favicon-16x16.png` | 16 × 16 px | Kleine Browserdarstellung |
| `favicon-32x32.png` | 32 × 32 px | Browser-Favicon |
| `favicon.ico` | 16, 32 und 48 px als echte ICO-Einträge | Klassisches Browser-Favicon |
| `apple-touch-icon.png` | 180 × 180 px | iOS-Startbildschirm |
| `icon-192.png` | 192 × 192 px | Manifest, falls vorhanden |
| `icon-512.png` | 512 × 512 px | Manifest, falls vorhanden |

- Beim Skalieren Kantenqualität und Lesbarkeit bei echten 16/32 px prüfen. Bei diesen Größen die Wortmarke nicht verwenden.
- Für iOS eine solide passende Hintergrundfläche ohne transparente Randbereiche ableiten. Das Betriebssystem übernimmt die äußere Maskierung.
- Normale Manifest-Icons nicht unkontrolliert als `maskable` deklarieren. Falls eine Maskable-Variante benötigt wird, eine gesonderte Datei mit ausreichender Safe Area erstellen und mit passenden Masken prüfen.
- Bestehende Favicon-Links aktualisieren und konkurrierende veraltete Einträge entfernen, soweit diese zur App gehören.
- Für ersetzte Icons neue eindeutige URLs oder die vorhandene Asset-Versionierung nutzen, damit Browser inklusive Safari nicht weiterhin die alten Dateien ausliefern. Nicht das pauschale Löschen aller Browserdaten als Produktlösung vorsehen.
- Metadaten wie Seitentitel und gegebenenfalls vorhandene Open-Graph-Bezeichnungen aktualisieren. Ein transparentes Logo nicht ungeprüft als vollständiges Social-Preview-Bild verwenden; dies ist ein eigener Gestaltungsfall und kein Bestandteil dieses Pakets.

## Barrierefreiheit und Darstellung

- Verlinktes Logo mit zugänglicher Bezeichnung wie „RateLama – Startseite“ versehen.
- Wenn neben dem Bild bereits der identische sichtbare Name steht, redundante Screenreader-Ausgabe vermeiden, z. B. dekoratives Icon mit leerem `alt`.
- Logo auf hellem Creme einsetzen. Für bestehende dunkle Flächen bei Bedarf eine passende helle lokale Unterlage nutzen; die dunkle Wortmarke nicht auf dunkelgrünem Hintergrund verschwinden lassen.
- Vorhandene Tastaturfokusse und Linkziele erhalten. Logo darf keine Navigation überdecken.
- Bei 320, 390 und 430 px Breite sowie Desktop prüfen: keine abgeschnittene Wortmarke, keine verzerrten Bilder, keine horizontale Scrollleiste und kein springender Header.

## Abnahme

- Der sichtbare Name lautet konsistent RateLama; technische Backend-Identitäten funktionieren unverändert.
- Auf der Startseite ist das horizontale Logo eingebunden und die bestehende visuelle Gestaltung erkennbar erhalten.
- Kompakte mobile Ansichten verwenden das Icon sinnvoll und gut lesbar.
- Favicon, Touch-Icon und gegebenenfalls Manifest referenzieren tatsächlich existierende Bilddateien.
- Ableitungen haben die angegebenen Maße und korrekten Dateiformate.
- Keine neuen externen Font-, Bild-, Tracking- oder Avatar-Dienste.
- Vorhandene passende Lint-/Typecheck-/Build-Prüfungen ausführen. Visuelle Prüfung auf Desktop und Smartphone, soweit eine Browser-Testumgebung vorhanden ist. Keine unnötigen Tests schreiben, die lediglich Bildpfade spiegeln.
- Abschließend geänderte Dateien, erzeugte Icongrößen, ausgeführte Prüfungen und offene Punkte knapp benennen.

## Startauftrag für Copilot

```text
Setze Spec/ratelama-branding/Anleitung.md im bestehenden Projekt um. Verwende das mitgelieferte Logo und Icon unter assets/ für das sichtbare Branding als RateLama. Erzeuge die beschriebenen Favicon-/App-Icon-Ableitungen und binde sie in die vorhandene Asset-Struktur und Metadaten ein. Behalte die Gestaltung der Startseite, Spiellogik und technischen Backend-Identitäten bei. Beachte Repository-Anweisungen und prüfe die Darstellung auf Desktop und Smartphone. Beginne nach einer kurzen Bestandsaufnahme direkt mit der Umsetzung; kein Deployment und keine Infrastrukturänderungen.
```
