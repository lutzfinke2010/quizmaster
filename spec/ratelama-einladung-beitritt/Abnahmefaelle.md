# Abnahmefälle: Einladungen und einfacher Beitritt

| Nr. | Prüfung | Erwartung |
| --- | --- | --- |
| 01 | Veröffentlichte Runden, Moduswahl, Dialoge und Gastansichten prüfen. | Sichtbare Bezeichnung „Quiz zum Mitmachen“; keine technischen Texte „Async“, „Asynchron“ oder „Deadline“ in diesen Bereichen. |
| 02 | Neue Runde veröffentlichen. | Genau ein stabiler sechsstelliger Zahlencode, kurzer Link und zum selben Link passender QR-Code. |
| 03 | Veröffentlichen nach verlorenem Response wiederholen. | Gleiche Runde und gleicher Code, keine zweite Veröffentlichung. |
| 04 | Zwei Veröffentlichungen erzeugen gleichzeitig denselben Zufallskandidaten. | Atomare Konfliktbehandlung und neue Kandidatenwahl; kein doppelt zugeordneter Code. |
| 05 | Live-Quiz und veröffentlichte Runde verwenden denselben Codebereich. | Gemeinsame Eindeutigkeit; Eingabe löst genau eine Runde im richtigen Modus auf. |
| 06 | Code `004281` anzeigen, kopieren, mit `004 281` eingeben. | Führende Nullen bleiben erhalten, Eingabe führt zur richtigen Runde. |
| 07 | Ungültige Länge, fremde Zeichen, unbekannter Code. | Verständliche Rückmeldung; keine technische Fehlermeldung und kein falscher Beitritt. |
| 08 | Öffnen über QR, kurzen Link und manuelle Codeeingabe. | Identische Veröffentlichung und identischer Startablauf. |
| 09 | Wiedererkannter Gast wechselt vom langen Link zum Code oder QR. | Bestehender Versuch, Name, Avatar und Fortschritt bleiben erhalten. |
| 10 | Alten langen Teilnahmelink nach dem Update öffnen. | Weiterhin dieselbe Runde, keine neue Kopie und keine Umwertung. |
| 11 | Bestehende Runde ohne Code parallel in zwei Admin-Tabs öffnen. | Einmalige stabile Codezuordnung; beide zeigen denselben Code und QR. |
| 12 | Neuen kurzen Link direkt aufrufen und Browser neu laden. | Hosting und Routing liefern die richtige SPA-/Teilnahmeseite ohne 404. |
| 13 | Teilnahme-URL bzw. Einladung durch einen Linkvorschau-Bot aufrufen. | Kein neuer Versuch und kein Start des Frage-Timers durch bloßes Öffnen. |
| 14 | Voll belegte Runde über einen anderen Beitrittsweg öffnen. | Vorhandene Teilnahmegrenze bleibt wirksam, Wiederaufnahme nach bestehenden Regeln. |
| 15 | QR-Code programmgesteuert decodieren. | Exakt der kanonische kurze Teilnahme-HTTPS-Link, keine Admin-URL. |
| 16 | Screenshot der Einladung erstellen, in 16:9-Folie einfügen und QR erneut prüfen. | Vollständige Randzone, ausreichend großer QR, unverzerrte Darstellung und weiterhin decodierbarer Link. |
| 17 | Einladung mit langem Titel und langem Datum auf Laptop/Desktop. | Vollständiger verständlicher Inhalt, Code und QR sichtbar; kein Scrollen innerhalb der Desktop-Einladungsfläche. |
| 18 | Einladung auf Smartphone und bei Textvergrößerung. | Lesbare gestapelte Ansicht, keine winzig herunterskalierte Desktop-Miniatur und keine abgeschnittenen Texte. |
| 19 | „Vollbild“, Escape und Browser ohne Fullscreen-Unterstützung. | Screenshotfähige Fläche ohne Adminwerkzeuge; Rückkehr möglich und Fallback benutzbar. |
| 20 | Invitation wird gerendert, QR-Erzeugung schlägt fehl. | Klarer Fehler mit Retry, kein falscher Platzhalter-QR und keine irreführende fertige Einladung. |
| 21 | Quiz läuft während geöffneter Einladung ab oder wird beendet. | Tatsächlicher Endzustand nach Zeit-/Statusabgleich; kein weiterhin zugesagter aktiver Zugang. |
| 22 | Tage später wird ein alter Präsentationsscreenshot gescannt. | Derselbe Rundenbezug; bei Ende verständliche Endseite und niemals eine andere später angelegte Runde. |
| 23 | Vorschau-/lokale Umgebung erzeugt Link und QR. | Korrekte konfigurierte Basis-URL, keine ungewollte Produktionsveröffentlichung. |
| 24 | Gast versucht mit Zahlencode Admin-Endpunkt oder fremde Antworten zu lesen. | Server lehnt mangels Berechtigung ab; Code gewährt nur Teilnahmezugang. |
| 25 | Serienhafte Code-Lookups und Beitrittsversuche. | Vorhandener geeigneter Missbrauchsschutz greift, keine öffentliche Liste aller aktiven Runden. |
| 26 | Abgelaufene bzw. vorzeitig beendete Runde in Verwaltung. | Korrekter Status und Ende, keine irreführende aktive Einladung. Ergebnisse wie bisher erreichbar. |
| 27 | Live-Quiz über bisherige Codeeingabe betreten. | Bisherige Lobby und Quizmaster-Steuerung funktionieren unverändert. |
| 28 | Quiz zum Mitmachen durchspielen. | Vorhandene Geschwindigkeitspunkte, automatischer Fragenwechsel und globale Deadline unverändert. |
| 29 | Zahlencode nach endgültiger Entfernung alter Teilnehmerdaten erneut vergeben. | Alter veröffentlichter Code wird nicht einer fremden Runde zugeordnet. Minimaler Reservierungsbezug genügt, alte Teilnehmerdaten werden dafür nicht erhalten. |
| 30 | Codekopie und Linkkopie bei fehlender Clipboard-Unterstützung. | Auswählbarer korrekter Inhalt bzw. anderer nutzbarer Fallback; kein fälschlicher Erfolgshinweis. |

## Abschlussbericht

Geänderte UI-Bereiche und Backend-Zuordnung, Umgang mit bestehenden Codes/Links, ausgeführte Prüfungen und echte Desktop-/Mobil-Screenshots nennen. QR-Decodierung und einen gegebenenfalls durchgeführten Scan aus einer Präsentation gesondert ausweisen. Fehlende Kamera-/Gerätetests nicht als bestanden melden.
