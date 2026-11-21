/** Labels for live session phases (same wording as on the player screens). */
export const phaseLabels: Record<string, string> = {
  LOBBY: "Warten auf die Runde", COUNTDOWN: "Gleich geht’s los", QUESTION_OPEN: "Du bist gefragt",
  QUESTION_CLOSED: "Antworten geschlossen", SCORING: "Wird ausgewertet", REVEAL: "Die Auflösung",
  LEADERBOARD: "Der Zwischenstand", FINISHED: "Geschafft!", CANCELLED: "Runde abgebrochen",
};

export const asyncStatusText = (status: string) =>
  status === "ACTIVE" ? "Aktiv" : status === "ENDED" ? "Vorzeitig beendet" : "Abgelaufen";

/** Status of a quiz round right now: a passed deadline counts as ended immediately. */
export function liveAsyncStatus(status: string, expiresAt: number, now: number): string {
  return status === "ACTIVE" && now >= expiresAt ? "EXPIRED" : status;
}

export const ENDED_SESSION_STATUSES = new Set(["FINISHED", "CANCELLED"]);
export const archivedSessionLabel = (status: string) => status === "CANCELLED" ? "Abgebrochen" : "Beendet";

export const questionCountLabel = (count: number) => `${count} ${count === 1 ? "Frage" : "Fragen"}`;
