# Copilot-Spec: Asynchrones Quiz für RateLama

## Auftrag

Erweitere die bestehende RateLama-App um einen zweiten Spielmodus: **Quiz per Link**. Ein angemeldeter Admin veröffentlicht eine Quizrunde mit einem Ablaufdatum und einer Uhrzeit. Er erhält anschließend einen teilbaren Link. Gäste öffnen diesen Link und spielen das Quiz unabhängig voneinander in ihrem eigenen Tempo. Antworten werden dauerhaft im vorhandenen Backend gespeichert. Der Admin kann die Ergebnisse jederzeit abrufen, während der Laufzeit vorläufig und nach dem Ende als Endergebnis.

Die bisherigen synchronen Live-Quizze bleiben vollständig erhalten. Bestehender Quizeditor, Fragenkatalog, Gastzugang, Tier-Avatare und RateLama-Design sollen wiederverwendet werden. Es geht um eine Erweiterung des bestehenden Projekts, nicht um eine zweite App.

## Paket verwenden

1. Diesen Ordner unter `Spec/ratelama-asynchrones-quiz/` im Repository ablegen. Bestehende abweichende Schreibweise des Spec-Ordners respektieren.
2. Copilot den Startauftrag am Ende dieser Datei geben.
3. `Abnahmefaelle.md` enthält konkrete Beispiele für die Prüfung.

## Festgelegte Standardentscheidungen für die erste Version

Die folgenden Entscheidungen konkretisieren den Auftrag und können später erweitert werden:

| Thema | Festlegung |
| --- | --- |
| Bezeichnung im UI | „Live-Quiz“ und „Quiz per Link“; ergänzende Erklärung „Im eigenen Tempo spielen“ |
| Veröffentlichung | Sofort nach erfolgreicher Bestätigung; keine geplante Startzeit in dieser Version |
| Ablaufzeitpunkt | Datum und Uhrzeit verpflichtend; Zeitzone explizit anzeigen |
| Teilnahme | Smartphone-Browser, ohne Registrierung, ohne E-Mail und ohne echten Namen |
| Spielbeginn | Link öffnen, kurze Informationen sehen, dann mit einem Button starten; keine Lobby und kein Warten auf den Quizmaster |
| Fortschritt | Eine Frage nach der anderen; bestätigte Antworten sind endgültig |
| Zeit je Frage | Kein Einzelfragen-Countdown; die gemeinsame Veröffentlichungsfrist gilt für alle |
| Wertung | Ein Punkt pro richtiger Antwort, keine Geschwindigkeitspunkte |
| Eigener Versuch | Ein Versuch pro bestehender Gastidentität und veröffentlichter Quizrunde |
| Fortsetzen | Bei derselben wiedererkannten Gastidentität am bestätigten Fortschritt fortsetzen |
| Deadline | Harte Frist für neue Starts und neue Antworten, auch für laufende Versuche |
| Auflösung für Gäste | Richtige Antworten und eigener Punktestand erst nach Ende der veröffentlichten Runde |
| Admin-Auswertung | Jederzeit zugänglich; vor Ende klar als vorläufig gekennzeichnet |
| Öffentliche Rangliste | In dieser Version keine; Auswertung nur für den berechtigten Admin und eigene Ergebnisse für Gäste |
| Inhalt | Unveränderlicher Snapshot beim Veröffentlichen |

Die Wertungsregel gilt nur für den neuen Modus. Das Geschwindigkeitspunktesystem des Live-Quiz bleibt unverändert. Eine laufende Quizrunde wird in der ersten Version weder verlängert noch erneut geöffnet. Für einen neuen Durchlauf wird eine neue Veröffentlichung mit neuem Link erstellt.

## Nutzerablauf: Admin

### Modus wählen und Quiz vorbereiten

- In der vorhandenen Quizverwaltung nach Auswahl eines vorbereiteten Quiz die Aktionen „Live-Quiz starten“ und „Quiz per Link veröffentlichen“ anbieten oder eine gleichwertig klare Moduswahl einführen.
- Vorhandenen Quizeditor verwenden. Keine zweite Fragenpflege implementieren.
- Ein gültiges Quiz hat mindestens eine Frage; jede Frage besitzt die bereits unterstützte Anzahl von Antwortmöglichkeiten und genau eine richtige Antwort.
- Vorhandene Pflichtfelder, Bilder und Erklärungen übernehmen, soweit sie zur bestehenden Fragenart gehören.

### Ablaufzeitpunkt festlegen

- Dialog oder eigene kompakte Seite mit Quiztitel, Anzahl der Fragen und Pflichtfeld für Ablaufdatum und Uhrzeit.
- Zeitzone sichtbar, z. B. „Europe/Berlin“. Standard ist die Zeitzone des Admin-Browsers, sofern das Projekt keine bevorzugte Zeitzone vorgibt. Die tatsächliche Zeitzone stets mit anzeigen.
- Eine lokale Eingabe in einen eindeutigen Zeitpunkt umwandeln. Backend speichert UTC und gegebenenfalls die zur Anzeige gewählte Zeitzone.
- Einen Zeitpunkt in der Vergangenheit oder genau jetzt ablehnen, ebenfalls serverseitig. Nicht existente lokale Uhrzeiten bei der Sommerzeitumstellung ablehnen; mehrdeutige Uhrzeiten müssen eindeutig aufgelöst werden, statt sie stillschweigend zu verschieben.
- Keine neue schwere Datumsbibliothek hinzufügen, wenn die vorhandenen Werkzeuge die Anforderungen korrekt erfüllen.
- Vor dem Veröffentlichen klar anzeigen: „Bis zu diesem Zeitpunkt müssen alle Antworten abgegeben sein. Danach sind keine weiteren Antworten möglich.“
- Bestätigungsaktion „Quiz veröffentlichen“ mit Ladezustand und Schutz gegen versehentliches Doppelklicken.

### Link erhalten und teilen

- Erst nach erfolgreicher serverseitiger Veröffentlichung einen kanonischen Link anzeigen, z. B. schematisch `https://ratelama.de/q/<teilnahme-token>`.
- Tatsächlich konfigurierte öffentliche Basis-URL verwenden; keine Produktionsdomain für Preview- oder lokale Umgebungen fest einbauen.
- „Link kopieren“ mit Rückmeldung anbieten. Bei fehlender Clipboard-Unterstützung ein auswählbares Textfeld bereitstellen.
- Ein QR-Code ist sinnvoll, wenn bereits eine Komponente existiert; keine neue Abhängigkeit allein dafür erzwingen.
- Daneben Titel, Ablaufzeitpunkt und Status „Aktiv“ anzeigen.
- Der Admin teilt den Link selbst; keine E-Mails oder Nachrichten automatisch versenden.
- Veröffentlichen bei technischem Retry idempotent behandeln: ein Vorgang erzeugt nicht mehrere Runden oder unterschiedliche Links.

### Veröffentlichte Runden verwalten

- Veröffentlichte Runden getrennt vom wiederverwendbaren Quizentwurf erkennen lassen. Dasselbe Quiz kann mehrere unabhängige Veröffentlichungen besitzen, auch parallel.
- Pro Veröffentlichung Titel, Modus, Ablaufzeitpunkt, Status und Teilnehmer-/Abschlusszahlen anzeigen.
- Aktionen: „Link kopieren“, „Ergebnisse ansehen“, „Vorzeitig beenden“.
- Vorzeitiges Beenden nach Bestätigung, mit Hinweis auf das sofortige Ende aller offenen Teilnahmen. Der bestehende Veröffentlichungslink bleibt als verständliche Endseite erreichbar, lässt aber keine weiteren Antworten zu.
- Abgelaufene und vorzeitig beendete Runden lassen sich auswerten. Ein offener Admin-Browser ist für das Fristende nicht erforderlich.

## Nutzerablauf: Teilnehmer

### Link öffnen

- Direkte mobiloptimierte Einstiegsseite mit Titel, Fragezahl, Ablaufzeitpunkt und kurzer Erklärung „Du spielst in deinem Tempo. Deine Antworten werden gespeichert.“
- Keine Spielcode-Eingabe verlangen, da der Link die Runde bereits identifiziert.
- Kein Konto, keine E-Mail-Adresse und kein Klarname.
- Link-Aufruf allein erzeugt keinen Teilnehmer und startet keinen Versuch. Das verhindert Scheinversuche durch Linkvorschauen, Bots und Prefetching. Erst „Quiz starten“ löst den authentisierten Gast-Join im bestehenden Mechanismus aus.
- Zufälligen Namen und einen Avatar aus dem vorhandenen 50er-Set beim bestätigten Beitritt vergeben. Bestehende Vergaberegeln verwenden; kein neues Avatar-System parallel aufbauen.
- Bei bestehendem Versuch statt erneutem Start „Quiz fortsetzen“ oder den passenden Abschlusszustand anbieten.
- Bei abgelaufenem Link eine freundliche Endseite mit Titel und Endezeit anzeigen; keine leere Seite und kein dauerhafter Ladezustand.
- Ungültiger oder unbekannter Link: neutrale verständliche Fehlermeldung ohne interne IDs oder technische Details.

### Fragen beantworten

- Frage, Antwortoptionen, Fortschritt „Frage 3 von 10“, eigener Name und Avatar anzeigen.
- Kein Beamer und kein Quizmaster notwendig. Die nächste Frage wird nach eigener bestätigter Antwort verfügbar.
- Kein Timer je Frage. Den globalen Ablaufzeitpunkt kompakt sichtbar machen und kurz vor dem Ende deutlich darauf hinweisen. Der Hinweis ist kein eigener fachlicher Timer.
- Auswahl zunächst lokal markieren, danach mit „Antwort abgeben“ bestätigen. Das ist für diesen Modus bewusst anders als die gegebenenfalls direkte Abgabe im Live-Quiz.
- Während des Speicherns Mehrfachabgabe sperren und „Wird gespeichert …“ anzeigen.
- Erst nach Serverbestätigung „Antwort gespeichert“ und „Nächste Frage“ bzw. bei der letzten Frage den Abschluss anzeigen.
- Bereits bestätigte Antworten nicht mehr ändern. Die erste bestätigte Antwort zählt. Die UI muss das vor Abgabe erklären.
- Bei Verbindungsfehlern Auswahl behalten und Wiederholung anbieten; niemals fälschlich „gespeichert“ anzeigen.
- Bei Wiederholung nach unklarem Netzwerkfehler serverseitig erkennen, ob bereits gespeichert wurde, und das bestätigte Ergebnis wieder ausliefern.
- Vor Ablauf weder „richtig/falsch“ noch Punkte, richtige Optionen, Lösungserklärungen oder eine indirekte Auflösung anzeigen.
- Andere Teilnehmer können gleichzeitig in ganz anderen Fragen sein. Es gibt keinen globalen Fragenindex und keine globale Freigabe einzelner Fragen.

### Unterbrechen und fortsetzen

- Jede bestätigte Antwort sofort speichern. Nicht erst alle Antworten im Browser sammeln und am Ende senden.
- Bei Neuladen, Navigation und Wiederverbindung den bestätigten serverseitigen Fortschritt laden. Bereits gespeicherte Antworten bleiben erhalten.
- Eine noch nicht bestätigte lokale Auswahl muss nicht geräteübergreifend wiederhergestellt werden; sie gilt nicht als abgegeben.
- Mehrere Tabs derselben Gastidentität dürfen keine zusätzlichen Versuche, doppelten Antworten oder widersprüchlichen Fortschritte erzeugen. Veraltete Ansichten nach Konflikt mit dem Serverstand abgleichen.
- Ein zweites Gerät oder gelöschter Browser-Speicher kann ohne Registrierung als neuer Gast erscheinen. Die Oberfläche und Dokumentation dürfen deshalb nicht behaupten, es sei technisch „genau eine Teilnahme pro Mensch“ sichergestellt. Kein Fingerprinting einführen.
- Die vorhandene Laufzeit anonymer Kennungen prüfen: insbesondere dürfen Gastkennung oder Wiederaufnahmeinformationen nicht nach pauschal 24 Stunden verfallen, wenn das Quiz länger läuft und Fortsetzen zugesagt wird. Vorhandene Session-/Auth-Mechanismen gezielt anpassen oder einen sicheren versuchsbezogenen Wiederaufnahmebeleg verwenden.
- Wiederaufnahmebelege und Teilnehmer-Geheimnisse gehören nicht in den gemeinsamen Teilnahmelink. Sie dürfen keine fremden Antworten zugänglich machen.
- Browser-Speicher nur gezielt und befristet nutzen. Tatsächliche Zwecke und Fristen in vorhandener technischer Speicherübersicht und passenden Datenschutzhinweisen nachführen; vorhandene Einwilligungs-/Speichervorgaben berücksichtigen. Keine pauschalen rechtlichen Aussagen aus dieser Spec ableiten.

### Versuch abschließen

- Nach Annahme der letzten Antwort den Versuch atomar bzw. konsistent als abgeschlossen markieren. Ein zusätzlicher Abschlussrequest darf nicht Voraussetzung dafür sein, dass vollständig gespeicherte Antworten als vollständig zählen.
- Erfolgsseite: „Deine Antworten sind gespeichert“, Anzahl beantworteter Fragen und Hinweis auf die Veröffentlichung der eigenen Ergebnisse nach Quizende.
- Vor Quizende keine Lösungen oder Punktesumme zeigen. Über denselben Link und dieselbe wiedererkannte Identität später die eigenen Ergebnisse öffnen können.
- Nach Quizende eigene richtige Antworten, eigene Punktesumme, Gesamtzahl der Fragen und Auflösung anzeigen. Keine fremden Einzelantworten oder Teilnehmerdaten offenlegen.
- Falls ein Versuch beim Fristende unvollständig ist: bestätigte Antworten behalten, offene Fragen als „Nicht beantwortet“ markieren und eigenen Versuch als „Frist abgelaufen“ darstellen.

## Frist und Statusmodell

### Veröffentlichte Runde

Fachlich mindestens folgende Zustände unterscheiden:

- **Aktiv:** veröffentlicht, nicht vorzeitig beendet und Serverzeit vor Ablaufzeitpunkt.
- **Abgelaufen:** Serverzeit am oder nach Ablaufzeitpunkt, sofern nicht vorher beendet.
- **Vorzeitig beendet:** vom berechtigten Admin beendet, mit tatsächlichem Endezeitpunkt.

Die effektive Antwortfrist ist der frühere Zeitpunkt aus festgelegter Deadline und gegebenenfalls vorzeitigem Ende. Eine Runde darf keine neuen Starts oder neuen Antworten akzeptieren, sobald die effektive Frist erreicht ist. Wer eine Sekunde vorher beginnt, bekommt keine zusätzliche Bearbeitungsfrist.

Der Zustand darf nicht davon abhängen, dass ein Browser geöffnet ist, ein Polling läuft oder ein Cleanup-Job rechtzeitig ausgeführt wurde. Jede Start-/Antwortmutation muss den tatsächlichen zulässigen Zustand autoritativ prüfen. Gegebenenfalls ein ergänzender Hintergrundjob für Statusmaterialisierung, aber nicht als alleinige fachliche Fristkontrolle.

### Versuch

- `IN_PROGRESS`: gestartet, noch nicht alle Fragen beantwortet und Runde noch aktiv.
- `COMPLETED`: alle Fragen rechtzeitig bestätigt beantwortet.
- `EXPIRED_PARTIAL`: Runde beendet und nicht alle Fragen bestätigt beantwortet; kann beim Lesen abgeleitet werden.

Bereits vollständig abgeschlossene Versuche bleiben abgeschlossen, wenn die Runde später endet. Ein nachträglicher technischer Retry darf eine bereits rechtzeitig gespeicherte Antwort bestätigen; er darf nach Fristende keine neue Antwort erzeugen.

### Grenzfälle

- Serverzeit entscheidet, nicht die Uhr des Endgeräts und nicht ein vom Client übermitteltes Sendedatum.
- Definiere im Code einen einheitlichen autoritativen Prüf-/Annahmezeitpunkt für die Mutation. Eine verspätet eintreffende Antwort wird nicht rückdatiert, auch wenn sie vor Fristende angeklickt wurde.
- Deadlineprüfung, Admin-Beenden, Antwortannahme und Fortschrittsänderung dürfen bei Parallelität keine widersprüchlichen Endzustände erzeugen. Nutze vorhandene atomare/bedingte Schreibmuster und dokumentiere die Konsistenzentscheidung.
- Beim Fristende im geöffneten Browser neue Abgabe deaktivieren und eine verständliche Meldung anzeigen. Ein noch ausstehender Request wird anhand seines tatsächlichen Serverergebnisses aufgelöst, nicht bloß lokal verworfen oder als erfolgreich geraten.
- Nicht angenommene lokale/offline Antworten nach dem Ende nicht automatisch nachsenden oder für die Wertung zählen.

## Wertung

- Für diesen Modus gilt: **richtig = 1 Punkt, falsch oder nicht beantwortet = 0 Punkte**.
- Keine Antwortzeit-Boni und keine Rangentscheidung nach Start- oder Endzeit. Asynchrones Spielen soll keinen Geschwindigkeitswettbewerb erzeugen.
- Server berechnet anhand des veröffentlichten Lösungsschlüssels. Client sendet nur ausgewählte Options-ID, nicht eigene Punktzahlen oder ein `isCorrect`.
- Maximalpunkte = Anzahl der Fragen im veröffentlichten Snapshot.
- Im Admin-Ergebnis zeigen: Punkte, richtige/falsche/nicht beantwortete Fragen, Fortschritt und Abschlussstatus.
- Teilversuche sind sichtbar und behalten ihre Punkte. In einer Rangansicht klar als unvollständig markieren und optional nach „Alle“, „Abgeschlossen“, „Unvollständig“ filtern.
- Gleiche Punktzahlen ergeben denselben fachlichen Rang. Ein stabiler sekundärer Sortierschlüssel darf nur die Darstellung ordnen, keine zusätzliche Leistungsbewertung darstellen.
- Bei null Fragen darf nicht veröffentlicht werden; bei null Teilnehmern oder null Antworten keine ungültigen Prozentwerte anzeigen.

## Admin-Auswertung

Eine eigene Ergebnisseite je Veröffentlichung, ausschließlich für den berechtigten Eigentümer bzw. eine im vorhandenen System explizit berechtigte Admin-Rolle.

### Überblick

- Quiztitel, Modus, Veröffentlichungszeit, Endezeitpunkt und Status.
- Zahl gestarteter Versuche, vollständig abgeschlossener Versuche und offener bzw. abgelaufener Teilversuche.
- Während der Laufzeit Hinweis „Vorläufiger Stand – weitere Antworten sind möglich“ und Zeitpunkt der letzten Aktualisierung.
- Nach dem Ende Hinweis „Endergebnis“ erst verwenden, wenn die Ergebnisdaten den final angenommenen Antworten entsprechen. Bei noch laufender Aggregation einen klaren Berechnungszustand zeigen.
- Aktualisieren-Button; vorhandene Echtzeitfunktionen optional wiederverwenden. Keine neue ständig offene Live-Verbindung oder dauerndes Polling erforderlich.

### Teilnehmerübersicht

- Spielname und Avatar, Status, Fortschritt, Punkte, Startzeit und gegebenenfalls Abschlusszeit.
- Sortierbare Rangansicht mit echten Gleichständen.
- Detailansicht pro Versuch: Frage, ausgewählte Antwort, richtige Antwort, Ergebnis und Zeitpunkt der bestätigten Abgabe.
- Eigene vorhandene Gastkennungen nicht als öffentlich sichtbare Identifikatoren darstellen.
- Größere Datenmengen paginieren. Gesamtauswertung nicht unbemerkt nur aus der ersten Ergebnisseite berechnen.

### Fragenauswertung

- Je Frage Zahl der Antworten und Verteilung über die Optionen; richtige Option kennzeichnen.
- Ausdrücklich angeben, wie viele gestartete Teilnehmer diese Frage nicht beantwortet haben.
- Prozentnenner nachvollziehbar halten: Optionsanteile beziehen sich auf abgegebene Antworten dieser Frage; unbeantwortete Versuche separat ausweisen. Bei null abgegebenen Antworten „Noch keine Antworten“ statt Division durch null.
- Vorläufige bzw. endgültige Statistik konsistent mit den gespeicherten Teilnehmerantworten halten.

Ein CSV-/Excel-Export, E-Mail-Berichte und öffentliche Ergebnislinks sind kein Pflichtumfang dieser Version. Bereits vorhandene passende Exportfunktionen können weiterverwendet werden, wenn dies ohne zusätzliche Ausweitung möglich ist.

## Daten und Architektur

Analysiere zuerst das echte Repository. Die folgenden Begriffe sind ein fachliches Modell; keine Pflicht, genau so benannte Tabellen oder doppelte Strukturen einzuführen.

### Wiederverwendbarer Quizentwurf

Bestehendes Quiz mit Fragen und Optionen. Live-Quiz und Quiz per Link sollen dieselbe fachliche Fragenbasis verwenden können.

### Veröffentlichung / Async-Runde

Benötigte Informationen sinngemäß:

- ID, Eigentümer, Modus `ASYNC`, Titel und Referenz auf Ursprungsquiz.
- Versionierter unveränderlicher Inhaltssnapshot einschließlich Fragenreihenfolge, stabiler Frage-/Options-IDs und serverseitig geschütztem Lösungsschlüssel.
- Veröffentlichungszeit, `expiresAt` als eindeutiger UTC-Zeitpunkt, Anzeigezeitzone.
- Optional vorzeitiger Endezeitpunkt und Grund.
- Sichere öffentliche Teilnahme-Referenz bzw. Link-Token.
- Snapshot der Wertungsregel.
- Bestehende Fristen für Aufbewahrung und Löschung, unabhängig von der Bearbeitungsfrist.

Bearbeiten oder Löschen des ursprünglichen Entwurfs darf die laufende veröffentlichte Runde und ihre Wertung nicht still verändern. Auch eingebundene Medien müssen für die vorgesehene Lebensdauer verfügbar bleiben oder durch vorhandene Löschregeln geschützt sein.

### Versuch / Teilnehmer

- ID, Veröffentlichungs-ID, bestehende authentisierte Gastidentität bzw. sichere Wiederaufnahmezuordnung.
- Bestätigter zufälliger Name und `avatarId` aus dem bestehenden System.
- Startzeit, Status, abgeschlossene Frageposition/Version, optional Abschlusszeit.
- Eindeutigkeits-/Idempotenzbezug für dieselbe Gastidentität in derselben Veröffentlichung.

### Antwort

- Veröffentlichungs-ID, Versuch-ID, Frage-ID, ausgewählte Options-ID und serverseitiger Annahmezeitpunkt.
- Fachlich höchstens eine bestätigte Antwort je Versuch und Frage.
- Passende Idempotenz-/Konfliktbehandlung für Retries und parallele Tabs.
- Ergebnis/Punkte nur geschützt speichern bzw. aus dem geschützten Snapshot berechnen. Keine vorzeitige Freigabe über generische Modell-Reads oder Subscriptions.

### Schnittstellen und Zugriffe

Sinngemäß benötigt werden:

1. Veröffentlichung anlegen, eigene Veröffentlichungen listen und eigene Runde beenden.
2. Öffentliche Metadaten über den Teilnahmelink auflösen, ohne Lösungen und ohne Teilnehmerliste.
3. Eigenen Versuch starten oder wiederaufnehmen.
4. Eigenen Fortschritt und zulässige Frageinhalte laden.
5. Eigene Antwort idempotent abgeben und bestätigten Fortschritt zurückgeben.
6. Eigene Ergebnisse nach Rundenende lesen.
7. Admin-Auswertung und Teilnehmerdetails mit Eigentümer-/Rollenprüfung lesen.

Framework und vorhandene Custom Operations/Resolver/Lambdas verwenden. Keine externe API und keinen vollständigen Infrastruktur-Neubau vorgeben. Bestehende AWS-Amplify-/DynamoDB-Strukturen additiv erweitern, ohne den Live-Pfad fachlich umzudeuten.

## Zugriffsschutz und Linkverhalten

- Öffentlicher Link gewährt Teilnahmezugang, niemals Adminrechte oder Zugriff auf die Ergebnisse anderer Gäste.
- Teilnahme-Token serverseitig kryptografisch zufällig erzeugen; mindestens 128 Bit Entropie. Nicht einfach fortlaufende IDs als geheime Zugangsdaten verwenden.
- Linkwissen ist die Zugangsvoraussetzung; wer den Link weitergibt, ermöglicht weiteren Gästen die Teilnahme. Keine verifizierten Einladungen oder Personenprüfung versprechen.
- Teilnahmetoken, Gastbelege und Authentifizierungsdaten nicht unnötig in Logs oder Analysedienste schreiben. Bestehende Access-Logs und Fehlerberichte auf unbeabsichtigte Offenlegung prüfen.
- Gäste dürfen nur ihren eigenen Versuch und ihre eigenen Antworten lesen/schreiben. Clientseitig mitgesendete Besitzer- oder Versuch-IDs sind kein Berechtigungsnachweis.
- Lösungsschlüssel, richtige Optionen, Punktestände und Lösungserklärungen vor Ende aus sämtlichen Gast-Responses herauslassen, einschließlich Mutationsantworten, Caches, vorab geladenen Snapshots und Fehlerdetails.
- Admin darf den aktuellen Stand schon vor Ende auswerten. Diese Berechtigung muss serverseitig geprüft werden.
- Veröffentlichte Quizseiten nicht über eine öffentliche Liste aller aktiven Runden auffindbar machen. `noindex` für Teilnahme-/Ergebnisseiten vorsehen, aber nicht als Zugriffsschutz behandeln.
- Bestehenden Missbrauchsschutz und Request-Limits weiterverwenden. Keine unbegrenzten neuen öffentlichen Schreibzugriffe auf generische Modelle öffnen.
- Aufbewahrungsende und Quizende sind unterschiedliche Zeitpunkte. Nicht sämtliche Antworten bei Erreichen der Bearbeitungsfrist löschen; sonst kann der Admin das Ergebnis später nicht ansehen. Vorhandene tatsächliche Aufbewahrungsregeln übernehmen und anzeigen; nicht pauschal „für immer“ speichern.
- Falls noch keine nutzbare Aufbewahrungsregel existiert, einen zentralen konfigurierbaren Standard von 30 Tagen nach tatsächlichem Rundenende für asynchrone Ergebnisse vorsehen, dem Admin vor Veröffentlichung anzeigen und mit vorhandenen Vorgaben abgleichen. Keine bereits bestehenden strengeren Vorgaben überschreiben. Abhängige Antworten, Versuche und Wiederaufnahmeinformationen bei endgültiger Bereinigung gemeinsam berücksichtigen.

## Oberfläche und bestehendes Design

- RateLama-Farben, Typografie, Buttons und die vorhandenen 50 Tier-Avatare weiterverwenden. Keine neue Markenwelt.
- Moduswahl klar erklären: „Live-Quiz: Alle spielen gleichzeitig“ und „Quiz per Link: Jeder spielt bis zum Ablaufdatum im eigenen Tempo“.
- Im asynchronen Modus keine globale Live-Teilnehmeranzeige, keine Quizmaster-Wartebildschirme und keinen Einzelfragen-Countdown aus dem Live-Modus übernehmen.
- Mobile Antwortkarten ausreichend groß, Texte vollständig lesbar und Lade-/Fehlerzustände sichtbar halten.
- Ablaufzeit für Gäste in ihrer erkennbar angegebenen Zeitzone anzeigen; bei unterschiedlichen Zeitzonen muss stets derselbe Zeitpunkt gemeint sein.
- Abschluss und abgelaufene Runde als verständliche Zustände gestalten. Keine technische Fehlermeldung, wenn der Link fachlich einfach beendet ist.
- Vorhandene Impressums-/Datenschutzlinks ohne Login erreichbar halten. Angepasste Speicher-/Aufbewahrungsinformationen müssen zur tatsächlichen Implementierung passen.

## Implementierungsreihenfolge

1. Repository-Anweisungen und bestehenden Live-Ablauf, Authentifizierung, Gastlebensdauer, Datenmodell, Fristen und Designkomponenten analysieren. Eine kurze Zuordnung zu bestehenden Bausteinen geben und dann direkt implementieren.
2. Modusunterscheidung und unveränderliche Veröffentlichung mit Deadline und sicherem Teilnahmelink ergänzen.
3. Autoritative Start-/Antwort-/Wiederaufnahmeoperationen mit Zugriffs- und Fristprüfung umsetzen.
4. Admin-Veröffentlichungsdialog und geteilten Link integrieren.
5. Mobile asynchrone Teilnahme vom Link bis zum Abschluss umsetzen.
6. Admin-Auswertung, Fristende, vorzeitiges Beenden und spätere eigene Ergebnisse ergänzen.
7. Aufbewahrung, Gast-Lebensdauer, Löschung und Fehler-/Reconnect-Verhalten mit bestehenden Regeln abgleichen.
8. Gezielte Tests und passende vorhandene Lint-/Typecheck-/Build-Prüfungen ausführen. Abnahmefälle aus der Begleitdatei prüfen. Live-Quiz-Regression testen.

Bei Routineentscheidungen selbstständig im vorhandenen Projektstil vorgehen. Nur bei echten, aus dem Repository nicht auflösbaren fachlichen Widersprüchen nachfragen. Keine Veröffentlichung, kein produktives Deployment und keine Löschung bestehender Runden aus diesem Auftrag ableiten.

## Definition of Done

- Admin kann ein vorhandenes Quiz als Quiz per Link mit zukünftiger eindeutiger Deadline veröffentlichen und den zurückgegebenen Link kopieren.
- Mehrere Gäste können unabhängig voneinander zu verschiedenen Zeiten spielen, mit eigenem Fortschritt, Namen und Avatar.
- Antworten werden einzeln gespeichert, sind nach Bestätigung endgültig und bleiben bei Wiederaufnahme erhalten.
- Server verhindert neue Starts und neue Antworten am/nach dem effektiven Ende, auch bei manipuliertem Client, geschlossenen Browsern oder verzögerten Hintergrundjobs.
- Admin sieht vorläufige und abschließende Ergebnisse einschließlich einzelner Antworten und Fragenauswertung.
- Gäste sehen vor Ende keine Lösungen und später ausschließlich die eigenen Ergebnisse.
- Keine Doppelspeicherung durch Retries/Mehrfachtabs, keine Teilnahme mit fremden Versuchsrechten.
- Veröffentlichtes Quiz bleibt trotz Änderung des Entwurfs stabil.
- Ergebnisse bleiben nach der Bearbeitungsfrist im vorgesehenen Aufbewahrungszeitraum abrufbar.
- Live-Quiz funktioniert unverändert, einschließlich Geschwindigkeitspunkten und Quizmaster-Steuerung.
- Prüfungen und reale Einschränkungen werden im Abschlussbericht mit betroffenen Dateien dokumentiert. Nicht ausgeführte Browser-/AWS-Tests nicht als bestanden melden.

## Startauftrag für GitHub Copilot

```text
Implementiere den neuen Modus „Quiz per Link“ anhand von Spec/ratelama-asynchrones-quiz/Anleitung.md. Lies zuerst die Repository-Anweisungen und prüfe die vorhandenen Quiz-, Authentifizierungs- und Gastmechanismen. Der Admin veröffentlicht ein Quiz mit Ablaufdatum und Uhrzeit und erhält einen teilbaren Link. Gäste spielen ohne Registrierung unabhängig im eigenen Tempo; jede Antwort wird serverseitig gespeichert. Der Admin kann Ergebnisse jederzeit einsehen. Vor Ende keine Lösungen für Gäste zeigen. Beachte die Regeln zu Fristprüfung, Quiz-Snapshot, Wiederaufnahme, Idempotenz und Aufbewahrung sowie die Fälle in Abnahmefaelle.md. Verwende bestehendes RateLama-Design und Avatare. Erhalte das Live-Quiz unverändert. Beginne nach kurzer Bestandsaufnahme direkt mit der Umsetzung und führe passende Prüfungen aus. Kein produktives Deployment.
```
