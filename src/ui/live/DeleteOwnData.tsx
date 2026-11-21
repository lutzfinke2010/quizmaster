import { useState } from "react";
import { cloud } from "../../cloud";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { message } from "../common/message";
import { ErrorNotice } from "../common/Notices";
import { runningStatuses } from "./phaseLabels";

export function DeleteOwnData({ sessionId, status, onDeleted }: { sessionId: string; status: string; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = runningStatuses.includes(status);
  async function remove() {
    setBusy(true); setError("");
    try { await cloud.deleteMyParticipation(sessionId); onDeleted(); }
    catch (caught) { setError(message(caught)); setBusy(false); }
  }
  return <section className="rl-live-delete" aria-labelledby="delete-own-data-heading">
    <h2 id="delete-own-data-heading" className="rl-h3">Meine Spieldaten</h2>
    <ErrorNotice error={error} />
    <ConfirmDialog title="Spieldaten löschen?" confirmLabel="Ja, endgültig löschen"
      description={running ? "Während einer laufenden Frage ist das Löschen nicht möglich. Bitte warte auf die Auflösung." :
        "Deine Teilnahme, Antworten und Punkte werden endgültig gelöscht. Du verlässt damit das Spiel und kannst nicht mehr weiterspielen."}
      confirmDisabled={busy || running} onConfirm={() => void remove()}
      trigger={<button type="button" className="rl-btn rl-btn-secondary rl-btn-small" disabled={busy || running}>
        {busy ? "Wird gelöscht …" : "Meine Spieldaten löschen"}</button>} />
    {running && <p className="rl-hint">Während einer laufenden Frage nicht möglich. Nach der Auflösung kannst du löschen.</p>}
  </section>;
}
