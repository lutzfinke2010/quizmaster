# Änderungs-Spec: Quiz zum Mitmachen – Zahlencode, QR-Code und Einladung

## Ziel

Die veröffentlichten, bisher als „asynchron“ bezeichneten Quizrunden erhalten eine verständliche Bezeichnung und einen einfachen Zugang. Der Admin kann eine Runde per QR-Code, kurzer URL oder Zahlencode teilen. Zusätzlich gibt es eine schöne, bildschirmfüllende Einladungsansicht, die sich für einen Screenshot und die Übernahme in eine Präsentation eignet.

Die beigefügte Datei `referenzen/bisherige-rundenansicht.png` zeigt den Ausgangspunkt: lange technische Teilnahmelinks, viel Karteninhalt und der Untertitel „Asynchron spielen“. Sie ist die Ist-Referenz, nicht das Zielbild.

Dieses Paket unter `Spec/ratelama-einladung-beitritt/` ablegen; vorhandene Schreibweise des Spec-Ordners berücksichtigen. Es ergänzt die bisherigen Async- und UI-Update-Specs. Bei Widersprüchen haben die hier geänderten Bezeichnungen und Beitrittswege Vorrang. Spielregeln, aktuelle Wertung, direkter Fragenwechsel, Deadline, Gastidentität und Admin-Ergebnisse bleiben erhalten.

## 1. Verständliche Benennung

Verwende in der sichtbaren Oberfläche folgende Begriffe konsistent:

| Stelle | Neuer Text |
| --- | --- |
| Modus | **Quiz zum Mitmachen** |
| Kurze Erklärung | **Spiele in deinem Tempo.** |
| Modusvergleich | „Live-Quiz – alle spielen gleichzeitig“ / „Quiz zum Mitmachen – jeder spielt in seinem Tempo“ |
| Verwaltungsbereich | **Veröffentlichte Quizrunden** |
| Untertitel der Verwaltung | „Teile deine Quizrunde. Alle spielen in ihrem Tempo bis zum angegebenen Ende.“ |
| Veröffentlichungsaktion | **Quizrunde veröffentlichen** |
| Fristbeschriftung | **Mitspielen bis** |
| Zugangscode | **Quiz-Code** |
| Anzeigeaktion | **Einladung anzeigen** |

- „Asynchron“, „Async“, „AsyncQuiz“ und „Deadline“ aus den für Admins und Gäste sichtbaren Texten dieses Bereichs entfernen. Stattdessen je Kontext „Quiz zum Mitmachen“, „Quizrunde“ oder „Mitspielen bis“ verwenden.
- Auch Dialoge, Meldungen, Formularbeschriftungen, Seitentitel und zugängliche Beschriftungen prüfen. Keine bloße Ersetzung einzelner Überschriften.
- Technische Moduswerte wie `ASYNC`, Backend-Modelle, existierende URLs, Berechtigungen und gespeicherte Daten nicht allein wegen der Benennung umbenennen. Keine Infrastruktur-Migration für ein Textupdate.
- Der Quiztitel bleibt der vom Admin gewählte Titel, z. B. „Tierisch unglaubliche Fakten“.

## 2. Drei gleichwertige Beitrittswege

Alle folgenden Wege führen zur **gleichen veröffentlichten Runde** und verwenden den vorhandenen Start-/Wiederaufnahmeablauf:

1. QR-Code scannen.
2. Kurzen Link öffnen.
3. Auf der RateLama-Start-/Beitrittsseite den Quiz-Code eingeben.

Keine zusätzliche Kopie der Veröffentlichung und kein separater Versuch pro Zugangsweg. Derselbe wiedererkannte Gast setzt beim Wechsel zwischen QR, Link und Code seinen bestehenden Versuch fort.

### Quiz-Code

- Standard: sechs zufällige Dezimalziffern, z. B. `482619`, lesbar dargestellt als **482 619**.
- Der Code wird serverseitig bei Veröffentlichung erzeugt, eindeutig reserviert und unveränderlich dieser Runde zugeordnet.
- Code als Zeichenkette behandeln. Führende Nullen erhalten, z. B. `004 281`.
- Zur Eingabe `type="text"` mit `inputmode="numeric"` und passender Validierung verwenden; nicht `type="number"` oder `parseInt`, die führende Nullen verlieren können.
- Eingefügte Leerzeichen bzw. unkritische Gruppierungstrennzeichen normalisieren. Andere Zeichen und falsche Länge verständlich ablehnen.
- Bestehende Live-Spielcodes berücksichtigen. Die gemeinsame Beitrittsseite muss eindeutig auflösen können, ob der Code ein Live-Quiz oder eine veröffentlichte Quizrunde bezeichnet.
- Existiert bereits eine geeignete Codevergabe, diese als gemeinsame Funktion erweitern. Keine zwei unabhängigen Vergabesysteme mit kollidierenden Codes aufbauen.
- Wenn Live- und veröffentlichte Runden denselben normalisierten Codebereich nutzen, muss die Eindeutigkeit über beide Modi atomar gesichert sein. Gleichzeitiges Veröffentlichen/Starten darf keinen doppelt zugeordneten Code erzeugen.
- Kollisionen über bedingtes Reservieren und begrenzte Wiederholungsversuche behandeln; kein unbeschränktes Retry und keine halb veröffentlichte Runde ohne nutzbaren Zugang.
- Eine einmal für eine veröffentlichte Runde verteilte Code-URL darf später nicht auf eine andere Runde zeigen. Solche Codes nicht neu vergeben; bestehende Reservierungs-/Archivmechanismen passend erweitern. Bei endgültiger Datenlöschung nur die minimal nötige Nichtwiedervergabe-Information erhalten, ohne Teilnehmerdaten aufzubewahren. Falls der Codebereich erschöpft ist, klar fehlschlagen und eine spätere Codeverlängerung vorsehen statt alte Einladungen umzuleiten.
- Codevergabe und Veröffentlichung idempotent behandeln: Retry nach verlorenem Response erzeugt weder eine zweite Runde noch einen anderen Code.

### Kurzer Link

- Kanonische kurze Form bevorzugt `https://ratelama.de/q/482619` (Schema-/Codebeispiel, keine echte Runde).
- Tatsächliche öffentliche Basisadresse aus der Umgebung verwenden. Lokale/Preview-Instanzen dürfen nicht unbemerkt Produktionslinks erzeugen.
- Den kurzen Link als Standard bei „Link kopieren“, QR-Code, Einladung und veröffentlichter Karte verwenden. Keine UUID oder lange zufällige Tokenfolge in die neue Standarddarstellung übernehmen.
- Die sichtbare Kurzform darf ohne Schema erscheinen, der kopierte Link muss vollständig und korrekt sein.
- Bestehende lange Links bleiben gültig und lösen weiterhin auf dieselbe Runde auf. Nicht löschen, nicht ungültig machen und nicht als neue Teilnahme behandeln.
- Wenn die vorhandene Route `/q/:token` bereits genutzt wird, die Auflösung alter Tokens und neuer Zahlencodes eindeutig und rückwärtskompatibel ergänzen. Keine irrtümliche Interpretation einer bereits vergebenen alten Referenz.
- Ein Direktaufruf und Browser-Reload der kurzen URL müssen über das bestehende Hosting funktionieren, nicht nur die Navigation innerhalb der SPA.

### Gemeinsame Beitrittsseite

- Die vorhandene Aktion „Mitspielen“ bzw. „Spiel beitreten“ um die neue Auflösung erweitern.
- Eingabe „Quiz-Code“ und Aktion „Mitspielen“; die Teilnehmer müssen ihren Modus nicht vorher kennen oder auswählen.
- Live-Code führt wie bisher zur Live-Runde; Code einer veröffentlichten Runde führt zum selbstständigen Start bzw. Fortsetzen.
- Nach erfolgreicher Codeauflösung den konkreten Titel und das Ende anzeigen. Die vorhandene Startbestätigung bleibt zulässig und dient dem bewussten Beginn des Versuchs und seiner Zeitmessung.
- Weder bloßes Codeprüfen noch Linkaufruf, QR-Aufruf oder Linkvorschau-Bot starten einen Versuch bzw. dessen ersten Frage-Timer.
- Laufender eigener Versuch wird wiederaufgenommen; kein neuer Zufallsname und kein zweiter Avatar allein durch einen anderen Zugangsweg.
- Vorhandene Teilnehmerbegrenzung respektieren. Ein voll belegtes Quiz darf auch über Code/QR nicht umgangen werden; bestehende Wiederaufnahme nach den bisherigen Regeln ermöglichen.

## 3. QR-Code

- QR-Code kodiert exakt den kanonischen kurzen HTTPS-Teilnahmelink dieser Veröffentlichung, nicht den Admin-Link und nicht bloß die sechs Ziffern.
- Eine vorhandene lokale QR-Komponente/-Bibliothek wiederverwenden. Andernfalls eine kleine geeignete Abhängigkeit einsetzen. Kein externer QR-Bilddienst, der die Teilnahmelinks erhält.
- QR-Code technisch erzeugen; kein KI-generiertes QR-Bild, kein dekoratives Muster als Platzhalter.
- Dunkle Module auf weißer ruhiger Fläche, echte freie Randzone von mindestens vier Modulen und unverzerrte quadratische Darstellung.
- Keine Verläufe, abgerundeten Fantasiemodule oder Lama-/Logoüberlagerungen im Code. Markenillustrationen daneben platzieren.
- In der Einladungsansicht groß genug für Projektion; Richtwert etwa 320–400 CSS-Pixel in der Desktop-Präsentationsansicht. Auf kleineren Ansichten proportional und mit Randzone reduzieren.
- Schriftlicher Code und kurze Adresse stehen zusätzlich daneben. Ein QR-Code allein ist kein barrierefreier oder für alle Geräte nutzbarer Beitrittsweg.
- Initial erst dann eine screenshotbereite Einladung darstellen, wenn der tatsächliche QR-Code fertig gerendert ist. Bei Fehler eine klare Fehlermeldung mit Retry statt eines falschen oder leeren Codes.

## 4. Veröffentlichte Quizrunden kompakter darstellen

Die vorhandene Kartenansicht gezielt weiterentwickeln:

- Pro Karte: Status, Titel, „Mitspielen bis“, großer gut lesbarer Quiz-Code und eine kompakte Teilnehmerzeile.
- Absolute Uhrzeit und Datum eindeutig darstellen. Zeitzone nachvollziehbar, aber nicht zwingend als separate große Zeile „(Europe/Berlin)“ bei jeder Kennzahl. Vorhandene Zeitzonenlogik beibehalten.
- Den langen readonly URL-Kasten als dominierenden Karteninhalt entfernen. Eine kurze Adresse oder Kopieraktion genügt.
- Primär „Einladung anzeigen“, zusätzlich „Link kopieren“ und „Ergebnisse ansehen“.
- „Vorzeitig beenden“ visuell nachrangig bzw. in vorhandenes Aktionsmenü integrieren; Schutzbestätigung erhalten.
- „Code kopieren“ kann unmittelbar am Code als beschriftete Aktion angeboten werden.
- Bei ended Runden den tatsächlichen Status und das Ende zeigen; eine Einladung darf nicht den Eindruck erwecken, dass noch mitgespielt werden kann.
- Bestehende Admin-Top-5-Auswertung aus der vorherigen Spec nicht durch diese Kartenänderung umbauen.

## 5. Screenshotfähige Einladungsansicht

### Aufruf und Zweck

Eine eigene Route oder ausreichend große Ansicht je veröffentlichter Runde, über **„Einladung anzeigen“** erreichbar. Eine neue Registerkarte ist sinnvoll, damit der Admin seine Verwaltung offen lassen kann.

Die Ansicht ist eine fertige Einladungskarte für Beamer und Präsentationsfolien. Sie zeigt keine Adminnavigation, Statistiken, Bearbeitungsformulare, langen technischen Links oder sonstigen Verwaltungsdetails innerhalb der screenshotfähigen Fläche.

### Inhalt und Anordnung

| Bereich | Inhalt |
| --- | --- |
| Oben links | RateLama-Logo, klein und klar |
| Hauptbereich links | Kleine Zeile „QUIZ ZUM MITMACHEN“, großer individueller Quiztitel |
| Darunter | „Scannen oder Code eingeben. Spiele in deinem Tempo.“ |
| Prominenter Codeblock | „DEIN QUIZ-CODE“ und `482 619` als sehr große echte Textziffern |
| Unter dem Code | „ratelama.de öffnen → Quiz-Code eingeben“, passend zur tatsächlich vorhandenen Beitrittsseite |
| Hauptbereich rechts | Großer funktionierender QR-Code auf weißem Feld, darunter „Scannen & mitspielen“ |
| Unten | „Mitspielen bis [Datum], [Uhrzeit] [erkennbare Zeitzone]“ und der kurze Direktlink |

- Diese Texte sind Vorlagen. Titel, Code, Adresse, Status und Frist müssen aus der echten Runde kommen, nie aus fest eingebauten Demo-Daten.
- RateLama-Farben verwenden: Creme als Grundfläche, Dunkelgrün für Text und starke Flächen, Limette als gezielter Akzent; vorhandene runde Typografie und dezente spielerische Elemente.
- Ein Lama-Motiv darf ergänzen, aber niemals QR-Randzone, Code, Titel oder Datum überdecken.
- Große Titel umbrechen; lange Titel sinnvoll auf mehrere Zeilen verteilen. Keine stillen Auslassungspunkte, durch die der Quiztitel unverständlich wird.
- Lesbar aus Präsentationsentfernung: Code und QR sind die wichtigsten Handlungselemente, nicht ein riesiger Markenname.

### Screenshot und Präsentationsmodus

- Eine klar abgegrenzte **16:9-Einladungsfläche**, z. B. skalierbar auf 1920 × 1080, vorsehen. Alle Inhalte einschließlich QR-Randzone müssen darin liegen.
- Auf einem üblichen Laptop-Desktop soll die komplette Einladungsfläche gleichzeitig ohne Scrollen sichtbar sein. Bei abweichendem Fensterformat sinnvoll zentrieren; keine Ränder oder Inhalte abschneiden.
- Außerhalb der Einladungsfläche eine kleine Bedienleiste mit „Vollbild“ und „Zurück“ bzw. „Schließen“ anbieten. Im Vollbild-/Präsentationsmodus diese Leiste ausblenden; per Escape bzw. vorhandener Plattformbedienung wieder verlassen können.
- Fallback für Browser ohne Fullscreen-Unterstützung: nutzbare aufgeräumte Ansicht ohne Fehlerschleife. Keine versteckten App-Bedienelemente, die einen Screenshot dauerhaft überdecken.
- Screenshot wird vom Admin mit den normalen Systemmitteln erstellt. Ein direkter „Als PNG speichern“-Export ist optional, wenn dies sauber mit vorhandenen Mitteln umsetzbar ist; nicht Voraussetzung für dieses Feature.
- Falls ein PNG-Export ergänzt wird, muss er die gleiche echte Einladung einschließlich funktionierendem QR-Code und lokal verfügbaren Fonts/Assets exportieren. Keine zusätzlichen externen Dienste.
- Auf Smartphonefenstern statt unlesbarer Miniaturdarstellung eine passende gestapelte Ansicht anbieten; die 16:9-Komposition ist für Desktop/Präsentation vorgesehen.
- Die Ansicht erhält kein Browser- oder Betriebssystem-Screenshotrecht und soll keine Bildschirmaufnahme automatisch starten.

### Zeit und Status im Screenshot

- Statischen absoluten Ablaufzeitpunkt anzeigen, keinen Countdown und keine nur relativen Angaben wie „morgen“. Der Screenshot muss auch später verständlich sein.
- „Quiz zum Mitmachen“ bedeutet kein Live-Start durch den Admin. Keine Aufforderung „Warte auf den Start“ in dieser Einladung.
- Läuft die Runde ab oder wird sie vorzeitig beendet, die geöffnete Ansicht in einen klaren Endzustand wechseln; bei Fokuswechsel/Reload aktualisieren und Frist lokal anhand der bestätigten Serverzeit berücksichtigen.
- Eine bereits erstellte Bilddatei kann nachträglich nicht geändert werden. Der enthaltene Link/QR/Code muss deshalb beim späteren Öffnen immer den tatsächlichen Serverstatus prüfen und darf keinen Neustart oder Zugang zu einer anderen Runde auslösen.

## 6. Backend, Berechtigung und Bestandsschutz

- Echte bestehende Datenstruktur zuerst analysieren. Benötigt wird fachlich eine öffentliche eindeutige Codezuordnung zur Veröffentlichung, keine neue unabhängige Quiz-App.
- Reservierung, Lookup und Migration mit vorhandenen Amplify-/DynamoDB-/Resolver-/Lambda-Mitteln umsetzen. Keine rein clientseitige Codevergabe und kein Durchsuchen sämtlicher Veröffentlichungen im Gastbrowser.
- Für bereits veröffentlichte Runden ohne Zahlencode einen stabilen Code einmalig serverseitig vergeben, mit Schutz gegen parallele Admin-Aufrufe. Bestehende lange Links, Antworten, Versuche, Ergebnisdaten und Eigentümerschaft erhalten.
- Karten und Einladung zeigen den Code erst nach bestätigter Vergabe. Während der Umstellung keine temporären Codes oder falschen QR-Codes anzeigen.
- Zahlenreferenz und Teilnahmelink sind **Teilnahmezugänge**, keine Admin-Geheimnisse. Sie dürfen nur zulässige öffentliche Metadaten und den bestehenden Gastbeitritt ermöglichen.
- Die Einladungsansicht kann öffentlich erreichbar sein, wenn sie ausschließlich dieselben zulässigen Einladungsinformationen enthält. Verwaltungsaktionen und Teilnehmer-/Ergebnisdaten bleiben authentisiert und berechtigt.
- Das Erraten eines kurzen Codes darf weder fremde Antworten noch Ergebnisse oder Verwaltungsdaten offenlegen. Den bestehenden Request-/Missbrauchsschutz insbesondere auf Code-Lookups und Starts anwenden; kein unbegrenztes öffentliches Listen/Enumerieren aller aktiven Codes ermöglichen.
- Zustände „nicht gefunden“, „beendet“, „Teilnahmegrenze erreicht“ und temporäre technische Fehler verständlich behandeln; keine internen IDs oder Stacktraces ausgeben.
- Ablauf- und Berechtigungsprüfung bleiben serverseitig bei jeder relevanten Start-/Antwortoperation wirksam, unabhängig vom verwendeten Beitrittsweg.
- Keine zusätzlichen Konten, Klarname-/E-Mail-Pflichten, Tracker oder externen QR-Dienste einführen.
- Bestehende Seitentitel, Suchindex-Vorgaben und legale Informationszugänge passend erhalten. `noindex` ist keine Zugriffsprüfung.

## 7. Umsetzung und Abnahme

1. Repository-Anweisungen und bestehende Veröffentlichung, Codevergabe, QR-Komponenten, Live-Beitritt sowie Auth-/Gastmechanik lesen.
2. Codeauflösung und rückwärtskompatible Zuordnung serverseitig ergänzen; Parallelität und Migration absichern.
3. Gemeinsame Codeeingabe und neue Standardlinks integrieren.
4. Begriffe und Verwaltungskarten überarbeiten.
5. Einladungsroute im bestehenden Design umsetzen; QR-Code technisch erzeugen und mit der echten Runde verknüpfen.
6. `Abnahmefaelle.md` prüfen und passende vorhandene Lint-/Typecheck-/Build-Prüfungen ausführen. Neue Tests auf Codezuordnung, Konflikte und Zugang konzentrieren, keine reinen Textkopie-Tests.
7. Desktop- und Mobilansichten visuell prüfen und echte QR-Codes aus der dargestellten Ansicht bzw. einem Screenshot decodieren. Wenn Kamera-/Gerätetests nicht möglich sind, diese Einschränkung offen nennen.

Nach kurzer Bestandsaufnahme direkt umsetzen. Keine echte Einladung verschicken, keine neuen Runden im Produktivsystem erzeugen, keine DNS-Änderung und kein Deployment aus diesem Auftrag ableiten.

## Startauftrag für GitHub Copilot

```text
Setze Spec/ratelama-einladung-beitritt/Anleitung.md um. Die bisherigen Async-Runden heißen im UI künftig „Quiz zum Mitmachen“. Ergänze Zahlencode, kurzen Teilnahmelink, QR-Beitritt und eine schöne 16:9-Einladungsansicht für Screenshots und Präsentationen. Nutze dieselbe Codeeingabe wie beim Live-Quiz und stelle die eindeutige serverseitige Zuordnung sicher. Erhalte alte lange Links, bestehende Antworten, Wertungsregeln und die laufenden Spielmechanismen. Verwende die beigefügte bisherige Ansicht nur als Ausgangsreferenz. Prüfe Abnahmefaelle.md und die vorhandenen Projektchecks. Beginne nach kurzer Bestandsaufnahme direkt mit der Umsetzung. Kein produktives Deployment und keine Nachrichten versenden.
```
