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
  { key: "com.amplify.Cognito.<Identity-Pool-ID>.identityId", purpose: "Anonyme Gast-Kennung, damit deine Teilnahme und deine Antworten dir zugeordnet werden können",
    duration: "Höchstens 24 Stunden, danach wird sie verworfen. Wird beim Löschen deiner Teilnahme entfernt.", who: "Mitspielende, Präsentationsansicht" },
  { key: "quizrush.expiry.<…>", purpose: "Zeitpunkt, an dem die Gast-Kennung verfällt", duration: "Wie die Gast-Kennung", who: "Mitspielende, Präsentationsansicht" },
  { key: "CognitoIdentityServiceProvider.<Client-ID>.*", purpose: "Anmeldung im Quizmaster-Bereich (Token der Sitzung)",
    duration: "Bis zur Abmeldung bzw. Ablauf der Anmeldung", who: "Quizmaster" },
  { key: "quizrush.local-drafts.v1", purpose: "Quiz-Entwürfe im lokalen Entwurfsmodus ohne Cloud", duration: "Bis du sie löschst", who: "Nur im lokalen Entwurfsmodus" },
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
        Datenschutzerklärung lösen keine Anfragen an die Spiel-Schnittstelle aus und erzeugen keine Gast-Kennung.</p>
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
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des gewünschten Kontos) und lit. f (Missbrauchs- und Zugriffsschutz).</p>
    </section>
    <section>
      <h2>6. Speicherung im Browser und TDDDG</h2>
      <p>{legal.appName} setzt keine Cookies und verwendet keine Analyse-, Werbe- oder Tracking-Dienste, keine externen Schriftarten und keine
        externen Skripte. Es wird ausschließlich der lokale Speicher (localStorage) deines Browsers genutzt, soweit dies für den ausdrücklich
        gewünschten Dienst unbedingt erforderlich ist (§ 25 Abs. 2 Nr. 2 TDDDG). Eine Einwilligung ist dafür nicht erforderlich; es gibt daher
        keinen Cookie-Banner.</p>
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
        <li>Deine eigene Teilnahme kannst du im Spiel jederzeit löschen, solange keine Frage läuft. Die Teilnahme wird sofort unzugänglich,
          Antworten und Ergebnisse werden entfernt. Die anonyme Cognito-Kennung selbst wird dabei nicht gelöscht, enthält aber keine Angaben zu
          deiner Person.</li>
        <li>Technische Logs (Betrieb, Fehleranalyse): {legal.logRetentionDays} Tage, soweit die Aufbewahrung im Betrieb entsprechend eingerichtet ist.</li>
        <li>Quizvorlagen und Quizmaster-Konten: bis zur Löschung durch den Quizmaster bzw. auf Anfrage.</li>
        <li>Gast-Kennung im Browser: höchstens 24 Stunden.</li>
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
