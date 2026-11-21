import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, Presentation as PresentationIcon, Users } from "lucide-react";
import { cloud, type AsyncPublicationSummary } from "../../cloud";
import { formatDateTimeWithZone } from "../../domain/localTime";
import { displayQuizLink, shortQuizLink } from "../../shareLinks";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CopyAction } from "../common/CopyAction";
import { JoinCodeBlock } from "../common/JoinCodeBlock";
import { message } from "../common/message";
import { ErrorNotice } from "../common/Notices";
import { routes } from "../routes";
import { asyncStatusText, liveAsyncStatus } from "./dashboardStatus";

export function AsyncPublicationCard({ publication, now, busy, onEnd }: {
  publication: AsyncPublicationSummary; now: number; busy: boolean; onEnd: () => void;
}) {
  const [assigned, setAssigned] = useState<string | null>(null);
  const [assignError, setAssignError] = useState("");
  const status = liveAsyncStatus(publication.status, publication.expiresAt, now);
  const active = status === "ACTIVE";
  const joinCode = publication.joinCode ?? assigned;
  const requestJoinCode = useCallback(() => {
    let live = true;
    cloud.ensureAsyncJoinCode(publication.publicationId).then((result) => { if (live) setAssigned(result.joinCode); },
      (caught) => { if (live) setAssignError(message(caught)); });
    return () => { live = false; };
  }, [publication.publicationId]);
  // Rounds from before quiz codes existed: the server assigns a code once; it is only shown after confirmation.
  useEffect(() => {
    if (!active || joinCode) return;
    return requestJoinCode();
  }, [active, joinCode, requestJoinCode]);
  return <article className={`card async-publication-card${active ? "" : " is-ended"}`}>
    <span className={`badge async-status-${status.toLowerCase()}`}>{asyncStatusText(status)}</span>
    <h3>{publication.title}</h3>
    <p className="async-card-deadline"><Clock3 aria-hidden="true" />
      {active ? "Mitspielen bis" : "Beendet am"}{" "}
      <strong>{formatDateTimeWithZone(active ? publication.expiresAt : publication.endedAt ?? publication.expiresAt, publication.timeZone)}</strong></p>
    {active && (joinCode ? <>
      <JoinCodeBlock joinCode={joinCode} title={publication.title} />
      <p className="async-card-link">{displayQuizLink(joinCode)}</p>
    </> : assignError ? <ErrorNotice error={`Quiz-Code konnte nicht vergeben werden: ${assignError}`}>
      <button type="button" className="rl-btn rl-btn-secondary rl-btn-small"
        onClick={() => { setAssignError(""); requestJoinCode(); }}>Erneut versuchen</button>
    </ErrorNotice> : <p className="rl-hint" role="status">Quiz-Code wird vergeben …</p>)}
    <p className="async-card-participants"><Users aria-hidden="true" />
      {publication.participantCount}/{publication.maxParticipants} gestartet · {publication.completedCount} fertig · {publication.partialCount} offen</p>
    <div className="rl-adm-card-actions">
      {active && joinCode && <a className="rl-btn rl-btn-primary rl-btn-small" href={routes.invitation(joinCode)} target="_blank" rel="noopener">
        <PresentationIcon aria-hidden="true" />Einladung anzeigen</a>}
      {active && joinCode && <CopyAction text={shortQuizLink(joinCode)} label="Link kopieren" copiedMessage="Link kopiert."
        fieldLabel={`Teilnahmelink für ${publication.title}`} />}
      <Link className={`rl-btn ${active ? "rl-btn-secondary" : "rl-btn-primary"} rl-btn-small`}
        to={routes.asyncResults(publication.publicationId)}>Ergebnisse ansehen</Link>
    </div>
    {active && <details className="rl-details async-card-more">
      <summary>Weitere Aktionen</summary>
      <div className="rl-details-body">
        <ConfirmDialog title="Quizrunde beenden?" variant="warning" confirmLabel="Jetzt beenden"
          description={`„${publication.title}“ jetzt für alle Teilnehmenden beenden? Offene Teilnahmen enden sofort. Weitere Antworten werden nicht mehr angenommen. Link, QR-Code und Quiz-Code zeigen danach nur noch die Endseite mit Ergebnissen.`}
          onConfirm={onEnd} confirmDisabled={busy}
          trigger={<button type="button" className="rl-btn rl-btn-danger-soft rl-btn-small" disabled={busy}>Vorzeitig beenden</button>} />
      </div>
    </details>}
  </article>;
}
