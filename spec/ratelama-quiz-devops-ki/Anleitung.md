# Copilot-Auftrag: Workshop-Quiz über die RateLama-Oberfläche anlegen

## Ziel

Lege im bestehenden RateLama-Adminbereich das folgende Quiz mit genau acht Fragen an:

**Titel:** KI im Team: Gemeinsam weiterdenken

**Beschreibung:** Acht lockere Fragen zu KI-Agenten, klaren Anforderungen und gemeinsamer Softwareentwicklung. Für Entwickler und Requirements Engineers beim Einstieg in DevOps und KI.

Das Quiz ist für eine **20-minütige moderierte Live-Runde** vorgesehen und bleibt zunächst als gespeicherter Quizentwurf bzw. wiederverwendbare Quizvorlage bestehen. Keine Runde starten, keine Veröffentlichung mit Ablaufdatum erzeugen und keine Einladungen versenden. Der Nutzer startet später selbst. Die Fragen können später auch für ein „Quiz zum Mitmachen“ verwendet werden.

## Paketinhalt

| Datei | Verwendung |
| --- | --- |
| `Anleitung.md` | Dieser Auftrag für die UI-Anlage mit Playwright |
| `Fragen-und-Loesungen.md` | Lesbare Fassung mit vier Antworten, richtiger Option, Auflösung und Folienbezug |
| `quizdaten.json` | Strukturierte Inhaltsquelle für dieselben acht Fragen; kein vorhandenes RateLama-Importformat |
| `Moderation.md` | Ablauf für 20 Minuten, kurze Begriffseinführung und Moderationshinweise |
| `Quellenbezug.md` | Verwendete Präsentation, Folienstatus und Herkunft |

Den Ordner nach `Spec/ratelama-quiz-devops-ki/` entpacken. Bei abweichender vorhandener Schreibweise des Spec-Ordners diese beibehalten.

## Grenzen dieses Auftrags

- Bestehende Oberfläche bedienen, keine neue Importfunktion entwickeln.
- Keine Änderungen an App-Code, Backend, AWS-Ressourcen oder Spiellogik.
- Keine bestehenden Quizze oder Teilnehmerdaten löschen.
- Der Aufgabeninhalt ist die Anlage dieser Vorlage, keine Durchführung eines echten Events.
- Die PPTX muss nicht hochgeladen oder in der App gespeichert werden. Sie ist die redaktionelle Quelle; ihre Quellenangaben gehören nicht als Antwortoptionen ins Quiz.

## Inhaltsregeln

- `quizdaten.json` ist die verbindliche Datenquelle; Markdown enthält denselben Inhalt für die menschliche Prüfung.
- Genau acht Fragen in der vorgegebenen Reihenfolge anlegen.
- Pro Frage genau vier Antwortoptionen in Reihenfolge A, B, C, D und genau eine als richtig markieren.
- Das Feld `correct` bezeichnet den Buchstaben der richtigen Antwort, keinen null- oder einsbasierten Index. UI-Controls nach der tatsächlich gespeicherten Option prüfen, nicht nach einer angenommenen Indexkonvention.
- Die empfohlenen Zeitfenster stehen je Frage im Feld `seconds`: 20, 20, 30, 30, 25, 25, 30 und 30 Sekunden. Nutze sie, soweit die vorhandene UI dies unterstützt. Falls nur eine globale Zeit einstellbar ist, **30 Sekunden** wählen und dies im Abschlussbericht notieren. Eine vorhandene automatische Antwortsortierung nicht einschalten.
- Wenn Zeiten erst beim späteren Start der Live-Runde konfiguriert werden können, keine Runde nur deshalb starten. Empfohlene Werte im Abschlussbericht aufführen.
- Falls es ein Feld für Auflösung/Erklärung gibt, ausschließlich `explanation` eintragen. `moderation`, Schwierigkeitsgrad, Folienbezüge und andere Redaktionsdaten nicht in öffentlich sichtbare Fragetexte oder Antworten kopieren.
- Fehlt ein Feld für Erklärungen, Fragen und Antworten dennoch vollständig anlegen und im Abschlussbericht auf die separat beigefügten Auflösungen hinweisen. Keine Erklärung an die Frage anhängen, weil sie sonst die Lösung verraten würde.
- Kein dekoratives Bild erforderlich. Die Texte sind für kurze Smartphone-Fragen geschrieben.
- Keine künstlichen „Alle Antworten sind richtig“-Optionen hinzufügen. Keine weiteren Fragen erfinden und keine richtige Antwort umdeuten.

## Playwright-Vorgehen

1. Lies zuerst Repository-Anweisungen, vorhandene Browser-/Playwright-Anleitungen und dieses Paket. Nutze die bestehende Test-/Browserumgebung, falls vorhanden. Keine neue Browser-Automationsarchitektur für diesen Einzelauftrag einführen.
2. Verwende die vom Nutzer geöffnete bzw. konfigurierte RateLama-Instanz; Standarddomain ist `https://ratelama.de`. Nicht auf Verdacht zwischen Test- und Produktivumgebung wechseln. Wenn kein Ziel oder kein berechtigter Adminzugang verfügbar ist, den konkreten fehlenden Zugang benennen, statt Erfolg vorzutäuschen.
3. Vorhandene angemeldete Admin-Sitzung verwenden. Keine Passwörter im Code oder in Ausgaben speichern. Falls Anmeldung durch den Nutzer nötig ist, zur Anmeldung übergeben und erst danach weiterarbeiten.
4. Vor Neuanlage die Quizverwaltung nach dem exakten Titel prüfen. Existiert bereits ein Quiz mit identischem Inhalt, dieses verifizieren und wiederverwenden. Bei unbekanntem abweichendem gleichnamigem Quiz nicht überschreiben; eine eindeutig benannte neue Variante anlegen, z. B. mit „(Workshop)“. Ergebnis und tatsächlichen Titel im Abschlussbericht nennen.
5. Bei einem eigenen unterbrochenen Lauf die bereits erstellte Quiz-ID bzw. bekannte URL nutzen. Nicht bei jedem Retry einen weiteren Entwurf erzeugen. Fragen vor erneutem Hinzufügen auf Titel, Reihenfolge und Antworten vergleichen.
6. „Neues Quiz“ oder die tatsächlich vorhandene gleichwertige Aktion öffnen. Titel und gegebenenfalls Beschreibung eintragen und entsprechend dem vorhandenen Ablauf speichern.
7. Fragen nacheinander über sichtbare Formulare anlegen. Semantische Selektoren wie Rollen, Labels und Text bevorzugen. Keine geratenen CSS-Koordinaten, starren Sleeps oder unbestätigten Annahmen über das Layout.
8. Pro Frage Antworttexte, genau eine korrekte Option, Erklärung und Zeitfenster soweit unterstützt setzen. Auf echte Speicherbestätigung bzw. den bestätigten gespeicherten Zustand warten.
9. Nach jeder Anlage den gespeicherten Zustand kontrollieren und die entstandene Quizreferenz privat für einen möglichen Wiederanlauf festhalten. Weder sensible Auth-Tokens noch Geheimnisse im Protokoll ablegen.
10. Abschließend Quizverwaltung verlassen bzw. neu laden, den konkreten Entwurf erneut öffnen und **alle acht** Fragen aus dem gespeicherten Zustand prüfen. Nur sichtbarer Text direkt nach Formulareingabe genügt nicht als Nachweis der Speicherung.
11. Kontrolliere zusätzlich, dass **keine** neue Live-Runde gestartet und **keine** veröffentlichte Runde erzeugt wurde. Eine Vorschau verwenden, wenn sie ohne echten Gastversuch und ohne Veröffentlichung verfügbar ist; keine echten Teilnehmer-/Statistikdaten für einen Test erzeugen.

Die Anleitung legt keine konkreten App-Selektoren fest, da die aktuelle Oberfläche im Zielsystem geprüft werden muss. Bei fehlenden Feldern oder technischer Blockade offen berichten, welche Inhalte tatsächlich gespeichert sind und welche nicht. Nicht für fehlende UI-Funktionen ungefragt Backend-Aufrufe, direkte Datenbankwrites oder eine neue Importfunktion einsetzen.

## Abschlussprüfung

- Tatsächlicher Quiztitel und stabile gespeicherte Quizreferenz bekannt.
- Genau 8 Fragen, keine Duplikate.
- Je 4 vollständig gespeicherte Antworttexte.
- Richtige Antworten: **C, A, B, D, B, C, D, A**.
- Antwortzeiten soweit möglich: **20, 20, 30, 30, 25, 25, 30, 30 Sekunden**.
- Erklärungen gespeichert, sofern die Oberfläche dies unterstützt.
- Quiz nach Reload weiterhin vorhanden, Reihenfolge unverändert.
- Keine Runde gestartet/veröffentlicht und keine Einladungen verschickt.

## Abschlussbericht

Kurz nennen: tatsächlicher Titel, Quizreferenz bzw. Link zum eigenen Admin-Entwurf, Zahl gespeicherter Fragen, Ergebnis der vollständigen Inhaltskontrolle und nicht unterstützte Felder. „Erfolgreich angelegt“ erst melden, wenn die Speicherung nach erneutem Öffnen bestätigt ist. Keine Zugangsdaten oder Auth-Tokens ausgeben.

## Startauftrag zum Kopieren

```text
Lege das Quiz aus Spec/ratelama-quiz-devops-ki/quizdaten.json über die bestehende RateLama-Adminoberfläche mit Playwright an. Lies Spec/ratelama-quiz-devops-ki/Anleitung.md und die Repository-/Browseranweisungen. Genau acht Fragen mit je vier Antworten und der vorgegebenen richtigen Option übernehmen. Bestehende berechtigte Admin-Sitzung verwenden; bei Bedarf den Nutzer zur Anmeldung übergeben. Anlage nach erneutem Öffnen vollständig kontrollieren. Nur als gespeicherte Quizvorlage bzw. Entwurf anlegen, keine Runde starten oder veröffentlichen. Keine bestehende Vorlage überschreiben und keine Importfunktion entwickeln. Am Ende tatsächliche Quizreferenz, gespeicherte Inhalte und eventuelle Einschränkungen nennen.
```
