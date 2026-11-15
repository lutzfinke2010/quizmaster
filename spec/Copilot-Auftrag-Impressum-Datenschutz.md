# GitHub-Copilot-Auftrag: Rechtliche und datenschutzgerechte Ergänzungen der Quiz-App

Du arbeitest im vorhandenen Repository einer bereits bei AWS gehosteten Live-Quiz-Web-App. Ergänze die für den konkreten Betrieb in Deutschland relevanten rechtlichen Informationen und technischen Datenschutzmaßnahmen. Setze Änderungen tatsächlich um und prüfe sie. Liefere keine bloße Textsammlung und keine pauschale Zusicherung vollständiger Rechtssicherheit.

## 1. Bekannter Nutzungskontext

- Die App ist zunächst für ein einzelnes Arbeits-Event bestimmt.
- Teilnehmende spielen überwiegend mit dem Smartphone im Browser; der Quizmaster steuert am Computer. Optional gibt es eine Beameransicht.
- Gäste treten ohne Registrierung per QR-Code/Spielcode bei. Sie bekommen einen zufälligen Namen und Avatar.
- Antworten, Antwortzeiten, Punkte und Ranglisten werden verarbeitet.
- Die App ist bei AWS gehostet und aus dem Internet erreichbar.
- Geplante Technik: Amplify Gen 2, DynamoDB, AppSync, Lambda, Cognito für Admin und technische Gastidentitäten. Prüfe die tatsächliche Implementierung statt diese Liste als vollständig anzunehmen.
- Der Betreiber soll Lutz Finke sein, als natürliche Person. Das Projekt wird ausdrücklich NICHT über MAXYA oder MAXYA Finke Solutions betrieben.
- Der Arbeitgeber ist nicht ohne weitere Bestätigung als Anbieter, datenschutzrechtlich Verantwortlicher oder Auftraggeber auszuweisen.
- Arbeitsannahme: kostenlos, keine Werbung, keine Kaufabwicklung, kein Tracking, keine Gewinnspiele mit Sach-/Geldpreisen und keine öffentlich erstellten Nutzerinhalte. Prüfe den Code auf Abweichungen.
- Der endgültige App-Name und die Domain ergeben sich aus dem Repository; keinen zuvor diskutierten Namen eigenmächtig übernehmen.

Unterscheide Anbieterkennzeichnung und datenschutzrechtliche Verantwortlichkeit. Die tatsächlichen Entscheidungen über Zwecke und Mittel bestimmen Letztere, nicht die Beschriftung im Impressum oder der Inhaber des AWS-Accounts. Wenn ein Arbeitgeber die Verarbeitung bestimmt, dokumentiere den Klärungsbedarf einschließlich möglicher gemeinsamer Verantwortlichkeit.

## 2. Arbeitsweise und Grenzen

1. Lies Repository-Anweisungen und untersuche Frontend, Backend, Infrastruktur und vorhandene Rechtstexte.
2. Erstelle einen kurzen Plan und implementiere danach die eindeutig bestimmbaren Änderungen.
3. Prüfe aktuelle offizielle Rechtsquellen und AWS-Unterlagen. Verwende DDG und TDDDG, keine veralteten TMG-/TTDSG-Mustervorlagen.
4. Trenne belegte Tatsachen, konfigurierbare Entwurfsannahmen und manuell zu bestätigende Punkte.
5. Erfinde keine Adresse, E-Mail, Telefonnummer, Registerdaten, Vertragsabschlüsse, Rechtsgrundlagen, Zertifizierungen oder technischen Einstellungen.
6. Nicht aus dem Repository ersichtliche Konto-/Cloud-Einstellungen als ungeprüft kennzeichnen. Keine Bestätigung aus fehlendem Code ableiten.
7. Erledige die Umsetzung mit klaren Platzhaltern, statt wegen fehlender Kontaktdaten stehenzubleiben. Sammle am Ende gezielt die tatsächlich fehlenden Angaben.
8. Keine selbstständige Veröffentlichung oder Änderung produktiver Daten. Erstelle überprüfbare Änderungen und benenne erforderliche Deployment-Schritte.
9. Eine Codeänderung kann keine vollständige Einhaltung aller deutschen Gesetze garantieren. Dokumentiere die für dieses Angebot relevanten Pflichten und die verbleibenden organisatorischen Aufgaben konkret.

## 3. Bestandsaufnahme der Datenflüsse

Erstelle zuerst eine knappe Datenfluss-Tabelle mit Datenkategorie, Zweck, Quelle, Empfänger, Speicherort, Aufbewahrung und rechtlichem Prüfbedarf.

Prüfe insbesondere:
- IP-Adressen, Request-Metadaten und Hosting-/CDN-/WAF-/API-/Lambda-Logs.
- Cognito-Gastidentitäten, Admin-Konten, Auth-Tokens und Browser-Speicher.
- Pseudonyme, Avatare, Sitzungszuordnungen, Antworten, Antwortdauer, Punkte und Ranglisten.
- Präsentationslinks, QR-Codes, Einladungskennungen und Referrer.
- Monitoring, Fehlerberichte, Analytics und Telemetrie von Bibliotheken.
- Externe Schriftarten, Bilder, Sounds, Avatare, Captchas, Skripte und CDNs.
- Daten in DynamoDB, Cognito, S3, CloudWatch, Step-Functions-Ausführungshistorien, Backups und gegebenenfalls E-Mails.
- Cookies, localStorage, sessionStorage, IndexedDB, Service Worker und Cache Storage.

Zufallsnamen machen die Verarbeitung nicht automatisch anonym. Beschreibe sie als pseudonym, soweit eine Zuordnung über Identitäten, Geräte oder Metadaten möglich bleibt.

## 4. Impressum

Implementiere eine deutsche Seite unter /impressum. Verwende eine zentrale, typsichere Konfiguration für öffentliche Betreiberangaben, etwa src/config/legal.ts:

- providerName: Lutz Finke
- streetAndNumber: [STRASSE UND HAUSNUMMER ERGÄNZEN]
- postalCode: [PLZ ERGÄNZEN]
- city: [ORT ERGÄNZEN]
- country: Deutschland
- contactEmail: [KONTAKT-E-MAIL ERGÄNZEN]
- optional geeigneter weiterer schneller Kontaktweg, falls für die einschlägigen Pflichten erforderlich
- appName und canonicalOrigin aus bestätigter Projektkonfiguration

Straße, Hausnummer und Ort müssen eine echte zustellfähige Anschrift ergeben. Kein Postfach als Ersatz. Keine fremde Anschrift ungeprüft verwenden.

Beachte:
- § 18 Abs. 1 MStV als relevante Grundlage bei nicht ausschließlich persönlichen oder familiären Angeboten prüfen.
- Ob zusätzlich § 5 DDG gilt, am konkreten Angebot prüfen; kostenlose Nutzung schließt dessen Anwendung nicht automatisch aus.
- Keinen Handelsregistereintrag, keine USt-IdNr., keine Geschäftsbezeichnung und keine Berufsaufsicht erfinden.
- Keine persönliche Steuer-ID oder Steuernummer veröffentlichen.
- Keinen journalistisch-redaktionell Verantwortlichen nach § 18 Abs. 2 MStV allein wegen der Quizfragen ergänzen.
- Keine pauschalen Haftungsausschlüsse, keinen Satz „Keine Abmahnung ohne vorherigen Kontakt“ und keinen Haftungsverzicht der Teilnehmenden einbauen.
- Keine veraltete Verlinkung zur eingestellten EU-OS-Plattform.
- Kein Arbeitgeberlogo und keine behauptete offizielle Partnerschaft ohne Freigabe.

Verlinke Impressum und Datenschutz dauerhaft verständlich und ohne Login von Start, Beitritt, Lobby, Spiel, Admin-Anmeldung und Präsentation aus. Mobil nicht abschneiden und nicht hinter einem nicht zugänglichen Overlay verstecken. Direkte Seitenaufrufe und Neuladen müssen mit Amplify-SPA-Routing funktionieren.

## 5. Datenschutzerklärung

Implementiere /datenschutz mit aktuellen, verständlichen Informationen passend zu den nachgewiesenen Datenflüssen. Die Seite muss vor Teilnahme und vor Admin-Login zugänglich sein.

Berücksichtige die Informationspflichten aus Art. 12–14 DSGVO, soweit einschlägig:
- Identität und Kontakt des tatsächlichen Verantwortlichen.
- Datenschutzbeauftragter nur bei tatsächlicher Benennung oder einschlägiger Pflicht.
- Zwecke, Datenkategorien und konkret geprüfte Rechtsgrundlagen je Verarbeitung.
- Bei berechtigten Interessen das konkrete Interesse und eine interne Abwägung dokumentieren.
- Empfänger beziehungsweise Empfängerkategorien und tatsächlich eingesetzte AWS-Leistungen.
- Drittlandübermittlungen, gegebenenfalls Garantien und Bezugsmöglichkeiten.
- Konkrete Speicherdauer oder nachvollziehbare Kriterien.
- Betroffenenrechte einschließlich der Voraussetzungen für Widerspruch und Datenübertragbarkeit.
- Widerruf nur für Verarbeitungen, die tatsächlich auf Einwilligung beruhen.
- Beschwerderecht; zuständige Landesdatenschutzaufsicht erst nach bestätigtem Betreiberstandort konkret nennen.
- Ob Datenbereitstellung erforderlich ist und welche Folgen die Nichtbereitstellung hat.
- Automatisierte Entscheidungsfindung nach Art. 22 nicht mit jeder automatischen Punkteberechnung gleichsetzen. Die spielerische Rangliste entsprechend einordnen.

Keine pauschale Rechtsgrundlage für alles behaupten: Art. 6 Abs. 1 lit. b DSGVO nur bei tatsächlich bestehendem Vertrag und Erforderlichkeit verwenden. Eine Beschäftigteneinwilligung nicht ungeprüft als freiwillig voraussetzen. Eine gesetzliche Datenverarbeitung nicht durch eine unnötige Einwilligungs-Checkbox ersetzen.

Vor dem Beitritt einen kurzen Hinweis anzeigen: Pseudonym und Avatar sowie später Punkte und Platzierung sind für die eigene Spielrunde sichtbar; Verarbeitungshinweise sind verlinkt. Keine Klarnamen nötig. Keine Checkbox „Ich akzeptiere den Datenschutz“ verlangen. Falls eine konkrete freiwillige Einwilligung wirklich notwendig ist, gesondert, informiert, nachweisbar und widerrufbar gestalten.

Rechtstext muss gespeicherte Konfiguration und tatsächliche Umsetzung wiedergeben. Bei fehlender Entscheidung eine klar markierte Entwurfsstelle und einen Prüfpunkt anlegen, keine bloß plausible Aussage als Tatsache veröffentlichen.

## 6. Cookies und Endgerätespeicher

Prüfe sämtliche Speicherzugriffe nach § 25 TDDDG. Unterscheide die Endgeräte-Frage von der anschließenden Verarbeitung nach DSGVO.

- Nutze standardmäßig nur die für den ausdrücklich gewünschten Dienst unbedingt erforderlichen Speicherzugriffe.
- Prüfe Gastwiedererkennung, Token und Sitzungsdaten einzeln hinsichtlich Zweck, Zeitpunkt, Dauer und Erforderlichkeit.
- Stelle unnötige dauerhafte Wiedererkennung ab; nicht benötigte Kennungen nicht bereits beim bloßen Öffnen des Impressums erzeugen.
- Entferne/deaktiviere optionale Analytics, Werbetracking und unnötige Drittanbieter-Abfragen, soweit sie vorhanden sind.
- Hoste Fonts, Avatare und Sounds möglichst selbst.
- Wenn nach tatsächlicher Prüfung nur Zugriffe unter eine gesetzliche Ausnahme fallen, keinen dekorativen Cookie-Banner einbauen.
- Wenn optionale einwilligungspflichtige Funktionen verbleiben: vor Einwilligung technisch blockieren, Ablehnen und Zustimmen gleichwertig anbieten, granulare Auswahl und späteren Widerruf ermöglichen; Ablehnung darf die notwendige Quizfunktion nicht verhindern.
- Keine vorangekreuzten Kästchen oder Einwilligung durch Weitersurfen.

Dokumentiere tatsächliche Speicherschlüssel beziehungsweise sichere Schlüsselpräfixe, Zweck und Lebensdauer. Keine Tokenwerte dokumentieren.

## 7. Technische Datenschutzmaßnahmen

Implementiere passend zur bestehenden Architektur:
- HTTPS und sichere, kompatible Header über Amplify/CDN, etwa Content-Security-Policy, Referrer-Policy, Permissions-Policy und Schutz vor MIME-Sniffing.
- CSP mit den wirklich benötigten AppSync-, Cognito- und Hosting-Endpunkten abstimmen. Keine pauschalen Wildcards als fertige Sicherheitslösung ausgeben.
- HSTS erst für kontrollierte HTTPS-Domains passend konfigurieren; keine automatische Preload-Registrierung oder ungeprüftes includeSubDomains.
- Adminzugriff, Rollen und Sitzungseigentum serverseitig prüfen.
- Keine offenen DynamoDB-/AppSync-Lesezugriffe auf Gäste, Antworten, Identitätszuordnungen oder globale Ranglisten.
- Subscriptions ebenfalls serverseitig nach Sitzung und Berechtigung schützen.
- Lösungen erst nach der Auflösung freigeben.
- Pseudonyme und Scores nur innerhalb der berechtigten Spielrunde anzeigen; keine öffentliche globale Ergebnisliste.
- Präsentationslink als schützenswerten, widerrufbaren Zugang behandeln. Keine Tokens über Referrer, Analytics oder ungefilterte Logs weitergeben.
- Rate-Limits, Eingabevalidierung und sinnvolle Größenbeschränkungen vorsehen.
- Keine Passwörter, Tokens, unnötigen IP-Adressen oder vollständigen Antwort-Payloads in Anwendungslogs.
- Berechtigungen nach Least Privilege, vorhandene AWS-Verschlüsselungseinstellungen prüfen und konkret dokumentieren.

Eine robots.txt oder noindex kann Suchmaschinenindexierung reduzieren, ersetzt aber keine Zugangskontrolle. Öffentliche Join-Seite bei Bedarf auffindbar lassen; sensible Spiel- und Präsentationsansichten technisch schützen.

## 8. Löschung und Betroffenenrechte

Setze einen konfigurierbaren Löschprozess um. Entwurfswert: Spiel- und Teilnehmerdaten sieben Tage nach Spielende löschen. Dieser Wert ist eine Produktentscheidung, keine gesetzliche Mindest- oder Höchstfrist. Vor Veröffentlichung bestätigen und in der Datenschutzerklärung konsistent darstellen.

- Laufende und abgebrochene Sitzungen sowie nie abgeschlossene Lobbys berücksichtigen.
- Antwortdaten, Punktestände, Teilnehmerzuordnungen, Präsentationstokens und Spielcodes einschließen.
- Gemeinsame Identitätspools nicht versehentlich durch Löschung noch verwendeter Identitäten beschädigen.
- Nicht mehr benötigte Cognito-Gastidentitäten und deren tatsächliche Lebensdauer gesondert prüfen.
- Log-Retention und Backup-Aufbewahrung getrennt definieren; verzögerte physische TTL-Löschung ehrlich beschreiben.
- Abgelaufene Zugriffsberechtigungen sofort logisch unwirksam machen, auch wenn physische Datenlöschung später erfolgt.
- Logs mit längeren, begründeten Sicherheitsfristen getrennt und zugriffsbeschränkt behandeln.
- Backups und Wiederherstellungen so dokumentieren, dass alte Daten nicht unbemerkt wieder produktiv verfügbar werden.

Biete einen sinnvollen Weg zur Auskunft/Löschanfrage, etwa über den Datenschutzkontakt. Soweit technisch sicher möglich, ergänze „Meine Spieldaten löschen“ für die eigene nachgewiesene Gastidentität. Beachte berechtigte Ausnahmen und Spielkonsistenz; entfernte Ranglisteneinträge müssen passend behandelt werden.

Eine lokale Schaltfläche „Spiel auf diesem Gerät verlassen“ darf nicht behaupten, auch serverseitige Daten gelöscht zu haben. Wenn die Gastzuordnung nicht mehr nachweisbar ist, keine Daten fremder Personen herausgeben. Keine unnötigen Ausweiskopien sammeln; Art. 11 und 12 DSGVO bei Identifizierbarkeit und Identitätsprüfung berücksichtigen.

## 9. AWS und organisatorische Aufgaben

Erstelle docs/rechtliche-betreiber-checkliste.md mit Status und Nachweisbedarf:
- Wer entscheidet tatsächlich über Zwecke und Mittel der Verarbeitung?
- Welche AWS-Vertragspartei und welche Dienste werden eingesetzt?
- Auftragsverarbeitungsvereinbarung nach Art. 28 DSGVO einschließlich anwendbarem AWS-DPA prüfen; keinen erfolgten Abschluss behaupten.
- Regionen, Unterauftragsverarbeiter, Supportzugriffe, globale Dienste und mögliche Drittlandtransfers anhand aktueller AWS-Unterlagen prüfen. Frankfurt als Datenbankregion beweist nicht, dass jede Verarbeitung ausschließlich in Deutschland erfolgt.
- Gegebenenfalls gültige Übermittlungsinstrumente und notwendige Zusatzmaßnahmen prüfen; nicht aus einer AWS-Zertifizierung pauschale Konformität ableiten.
- Technische und organisatorische Maßnahmen, Rechtsgrundlagen/Interessenabwägung und gegebenenfalls Verzeichnis von Verarbeitungstätigkeiten dokumentieren.
- Kontakt- und Ablaufplan für Datenschutzanfragen sowie Datenschutzverletzungen, einschließlich Prüfung der gesetzlichen Meldepflichten und Fristen.
- Bei betrieblicher Nutzung tatsächliche interne Cloud-/IT-/Datenschutzvorgaben klären. Freitextfragen dürfen keine internen Geheimnisse oder Beschäftigtendaten ungeprüft an einen privaten Cloudbetrieb übertragen.
- Mögliche Mitbestimmung nach § 87 Abs. 1 Nr. 6 BetrVG und Beschäftigtendatenschutz prüfen, insbesondere wenn identifizierbare Quizleistungen ausgewertet werden. Keine pauschale automatische Pflicht oder Ausnahme behaupten.
- Keine Auswertung als Leistungs- oder Personalbeurteilung vorsehen; keine Mitarbeiter-IDs, Klarnamenpflicht oder HR-Exporte hinzufügen.

Diese Punkte als konkrete Betreiberaufgaben ausweisen; Copilot kann keine Verträge im Namen des Betreibers schließen und keine Unternehmensfreigaben ersetzen.

## 10. Weitere Pflichten nach tatsächlicher Anwendbarkeit

Erstelle eine kurze Anwendbarkeitsmatrix, statt vorsorglich beliebige Rechtstexte zu erzeugen:
- DDG und MStV: Anbieterkennzeichnung.
- DSGVO und TDDDG: tatsächliche Datenverarbeitung und Endgerätezugriffe.
- BFSG/BFSGV und gegebenenfalls einschlägige Barrierefreiheitsvorschriften: Anwendungsbereich prüfen. Nicht jede private kostenlose Event-App fällt automatisch darunter. Unabhängig davon Tastaturbedienung, Kontraste, Fokus, reduzierte Animationen und verständliche Formulare erhalten.
- VSBG, Verbraucherinformationen, Widerruf und Preisangaben nur bei passendem Angebot/Vertrag. Keine Shop-Rechtstexte für ein reines kostenloses Eventquiz erfinden.
- AGB sind kein pauschales gesetzliches Muss. Allenfalls kurze verständliche Spielhinweise zu Punkten, Zeiten, Sichtbarkeit und Verbindungsabbrüchen ergänzen; keine umfassenden AGB ohne Bedarf.
- Urheber- und Lizenzrechte der Fragen, Bilder, Sounds, Schriften und Bibliotheken prüfen; erforderliche Attributionen beziehungsweise Lizenzhinweise bündeln. Öffentlich verfügbare Inhalte nicht automatisch als frei nutzbar behandeln.
- Bei öffentlich einstellbaren Nutzerinhalten, Werbung, Verkäufen, Preisen/Gewinnen, Minderjährigen als Zielgruppe oder KI-Funktionen neu entstandenen Prüfbedarf benennen. Vorhandene Funktionen nicht verschweigen, aber keine hypothetischen Spezialpflichten als bereits geltend darstellen.

## 11. Konfiguration und Freigabeprüfung

- Öffentliche Kontaktdaten zentral pflegen; niemals geheime Konfiguration ins Frontend übernehmen.
- Ergänze einen separaten Befehl wie npm run legal:check, der fehlende Pflichtangaben und aktive Platzhalter nachvollziehbar meldet.
- Lokale Entwicklung muss mit markierten Platzhaltern möglich bleiben.
- Dokumentiere die Prüfung als Voraussetzung vor einer produktiven Veröffentlichung. Keinen neuen automatischen Produktions-Deploy starten.
- Erfinde für die Prüfung keine Bestätigungen organisatorischer Punkte.
- Interne Prüfnotizen gehören in die Dokumentation, nicht als irreführend fertige Zusicherung auf die öffentliche Seite.
- Keine Formulierungen wie „vollständig DSGVO-konform“ oder „alle gesetzlichen Anforderungen erfüllt“.

## 12. Prüfung und Lieferung

Führe passende Checks aus:
1. Typecheck und Produktionsbuild.
2. Impressum und Datenschutz per Direktaufruf ohne Login, auf Smartphonegröße und im SPA-Fallback prüfen.
3. Fehlende Rechtskonfiguration wird durch legal:check erkannt.
4. Optionales Tracking sendet vor Einwilligung keine Requests; falls entfernt, Abwesenheit anhand Netzwerkanfragen prüfen.
5. Berechtigungsprüfung für fremde Sitzung/Subscription und Datenzugriffe.
6. Löschlauf ist wiederholbar, berücksichtigt die vorgesehenen Daten und beeinträchtigt keine anderen Sitzungen.
7. Prüfe Realtime-/Adminfunktion nach Header- und CSP-Änderungen.
8. Dokumentiere, welche Prüfungen lokal, mit Mocks oder tatsächlich in einer AWS-Testumgebung erfolgt sind.

Liefere die Implementierung, die Datenfluss-/Speichertabelle, die Betreibercheckliste und eine kurze Abschlussmeldung mit:
- umgesetzten Änderungen;
- tatsächlich ausgeführten Tests;
- offenen Betreiberangaben und rechtlichen Entscheidungen;
- nicht überprüfbaren AWS-Einstellungen;
- erforderlichen manuellen Schritten vor der weiteren öffentlichen Nutzung.

Beginne mit der Repository-Analyse und setze die eindeutig bestimmbaren Maßnahmen anschließend um.

---

## Ausgangsquellen — bei Umsetzung auf Aktualität prüfen

- § 18 MStV: https://www.gesetze-bayern.de/Content/Document/MStV-18
- § 5 DDG: https://www.gesetze-im-internet.de/ddg/__5.html
- § 25 TDDDG: https://www.gesetze-im-internet.de/ttdsg/__25.html
- DSGVO: https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de
- § 87 BetrVG: https://www.gesetze-im-internet.de/betrvg/__87.html
- BFSG: https://www.gesetze-im-internet.de/bfsg/
- AWS Datenschutz und DPA: https://aws.amazon.com/compliance/data-privacy/ und https://aws.amazon.com/legal/aws-gdpr-dpa/
- Einstellung der OS-Plattform: https://www.ihk.de/regensburg/fachthemen/recht/schlichtung/link-auf-os-plattform-loeschen-6633960

Erstellt für den beschriebenen Stand am 15.11.2026. Eine abschließende rechtliche Einordnung hängt von tatsächlichem Betrieb, Datenflüssen und Betreiberentscheidungen ab.

