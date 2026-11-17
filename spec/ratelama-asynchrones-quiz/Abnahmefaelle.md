# Abnahmefälle: Quiz per Link

Diese Fälle ergänzen die fachlichen Regeln in `Anleitung.md`. Backend-/Zeitfälle möglichst automatisiert mit einer kontrollierten Serveruhr prüfen; keine langen Echtzeit-Wartezeiten in Tests verwenden.

| Nr. | Situation / Aktion | Erwartetes Ergebnis |
| --- | --- | --- |
| 01 | Admin veröffentlicht ein gültiges Quiz mit zukünftiger Deadline. | Genau eine Veröffentlichung mit unveränderlichem Inhalt und kopierbarem Teilnahmelink. |
| 02 | Veröffentlichung wird nach verlorenem Response mit derselben Vorgangsidentität wiederholt. | Dieselbe Veröffentlichung und derselbe Link; keine doppelte Runde. |
| 03 | Deadline liegt in der Vergangenheit, genau jetzt oder fehlt. | Klare Validierung; keine aktive Veröffentlichung. |
| 04 | Sommerzeitwechsel: lokale Zeit existiert nicht bzw. ist doppeldeutig. | Ungültige Zeit ablehnen bzw. eindeutige Auswahl verlangen. Keine stille Verschiebung. |
| 05 | Admin in Berlin und Gast in anderer Zeitzone sehen die Deadline. | Unterschiedliche lokale Darstellung desselben UTC-Zeitpunkts, Zeitzone erkennbar. |
| 06 | Ein Link-Vorschau-Bot ruft die Teilnahme-URL auf. | Keine neue Gastteilnahme, kein Versuch, keine Veränderung der Statistik durch bloßes GET. |
| 07 | Gast öffnet den Link und klickt „Quiz starten“. | Eigenständiger Versuch mit bestätigtem Namen und Avatar; erste Frage ohne Live-Lobby. |
| 08 | Zwei Gäste starten zu unterschiedlichen Zeiten. | Unabhängige Fragepositionen; kein globales Warten oder gegenseitiges Weiterschalten. |
| 09 | Gast bestätigt eine Antwort. | Nach Serverbestätigung gespeichert; nächste Frage möglich; kein Richtig/Falsch vor Quizende. |
| 10 | Gast versucht dieselbe Frage mit anderer Option erneut abzugeben. | Erste bestätigte Antwort bleibt verbindlich. Kein Überschreiben und keine doppelten Punkte. |
| 11 | Netz bricht nach Speicherung, aber vor Empfang der Bestätigung ab; Retry. | Bestehende Antwort wird wiedererkannt und bestätigt. Keine zweite Antwort. |
| 12 | Antwort wurde noch nicht gespeichert; Verbindung fällt aus. | Keine falsche Erfolgsmeldung. Auswahl bleibt lokal erhalten, Wiederholen bei noch aktiver Runde möglich. |
| 13 | Browser wird nach drei bestätigten Antworten neu geladen. | Derselbe Versuch, Name, Avatar und Fortschritt; Fortsetzung bei nächster offener Frage. |
| 14 | Dieselbe Gastidentität verwendet zwei Tabs und sendet unterschiedliche Optionen gleichzeitig. | Höchstens eine bestätigte Antwort; veralteter Tab wird auf Serverstand gebracht. |
| 15 | Veröffentlichung läuft mehrere Tage, Gast kehrt nach mehr als 24 Stunden zurück. | Fortsetzung im zugesagten Zeitraum funktioniert; pauschal abgelaufene technische Kennung zerstört keine bestätigten Daten. |
| 16 | Letzte Antwort wird gespeichert, die Abschlussseite lädt wegen Netzfehler nicht. | Versuch ist trotzdem abgeschlossen, späterer Aufruf zeigt Abschluss statt erneuter Teilnahme. |
| 17 | Gast ist kurz vor der Deadline mitten im Quiz. | Ab Deadline keine neuen Antworten, auch wenn der Versuch zuvor gestartet wurde. Gespeicherte Teilantworten bleiben erhalten. |
| 18 | Anfrage trifft erst nach Ende ein, Client meldet eine frühere Uhrzeit. | Neue Antwort abgelehnt; Clientzeit kann die Frist nicht verlängern. |
| 19 | Ein bereits rechtzeitig gespeicherter Request wird nach Ende wiederholt. | Bereits vorhandene Bestätigung kann zurückkommen; es entsteht kein neuer Antwortdatensatz. |
| 20 | Admin beendet vorzeitig, während eine Antwortmutation läuft. | Konsistente, dokumentierte atomare Entscheidung; danach keine neue Annahme. UI zeigt den bestätigten Serverstand. |
| 21 | Kein Admin-Browser und kein Hintergrundjob ist zum Fristende aktiv. | Start-/Antwortoperationen nach Deadline trotzdem gesperrt; Link zeigt fachlich beendet. |
| 22 | Quizende, Versuch ist unvollständig. | Status „Frist abgelaufen“, offene Fragen als nicht beantwortet, bestätigte Antworten erhalten. |
| 23 | Quizende, Versuch war vollständig abgeschlossen. | Status bleibt abgeschlossen. Eigene Ergebnisse und Lösungen zugänglich. |
| 24 | Gast untersucht während der Laufzeit sämtliche Netzwerkantworten und direkt zugängliche Gast-APIs. | Keine richtigen Options-IDs, Ergebnis-Punkte, Lösungserklärungen oder fremden Antworten. |
| 25 | Gast oder anderer Admin verwendet eine fremde Versuch-/Veröffentlichungs-ID. | Serverseitige Berechtigungsprüfung verweigert fremde Daten und Schreibzugriffe. |
| 26 | Admin öffnet Ergebnisse während der Laufzeit. | Vorläufige Zahlen, beantwortete/unbeantwortete Fragen, Teilnehmerdetails und Aktualisierungszeitpunkt sichtbar. |
| 27 | Gleiche Frage hat 4 Antworten: 3 auf A, 1 auf B; 2 weitere gestartete Gäste haben nicht geantwortet. | A 75 %, B 25 % der 4 Antworten; 2 nicht beantwortet separat. Keine irreführende Vermischung der Nenner. |
| 28 | Zwei Teilnehmer haben je 3 von 5 Punkten, aber verschiedene Bearbeitungszeiten. | Gleicher fachlicher Rang; keine versteckten Geschwindigkeitspunkte. Abschlussstatus zusätzlich sichtbar. |
| 29 | Eine Veröffentlichung hat noch keine Teilnehmer bzw. eine Frage noch keine Antworten. | Verständlicher Leerzustand, keine ungültigen Prozentwerte oder leeren Fehlercharts. |
| 30 | Mehr Teilnehmer/Antworten als die Backend-Seitengröße. | Paginierung vollständig; Summen und Auswertung umfassen sämtliche relevanten Datensätze. |
| 31 | Admin ändert oder löscht den ursprünglichen Quizentwurf nach Veröffentlichung. | Bereits veröffentlichte Fragen, Optionen, Lösungen und benötigte Medien bleiben gemäß Snapshot stabil. |
| 32 | Dasselbe Quiz wird ein zweites Mal veröffentlicht. | Eigener Link, eigene Deadline, getrennte Versuche und Ergebnisse. |
| 33 | Ein alter Link wird nach fachlichem Ende geöffnet. | Endseite statt Start; bestehender wiedererkannter Gast kann eigene Ergebnisse innerhalb der Aufbewahrung abrufen. |
| 34 | Ablaufzeitpunkt wird erreicht. | Ergebnisse werden nicht mit dem Ende der Bearbeitungsfrist gelöscht. Admin kann sie später weiter ansehen. |
| 35 | Vorgesehene Aufbewahrungsfrist ist tatsächlich abgelaufen. | Kontrollierte Bereinigung der abhängigen Daten, Link endet verständlich; kein Zugriff auf bereits entfernte Inhalte. |
| 36 | Smartphone bei 320/390/430 px, lange Fragen und viele Optionen. | Lesbare vollständige Inhalte und bedienbare Buttons; kein horizontaler Overflow. |
| 37 | Bestehendes Live-Quiz mit mehreren Gästen spielen. | Quizmaster steuert weiterhin synchron, vorhandene Timer und Geschwindigkeitspunkte unverändert. |
| 38 | Gast löscht seinen Speicher oder verwendet ein zweites Gerät. | Einschränkung des anonymen Wiedererkennens ehrlich behandeln; kein behaupteter Schutz „eine Teilnahme pro Mensch“ und kein Fingerprinting. |

## Beispiel für die Wertung

Veröffentlichung mit fünf Fragen:

- Gast A: alle fünf beantwortet, drei richtig → 3/5 Punkte, abgeschlossen.
- Gast B: vier beantwortet, drei richtig, dann Fristende → 3/5 Punkte, unvollständig, eine Frage nicht beantwortet.
- Gast C: alle fünf beantwortet, vier richtig → 4/5 Punkte, abgeschlossen.

Bei Anzeige aller Versuche: C hat Rang 1; A und B teilen Rang 2. B bleibt sichtbar als unvollständig gekennzeichnet. Bei Filter „Abgeschlossen“ wird B ausgeblendet; die Filterwirkung auf die Rangdarstellung deutlich machen.

## Abschlussbericht von Copilot

Benennen: relevante geänderte Dateien, tatsächliche Snapshot-/Gast-/Friststrategie, ausgeführte Tests und Buildprüfungen sowie nicht ausführbare AWS-/Mehrgeräteprüfungen. Keine nicht ausgeführten Prüfungen als bestanden ausgeben.
