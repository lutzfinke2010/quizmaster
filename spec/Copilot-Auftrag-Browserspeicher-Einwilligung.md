# GitHub-Copilot-Auftrag: Browser-Speicher prüfen und Einwilligungen gezielt umsetzen

Prüfe und überarbeite die bestehende Quiz-App im aktuellen Repository hinsichtlich Cookies, localStorage und notwendiger Einwilligungen. Implementiere die Änderungen tatsächlich. Bestehende Anmeldung, Quizteilnahme und Wiederverbindung müssen weiterhin funktionieren.

## Ausgangslage

Die bisherige Untersuchung beschreibt:
- Keine Browser-Cookies; AWS Amplify verwendet defaultStorage, nicht CookieStorage.
- Keine Einträge in sessionStorage oder IndexedDB, keine aktiven Service Worker oder Cache Storage.
- js-cookie ist lediglich als transitive Abhängigkeit enthalten. Die App soll damit keine Cookies schreiben.
- Die Datenschutzerklärung beschreibt bereits die Speichernutzung.

Bekannte localStorage-Einträge:

| Schlüssel | Zweck | Bisher beschriebene Dauer |
| --- | --- | --- |
| com.amplify.Cognito.<IdentityPool>.identityId | Technische Gastidentität | Höchstens 24 Stunden |
| quizrush.expiry.<…> | Ablaufsteuerung der Gastidentität | Wie die Gastidentität |
| CognitoIdentityServiceProvider.<ClientId>.* | Quizmaster-Anmeldung einschließlich Tokens | Bis Abmeldung beziehungsweise Ablauf der Anmeldung |
| quizrush.local-drafts.v1 | Quizentwürfe im lokalen Modus | Bis zur Löschung |

Behandle dies als zu überprüfende Bestandsaufnahme, nicht als Beweis der aktuellen Implementierung.

## Ziel

Setze datensparsame Speicherzugriffe um, die sich auf die jeweils angeforderte Funktion beschränken. Baue keinen pauschalen „Cookies akzeptieren“-Banner allein wegen der Verwendung von localStorage ein.

Prüfe anhand der aktuellen offiziellen Quellen, ob die jeweiligen Zugriffe unter die Ausnahme des § 25 Abs. 2 Nr. 2 TDDDG fallen. Unterscheide Endgerätezugriffe nach TDDDG von der anschließenden Verarbeitung personenbezogener Daten nach DSGVO. Eine Datenschutzerklärung ersetzt keine erforderliche Einwilligung. Behaupte keine abschließend geprüfte Rechtssicherheit.

## 1. Tatsächliche Verwendung untersuchen

- Suche sämtliche direkten und indirekten Speicherzugriffe einschließlich Amplify-Initialisierung, Auth, Gastzugriff und Entwurfsladen.
- Prüfe pro Eintrag: anlegender Codepfad, Zeitpunkt des ersten Schreibens/Lesens, Zweck, Lebensdauer, Entfernung und Verhalten bei Reload sowie in mehreren Tabs.
- Prüfe nicht nur document.cookie, sondern auch Browser-Cookieübersicht beziehungsweise Browserkontext und Set-Cookie-Antwortheader. HttpOnly-Cookies sind in document.cookie nicht sichtbar.
- Prüfe Cookies und Speicher auf Startseite, Impressum, Datenschutz, Join, Quizteilnahme, Admin-Login und lokalem Editor.
- Dokumentiere zusätzliche entdeckte Zugriffe und externe Requests.
- Prüfe, ob Tokens nur ablaufen oder tatsächlich entfernt werden. localStorage besitzt keinen automatischen Ablauf.
- Vermeide die pauschale Einstufung „erforderlich“, nur weil ein SDK einen Eintrag standardmäßig verwendet.

## 2. Gastidentität begrenzen

- Erzeuge eine Gastidentität erst, wenn sie für den angeforderten Quizzugriff tatsächlich benötigt wird. Das kann auch das direkte Öffnen einer konkreten Spieleinladung sein; nicht zwingend ein zusätzlicher Klick.
- Auf rein informativen Seiten keine neue Gastidentität oder Wiedererkennungskennung anlegen.
- Begründe die notwendige Wiederverbindungsdauer anhand des tatsächlichen Ablaufs. Behalte 24 Stunden nicht ungeprüft bei.
- Nutze eine zentrale, konfigurierbare Ablaufregel und verhindere unbeabsichtigte Verlängerung durch jeden Seitenaufruf.
- Entferne abgelaufene eigene Schlüssel vor einer erneuten Nutzung, im laufenden Betrieb bei erreichter Frist und bei Rückkehr zum Tab.
- Stelle bereits beendete oder ungültige Spielzugriffe nicht durch eine lokale Kennung wieder her.
- Verwende unterstützte Amplify-Schnittstellen; keine unkontrollierten Eingriffe in interne SDK-Schlüssel.
- Lösche keine fremden App-Daten und keine noch benötigte Admin-Sitzung.
- Beachte getrennte Lebensdauern von Gastidentität, AWS-Zugangsdaten und Spielmitgliedschaft; keine pauschale Gleichsetzung.

Wenn der Browser geschlossen ist, kann JavaScript keine punktgenaue physische Löschung garantieren. Beschreibe ehrlich: logische Gültigkeit, Bereinigung bei nächster Ausführung und Grenzen der physischen Entfernung. Falls nötig, die Datenschutzerklärung „höchstens 24 Stunden gespeichert“ präzisieren. Serverseitige Ablaufprüfungen dürfen nicht allein auf einer manipulierbaren Browseruhr beruhen.

## 3. Quizmaster-Anmeldung

- Speichere Anmeldedaten erst im Rahmen einer tatsächlich gestarteten Anmeldung.
- Prüfe Logout, Tokenablauf und insbesondere Refresh-Tokens. Ein abgelaufener Access-Token bedeutet nicht automatisch, dass die gesamte Sitzung beendet ist.
- Definiere und dokumentiere eine nachvollziehbare Sitzungsdauer entsprechend der realen Cognito-Konfiguration.
- Keine unbegrenzte Wiederanmeldung ohne Prüfung. Eine optionale dauerhafte „Angemeldet bleiben“-Funktion darf nicht stillschweigend aktiviert sein.
- SDK-seitige Tokenbereinigung und Tab-Synchronisation prüfen, ohne legitime Refresh-Abläufe zu beschädigen.
- Kein zusätzliches Cookie-Banner für die nachweislich erforderlichen Anmeldefunktionen vorsehen.

## 4. Lokale Quizentwürfe

Prüfe zuerst, ob lokales Speichern Kern der ausdrücklich gewählten lokalen Betriebsart oder lediglich eine optionale Komfortfunktion ist.

- Dauerhafte Speicherung vor ihrer ersten Nutzung klar erklären: Speicherung auf diesem Gerät, Umfang, Dauer und Löschmöglichkeit.
- Ist die dauerhafte Speicherung optional, standardmäßig deaktiviert anbieten, etwa mit „Entwürfe auf diesem Gerät speichern“.
- Nicht heimlich bereits beim Öffnen des Editors dauerhaft schreiben.
- Vor Wahl der lokalen Speicherung den Arbeitsstand bei Bedarf ausschließlich im Arbeitsspeicher halten; Verlassen der Seite mit verständlicher Warnung behandeln.
- Falls eine Einwilligung erforderlich bleibt, sie unmittelbar an dieser Funktion informiert, freiwillig, eindeutig und vor dem ersten Zugriff einholen. Der Schalter ist nicht automatisch eine rechtlich ausreichende Einwilligung; prüfe die Ausgestaltung.
- Bei Ablehnung muss die übrige Quizfunktion weiter nutzbar sein.
- „Lokale Entwürfe löschen“ mit Rückmeldung anbieten und eine optionale Speicherfunktion jederzeit abschaltbar machen.
- Bereits vorhandene Entwürfe nicht ohne Vorwarnung vernichten. Eine sichere Migration vorsehen: bestehende Daten schützen, über die Speicherfunktion informieren, Fortführung/Löschung ermöglichen und bis zur Klärung keine zusätzliche automatische dauerhafte Speicherung durchführen.
- Für die gezielte Verwaltung vorhandener Entwürfe notwendige Zugriffe von einer automatischen Wiederaufnahme unterscheiden und dokumentieren.

## 5. Einwilligungsoberfläche nur bei tatsächlichem Bedarf

Ergebnis nach Prüfung:

A. Ausschließlich erforderliche Zugriffe:
Kein Einwilligungsbanner. Verständliche Informationen zu Browser-Speicher und Datenschutz reichen als Information; die übrigen DSGVO-Pflichten bleiben gesondert zu erfüllen.

B. Optionale einwilligungspflichtige Entwurfsspeicherung:
Gezielte Abfrage beim Editor beziehungsweise bei Aktivierung der Funktion, ohne die Mitspieler mit einem allgemeinen Banner zu belasten.

C. Weitere einwilligungspflichtige Funktionen entdeckt:
Vor Einwilligung technisch blockieren oder, wenn für das Quiz entbehrlich, deaktivieren. Notwendige Einwilligung mit gleichwertiger Ablehnung, klaren Zwecken und einfachem Widerruf umsetzen.

Keine vorangekreuzten Kästchen, keine Zustimmung durch Weitersurfen und keine Checkbox „Datenschutz akzeptieren“ als pauschale Freigabe aller Vorgänge. Keine neue Tracking- oder Consent-SaaS-Abhängigkeit allein für diese Aufgabe.

## 6. Datenschutzerklärung abgleichen

- Die bestehenden Angaben anhand der geprüften Umsetzung aktualisieren.
- Zwischen Cookies und anderem Browser-Speicher verständlich unterscheiden.
- Pro Speichergruppe Zweck, Zeitpunkt, Dauer und Löschverhalten korrekt angeben.
- Keine pauschale Aussage „Wir speichern nichts“, wenn localStorage verwendet wird.
- Keine Zusicherung, dass alle Daten nach 24 Stunden physisch gelöscht sind, wenn nur ein Ablaufzeitpunkt gesetzt wird.
- Nicht behaupten, dass ein Logout auch serverseitige Spiel- oder Protokolldaten löscht.
- Betreiber bleibt Lutz Finke; MAXYA nicht ergänzen.
- Gesicherte Tatsachen und offene rechtliche oder infrastrukturelle Punkte klar trennen.

## 7. Prüfung und Abnahme

Führe passende, aussagekräftige Tests aus:
1. Ein frischer Browserkontext erzeugt auf Impressum und Datenschutz keine neue Gastkennung.
2. Eine konkrete Spielteilnahme erzeugt nur die dafür benötigten Einträge.
3. Reload und Wiederverbindung funktionieren innerhalb der festgelegten Gültigkeit.
4. Abgelaufene Kennungen werden bei erneuter Ausführung nicht verwendet; laufende Tabs berücksichtigen den Ablauf.
5. Admin-Login, Token-Refresh und Logout funktionieren weiterhin.
6. Optionale lokale Entwürfe werden vor Aktivierung nicht dauerhaft geschrieben.
7. Die gewählte Speicherfunktion, ihre Abschaltung und die gezielte Löschung funktionieren; vorhandene Entwürfe werden bei Migration nicht stillschweigend zerstört.
8. Browser-Cookies und Set-Cookie werden mitgeprüft.
9. Typecheck und Produktionsbuild bestehen.

Nutze bei Zeitabläufen kontrollierte Testuhren statt realer Wartezeiten. Teste keine Produktivdaten. Behaupte keine AWS-/Browserprüfung, wenn nur statisch oder mit Mocks geprüft wurde.

Liefere:
- die implementierten Änderungen;
- eine kurze Speichertabelle mit tatsächlichem Zweck und Lebenszyklus;
- eine begründete Empfehlung „kein Banner“, „funktionsbezogene Einwilligung“ oder „weiterer Prüfbedarf“;
- tatsächlich ausgeführte Prüfungen und offene Punkte.

Prüfe vor der rechtlichen Einordnung die aktuellen offiziellen Quellen:
- § 25 TDDDG: https://www.gesetze-im-internet.de/ttdsg/__25.html
- Orientierungshilfen der Datenschutzkonferenz: https://www.datenschutzkonferenz-online.de/orientierungshilfen.html

Beginne jetzt mit der Repository-Analyse und setze anschließend die eindeutig bestimmbaren Anpassungen um.

