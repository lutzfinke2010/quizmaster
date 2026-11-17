# Abnahmefälle für das UI-/Async-Update

## Layout und Ablauf

| Nr. | Fall | Erwartung |
| --- | --- | --- |
| 01 | Live-Frage mit ca. 120 Zeichen und vier Antworten mit je bis ca. 50 Zeichen bei 360×640, 375×667 und 390×844 CSS-Pixeln, normale Schriftgröße. | Vollständige Frage und alle Antworten ohne vertikales Scrollen sichtbar; Buttons bedienbar. |
| 02 | Dieselbe Textfrage im Async-Modus. | Zusätzlich benötigte Abgabeaktion sichtbar, kein hoher Header/Footer oder Zwischenblock. |
| 03 | Lange Frage, mehrere lange Optionen, starke Textvergrößerung oder niedriges Querformat. | Inhalte vollständig lesbar, kontrolliertes Scrollen erlaubt; kein Abschneiden oder Verkleinern auf unlesbare Schrift. |
| 04 | Browserleiste verändert sichtbare Höhe; Gerät wird gedreht. | Layout passt sich an, letzte Antwort und Abgabeaktion bleiben erreichbar. |
| 05 | Vorherige Frage war gescrollt; neue Frage folgt. | Neue Frage beginnt oben, Fokus/Ankündigung sinnvoll; keine übernommene alte Scrollposition. |
| 06 | Async-Antwort wird erfolgreich angenommen. | Ohne weiteren Klick direkt nächste Frage, kein Bestätigungsbildschirm und kein „Nächste Frage“-Button. |
| 07 | Letzte Async-Antwort wird angenommen. | Direkt Abschlussansicht; keine leere Folgefrage. |
| 08 | Netzwerkfehler vor bestätigter Speicherung. | Aktuelle Frage bleibt, kein falscher Erfolg und keine Weiterleitung; Retry möglich, solange Runde aktiv. |
| 09 | Antwort gespeichert, Response verloren, Request wiederholt. | Dieselbe Bestätigung/Punktwertung; genau ein Fortschrittsschritt, neue Frage nicht übersprungen oder neu gestartet. |
| 10 | Mehrere schnelle Klicks, alte Response oder zwei Tabs derselben Identität. | Keine Antwort bei falscher Frage, keine doppelten Punkte, konsistenter bestätigter Fortschritt. |
| 11 | Live-Teilnehmer beantwortet seine Frage. | Weiterhin Warten auf Quizmaster/Rundenfreigabe statt automatischem individuellen Fragenwechsel. |

## Geschwindigkeitspunkte

Zeitprüfungen mit kontrollierter Serveruhr durchführen; keine langen echten Wartezeiten in automatisierten Tests.

| Nr. | Fall | Erwartung für ASYNC_SPEED_V1 |
| --- | --- | --- |
| 12 | Richtige Antwort nach 0 ms. | 1.500 Punkte. |
| 13 | Richtige Antwort nach 15.000 ms. | 1.250 Punkte. |
| 14 | Richtige Antwort nach 30.000 oder 60.000 ms bei noch offener Quizfrist. | 1.000 Punkte; Antwort weiter zulässig. |
| 15 | Falsche Antwort nach 1.000 ms. | 0 Punkte. Schnelles Falsch-Raten bringt keinen Bonus. |
| 16 | Keine bestätigte Antwort bis Quizende. | 0 Punkte für diese Frage. |
| 17 | Gleich schnelle Antworten auf verschiedene Fragen mit unterschiedlichen Startzeiten. | Gleicher Bonus; nicht vom Zeitpunkt des gesamten Quizstarts abhängig. |
| 18 | Refresh nach 10 Sekunden, Antwort insgesamt nach 15 Sekunden. | 1.250 Punkte bei Richtigkeit, kein Timer-Reset. |
| 19 | Gast wechselt für 45 Sekunden den Tab oder verliert Verbindung und kommt zurück. | Startzeit unverändert; bei rechtzeitig vor globalem Ende bestätigter richtiger Antwort 1.000 Punkte. |
| 20 | Client sendet manipulierte Dauer, Punktzahl oder rückdatiertes Datum. | Backend ignoriert diese Wertungsangaben und berechnet selbst. |
| 21 | Bereits angenommene Antwort wird später erneut angefragt/gesendet. | Ursprünglicher Annahmezeitpunkt und Punkte bleiben unverändert. |
| 22 | Klick vor globalem Quizende, erstmalige Serverannahme erst danach. | Wie vorhandene Fristregel abweisen, keine neue Wertung. |
| 23 | Bonusfenster endet, globale Quizfrist läuft noch. | UI sagt nicht „Quiz/Frage abgelaufen“; richtige Antwort bleibt möglich. |
| 24 | Gast prüft Responses und vorab geladene Daten vor Freigabe der nächsten Frage. | Keine zukünftigen Frageinhalte vor Zeitstart, keine Lösungsschlüssel, keine vorzeitigen tatsächlichen Punktgewinne. |
| 25 | Aktuelle Frage erneut abrufen oder Versuch im zweiten Tab öffnen. | Derselbe gespeicherte Startzeitpunkt; keine neuen zusätzlichen Zeitstarts. |
| 26 | Historische Async-Runde mit alter 1-Punkt-Regel und fehlender scoringVersion. | Alte konsistente Wertung bleibt erhalten. Keine erfundenen Zeitdaten und keine Mischung mit neuer Regel. |
| 27 | Neue Veröffentlichung eines bisherigen Quizentwurfs. | Neue veröffentlichte Runde nutzt ASYNC_SPEED_V1 mit gespeicherten Parametern. |
| 28 | Bestehendes Live-Quiz durchspielen. | Bisherige Timer, Quizmaster-Aktionen und Live-Punktberechnung unverändert. |

## Admin-Ergebnisse

| Nr. | Fall | Erwartung |
| --- | --- | --- |
| 29 | Ergebnisseite mit mindestens zehn Teilnehmern öffnen. | Top 5 als erster Inhaltsbereich; weitere Plätze standardmäßig eingeklappt, Zusammenfassung/Details darunter. |
| 30 | Laufende Runde. | „Aktuelle Top 5“ und „Vorläufig“ statt endgültiger Gewinneraussage. |
| 31 | 0, 1, 3 oder 5 Teilnehmer. | Korrekte Leer-/Kurzansicht, keine erfundenen Teilnehmer und kein leerer Zusatzbereich. |
| 32 | Gleichstand zwischen der fünften und sechsten Person. | Gemeinsamer Rang erkennbar; fünf sichtbare Personen, weitere Person im aufgeklappten Bereich. Sortierung suggeriert keinen zusätzlichen Leistungsrang. |
| 33 | Beste Teilnehmer liegen nicht auf der ersten Datenbankseite. | Tatsächlich globale Top 5, keine bloße Auswertung der ersten Seite. |
| 34 | „Weitere Platzierungen“ und Details öffnen, anschließend aktualisieren. | Alle relevanten Plätze/Details erreichbar, keine doppelten Top-5-Einträge; Offen-Zustand möglichst erhalten. |
| 35 | Eigene/Teilnehmer-Auflösung nach Quizende. | Gesamtpunkte, Grundpunkte, Bonus und gemessene Antwortzeit nachvollziehbar. |
| 36 | Smartphone, lange Namen und große Punktzahlen. | Rang, Avatar, Name und Punkte lesbar; sekundäre Angaben umbrechen, keine verdeckten Aktionen. |
| 37 | Accordion-Steuerung mit Tastatur und Screenreader. | Zugänglich bedienbar und Zustand erkennbar, Timer wird nicht jede Sekunde störend vorgelesen. |

## Abschlussbericht

Geänderte Komponenten und Backend-Operationen, neue Wertungsversion, Migrations-/Legacy-Verhalten, ausgeführte Prüfungen und Screenshots der geprüften Viewports knapp nennen. Nicht ausgeführte Prüfungen und unvermeidliche Scrollfälle bei Extremtexten oder Zoom ausdrücklich benennen.
