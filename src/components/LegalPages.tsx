import { Link } from "react-router-dom";
import { legal, legalDraft, openLegalFields } from "../config/legal";

function DraftBanner() {
  if (!legalDraft) return null;
  return <p role="note" className="legal-draft">
    <strong>Entwurf – nicht veröffentlichungsreif.</strong> Es fehlen noch Angaben des Betreibers: {openLegalFields().join(", ")}.
    Diese Seite ist keine Rechtsberatung und muss vor dem Livegang vom Betreiber geprüft werden.
  </p>;
}

function Address() {
  return <address className="legal-address">
    {legal.providerName}<br />{legal.street}<br />{legal.postalCode} {legal.city}<br />{legal.country}
  </address>;
}

export function ImpressumPage() {
  return <article className="legal-page" aria-labelledby="impressum-heading">
    <h1 id="impressum-heading">Impressum</h1>
    <DraftBanner />
    <section>
      <h2>Anbieter</h2>
      <p>Angaben zur Anbieterkennzeichnung nach § 5 DDG und § 18 Abs. 1 Medienstaatsvertrag, soweit diese Vorschriften anwendbar sind.
        Betreiber von {legal.appName} ist eine Privatperson.</p>
      <Address />
    </section>
    <section>
      <h2>Kontakt</h2>
      <p>E-Mail: {legal.contactEmail}</p>
      {legal.additionalContact && <p>{legal.additionalContact}</p>}
    </section>
    <section>
      <h2>Hinweis</h2>
      <p>{legal.appName} ist ein privat betriebenes Angebot zum gemeinsamen Quizspielen. Informationen zur Verarbeitung personenbezogener Daten
        finden Sie in der <Link to="/datenschutz">Datenschutzerklärung</Link>.</p>
    </section>
  </article>;
}

const storageRows: { key: string; purpose: string; duration: string; who: string }[] = [
  { key: "com.amplify.Cognito.<Identity-Pool-ID>.identityId", purpose: "Technische Gast-Kennung für angeforderte Cloud-Funktionen; sie ist von Zugangsdaten und serverseitiger Spielteilnahme getrennt.",
    duration: `Standardmäßig 24 Stunden. Bei einem ausdrücklich gestarteten Quiz per Link bis zum Ende der Ergebnis-Aufbewahrung (maximal ${legal.asyncResultsRetentionDays} Tage nach dem Rundenende), damit der Versuch fortgesetzt werden kann. Lesen oder erneutes Schreiben allein verlängert die Frist nicht.`,
    who: "Mitspielende, Präsentationsansicht" },
  { key: "quizrush.expiry.<…>", purpose: "Lokaler Ablaufzeitpunkt der Gast-Kennung",
    duration: "Wird zusammen mit der Kennung entfernt; die Bereinigung erfolgt bei Fristablauf im offenen Tab oder bei der nächsten Ausführung nach Rückkehr.", who: "Mitspielende, Präsentationsansicht" },
  { key: "CognitoIdentityServiceProvider.<Client-ID>.*", purpose: "SDK-verwaltete Quizmaster-Anmeldung einschließlich Access-, ID- und Refresh-Token",
    duration: "Access- und ID-Token höchstens 60 Minuten, Refresh-Token höchstens einen Tag ab Anmeldung. Amplify kann Access- und ID-Tokens währenddessen erneuern; die Erneuerung verlängert die Refresh-Frist nicht. Abmeldung entfernt die lokale Sitzung.", who: "Quizmaster" },
  { key: "quizrush.local-drafts.v1", purpose: "Quiz-Entwürfe im lokalen Entwurfsmodus; Zugriff erst nach Aktivierung, Speicherung erst nach ausdrücklichem Speichern",
    duration: "Bis zur gezielten Löschung oder zum Entfernen der Website-Daten. Ausschalten der Funktion löscht vorhandene Entwürfe nicht.", who: "Nur im lokalen Entwurfsmodus" },
];

export function PrivacyPolicyPage() {
  const retention = legal.sessionRetentionDays;
  return <article className="legal-page" aria-labelledby="privacy-policy-heading">
    <h1 id="privacy-policy-heading">Datenschutzerklärung</h1>
    <DraftBanner />
    <section>
      <h2>1. Verantwortlicher</h2>
      <Address />
      <p>E-Mail: {legal.privacyContactEmail}</p>
      <p>{legal.dataProtectionOfficer ? `Datenschutzbeauftragter: ${legal.dataProtectionOfficer}` :
        "Ein Datenschutzbeauftragter ist nicht benannt."}</p>
    </section>
    <section>
      <h2>2. Worum es geht</h2>
      <p>{legal.appName} ist eine Live-Quiz-Anwendung. Diese Erklärung beschreibt, welche personenbezogenen Daten beim Besuch der Website,
        beim Mitspielen und im Quizmaster-Bereich verarbeitet werden, wozu das geschieht und welche Rechte du hast.</p>
    </section>
    <section>
      <h2>3. Besuch der Website und Server-Logs</h2>
      <p>Die Website wird über AWS Amplify Hosting ausgeliefert. Beim Aufruf verarbeitet der Hosting-Dienst technisch notwendige Verbindungsdaten
        (insbesondere IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser-Angaben), um die Seite auszuliefern und den Betrieb abzusichern.</p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Interesse an einem sicheren und stabilen Betrieb). Die Startseite, das Impressum und diese
        Datenschutzerklärung erzeugen keine Gast-Kennung und lösen keine Anfrage an die Spiel-Schnittstelle aus. Beim App-Start wird außerdem
        die öffentliche Konfigurationsdatei vom selben Website-Ursprung geladen; sie enthält keine Anmelde- oder Gastdaten.</p>
    </section>
    <section>
      <h2>4. Mitspielen</h2>
      <p>Zum Mitspielen gibst du einen Beitrittscode ein. Du brauchst kein Konto und gibst weder Klarnamen noch E-Mail-Adresse an.
        Spielname und Avatar werden automatisch vergeben. Verarbeitet werden:</p>
      <ul>
        <li>eine anonyme technische Kennung (Cognito-Identität) und eine Teilnahme-Kennung,</li>
        <li>Spielname und Avatar (Pseudonym; andere können dich im Spielkontext dennoch erkennen),</li>
        <li>deine Antworten, Antwortzeiten, Punkte und Platzierung,</li>
        <li>technische Beitrittsdaten wie Zeitpunkt und Sitzung.</li>
      </ul>
      <p>Spielname, Avatar, Punkte und Platzierung sind für die anderen Teilnehmenden, den Quizmaster und eine Präsentationsansicht sichtbar.
        Wer den Präsentationslink kennt, kann die Präsentationsansicht der Sitzung öffnen.</p>
      <p>Zweck: Durchführung und Auswertung der Spielrunde. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Interesse an der Durchführung der
        Spielrunde); die Teilnahme ist freiwillig. Es werden keine Daten zur Bewertung von Personen außerhalb des Spiels genutzt.</p>
      <p>Es findet keine ausschließlich automatisierte Entscheidung mit rechtlicher oder ähnlich erheblicher Wirkung nach Art. 22 DSGVO statt.
        Punkte und Platzierungen dienen ausschließlich dem Spiel.</p>
    </section>
    <section>
      <h2>5. Quizmaster-Konto</h2>
      <p>Für den Quizmaster-Bereich wird ein Konto mit E-Mail-Adresse und Passwort bei Amazon Cognito angelegt. Das Passwort wird nicht im Klartext
        gespeichert. Gespeichert werden außerdem deine Quizvorlagen sowie die von dir gestarteten Sitzungen mit Beitrittscode und Präsentationslink.
        Die Freigabe als Quizmaster erfolgt durch die Administration.</p>
      <p>Erst wenn du eine Anmeldung startest, legt Amplify die zugehörigen Tokens im Browser-Speicher ab. Ein noch gültiges Refresh-Token kann
        abgelaufene Access- und ID-Tokens erneuern; deren Ablauf beendet die gesamte Anmeldung daher nicht zwingend. Die im Backend definierte
        Höchstdauer beträgt 60 Minuten für Access- und ID-Tokens sowie einen Tag für das Refresh-Token. Die Refresh-Frist wird durch Erneuerungen
        nicht verlängert. Eine Funktion „Angemeldet bleiben“ gibt es nicht. Der Betreiber muss nach dem Backend-Deployment prüfen, dass der
        Cognito-Pool diese Werte tatsächlich verwendet. Beim Abmelden ruft die Anwendung Amplifys Abmeldefunktion auf.</p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des gewünschten Kontos) und lit. f (Missbrauchs- und Zugriffsschutz).</p>
    </section>
    <section>
      <h2>6. Speicherung im Browser und TDDDG</h2>
      <p>Der Frontend-Code verwendet Amplifys Standard-Browserspeicher (localStorage), nicht CookieStorage, und setzt selbst keine Cookies.
        Im geprüften lokalen Browserlauf wurden weder Cookies noch Set-Cookie-Antwortheader beobachtet. Ob Hosting oder CDN im Produktivbetrieb
        eigene Set-Cookie-Header ausliefern, ist damit nicht geprüft. Die Anwendung verwendet keine Analyse-, Werbe- oder Tracking-Dienste und lädt
        keine externen Schriftarten. Beim Öffnen eines Quiz-per-Link-Teilnahmelinks, beim Beitritt zu einem Live-Spiel, in Live-Spiel- und
        Präsentationsansichten sowie bei einer gestarteten Quizmaster-Anmeldung werden für diese Funktionen Anfragen an AWS-Dienste gesendet.
        Das bloße Öffnen des Links legt keinen Quizversuch an.</p>
      <p>§ 25 TDDDG betrifft das Speichern von Informationen in einer Endeinrichtung und den Zugriff darauf. Die Ausnahme in Absatz 2 Nummer 2 ist
        auf den jeweils ausdrücklich gewünschten digitalen Dienst und die dafür unbedingt erforderlichen Zugriffe zu beziehen; nicht jeder
        localStorage-Eintrag ist allein wegen der SDK-Nutzung automatisch erforderlich. Die technische Gast-Kennung wird erst beim angeforderten
        angeforderten Cloud-Zugriff benötigt. Beim ausdrücklichen Start eines Quiz per Link wird ihre lokale Ablaufzeit bis zur Ergebnis-Aufbewahrung
        verlängert, damit ein bereits begonnener Versuch wiederaufgenommen werden kann. Die optionale Entwurfsspeicherung ist standardmäßig
        ausgeschaltet; bestehende Entwürfe werden erst nach bewusster
        Aktivierung gelesen und neue erst nach ausdrücklichem Speichern abgelegt. Diese Funktionsauswahl ist keine pauschale Einwilligung und wird
        nicht als automatisch rechtlich ausreichende TDDDG-Einwilligung ausgegeben. Die endgültige rechtliche Einordnung hängt auch vom konkreten
        Dienstangebot und der Live-Konfiguration ab.</p>
      <p>Temporäre AWS-Zugangsdaten werden vom SDK nur im Arbeitsspeicher gehalten und unabhängig von der lokalen Kennung erneuert bzw. verworfen.
        Die serverseitige Spielteilnahme hat wiederum ihre eigene Ablaufzeit. Das Ablaufen der lokalen Kennung löscht daher weder serverseitige
        Spieldaten noch ersetzt es deren serverseitige Ablaufprüfung.</p>
      <p>Eine etwaige Ausnahme nach § 25 TDDDG ersetzt nicht die gesonderte Prüfung der anschließenden Verarbeitung personenbezogener Daten nach
        der DSGVO. Deren Rechtsgrundlagen und Informationspflichten sind separat zu beurteilen; diese Datenschutzerklärung ist selbst keine
        Einwilligung.</p>
      <p>Maßstab dieser Information sind <a href="https://www.gesetze-im-internet.de/ttdsg/__25.html" rel="noopener noreferrer">§ 25 TDDDG</a>
        {" "}und die <a href="https://www.datenschutzkonferenz-online.de/orientierungshilfen.html" rel="noopener noreferrer">
          Orientierungshilfen der Datenschutzkonferenz</a>, insbesondere die dort aufgeführte Orientierungshilfe für digitale Dienste
        (November 2024). Die konkrete rechtliche Einordnung ist nicht abschließend geprüft.</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead><tr><th scope="col">Eintrag</th><th scope="col">Zweck</th><th scope="col">Dauer</th><th scope="col">Betrifft</th></tr></thead>
          <tbody>{storageRows.map((row) => <tr key={row.key}>
            <td><code>{row.key}</code></td><td>{row.purpose}</td><td>{row.duration}</td><td>{row.who}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
    <section>
      <h2>7. Empfänger und Auftragsverarbeiter</h2>
      <p>Für Hosting, Datenbank, Anmeldung und Echtzeit-Funktionen wird Amazon Web Services (AWS) als Auftragsverarbeiter eingesetzt
        (u. a. Amplify Hosting, AppSync, Lambda, DynamoDB, Cognito, Step Functions). Die Backend-Dienste sind in der Region Europa (Frankfurt,
        eu-central-1) eingerichtet. Die Auslieferung der Website erfolgt über das Auslieferungsnetz von AWS.</p>
      <p>Nach den Angaben von AWS wählt der Kunde die Region der Inhalte; eine Verarbeitung durch AWS-Konzerngesellschaften außerhalb des
        Europäischen Wirtschaftsraums, etwa für Betrieb oder Support, lässt sich nicht vollständig ausschließen. Soweit dies geschieht, stützt
        sich die Übermittlung auf die von AWS bereitgestellten vertraglichen und organisatorischen Garantien. Eine Weitergabe an sonstige
        Dritte oder zu Werbezwecken findet nicht statt.</p>
    </section>
    <section>
      <h2>8. Speicherdauer und Löschung</h2>
      <ul>
        <li>Sitzungsdaten (Teilnahme, Antworten, Ergebnisse, Beitritts- und Präsentationscode): spätestens {retention} Tage nach Erstellung der
          Sitzung. Danach sind die Daten nicht mehr abrufbar; die physische Löschung in der Datenbank erfolgt automatisch, kann aber technisch
          zeitversetzt (in der Regel innerhalb einiger Tage) erfolgen.</li>
        <li>Quiz per Link: Veröffentlichungsinhalt, Versuche und Antworten bleiben bis zu {legal.asyncResultsRetentionDays} Tage nach dem tatsächlichen
          Rundenende für die eigene Auswertung und Wiederaufnahme gespeichert. Danach sind die Daten nicht mehr abrufbar; die technische Löschung
          erfolgt automatisch und kann zeitversetzt sein. Der Quizentwurf kann unabhängig davon geändert oder gelöscht werden.</li>
        <li>Deine eigene Teilnahme kannst du im Spiel jederzeit löschen, solange keine Frage läuft. Die Teilnahme wird sofort unzugänglich,
          Antworten und Ergebnisse werden entfernt. Die technische Gast-Kennung wird nicht gelöscht, da sie auch für andere noch offene Runden
          verwendet werden kann; sie enthält keine direkt angegebenen Kontaktdaten.</li>
        <li>Technische Logs (Betrieb, Fehleranalyse): {legal.logRetentionDays} Tage, soweit die Aufbewahrung im Betrieb entsprechend eingerichtet ist.</li>
        <li>Quizvorlagen und Quizmaster-Konten: bis zur Löschung durch den Quizmaster bzw. auf Anfrage.</li>
        <li>Gast-Kennung im Browser: standardmäßig höchstens 24 Stunden, bei einem gestarteten Quiz per Link bis zur dort ausgewiesenen
          Ergebnis-Aufbewahrungsfrist. Die Anwendung prüft den Fristablauf im geöffneten Tab und bei Rückkehr zur Seite. Ist der Browser geschlossen,
          kann JavaScript nicht punktgenau löschen; die lokale Frist ist keine serverseitige Sicherheitsgrenze. Serverseitige Zugriffe werden
          zusätzlich anhand der serverseitigen Fristen geprüft.</li>
      </ul>
    </section>
    <section>
      <h2>9. Deine Rechte</h2>
      <p>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und
        Datenübertragbarkeit (Art. 20 DSGVO), soweit die Voraussetzungen vorliegen. Beruht die Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO, kannst du
        ihr aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit widersprechen (Art. 21 DSGVO).</p>
      <p>Spieldaten sind pseudonym. Damit wir deine Daten finden können, nenne uns bitte den Beitrittscode oder Zeitpunkt der Sitzung, deinen Spielnamen
        und Avatar. Ohne diese Angaben können wir dich unter Umständen nicht identifizieren (Art. 11, Art. 12 Abs. 6 DSGVO).
        Kontakt: {legal.privacyContactEmail}.</p>
      <p>Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).{" "}
        {legal.supervisoryAuthority ? <>Zuständig ist: <a href={legal.supervisoryAuthority.url} rel="noopener noreferrer">{legal.supervisoryAuthority.name}</a>.</> :
          "Die zuständige Aufsichtsbehörde wird nach Bestätigung des Wohnorts des Betreibers ergänzt."}</p>
    </section>
    <section>
      <h2>10. Pflicht zur Bereitstellung und Sicherheit</h2>
      <p>Du bist nicht verpflichtet, Daten bereitzustellen. Ohne die beschriebenen technischen Daten ist ein Mitspielen jedoch nicht möglich.
        Die Verbindung zu {legal.appName} ist per TLS verschlüsselt; Zugriffe sind rollenbasiert beschränkt und begrenzt (Rate-Limits).</p>
    </section>
    <section>
      <h2>11. Änderungen</h2>
      <p>Wir passen diese Erklärung an, wenn sich Funktionen oder Rechtslage ändern. Bitte beachte die jeweils aktuelle Fassung.
        Zurück zur <Link to="/">Startseite</Link>.</p>
    </section>
  </article>;
}
