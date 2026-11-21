import type { GameState, MyResult, Participation } from "../../cloud";
import { formatPoints } from "../format";

/** Player-facing names of the live phases (also used on the shared screen and for the quizmaster). */
export const phaseLabels: Record<string, string> = {
  LOBBY: "Warten auf die Runde", COUNTDOWN: "Gleich geht’s los", QUESTION_OPEN: "Du bist gefragt",
  QUESTION_CLOSED: "Antworten geschlossen", SCORING: "Wird ausgewertet", REVEAL: "Die Auflösung",
  LEADERBOARD: "Der Zwischenstand", FINISHED: "Geschafft!", CANCELLED: "Runde abgebrochen",
};

export const phaseLabel = (status: string) => phaseLabels[status] ?? status;

/** A question is running – deleting own data is blocked, the server moves on by itself. */
export const runningStatuses = ["COUNTDOWN", "QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"];
/** Phases with a personal result of the current question. */
export const resultStatuses = ["REVEAL", "LEADERBOARD", "FINISHED"];
/** Phases that show the question itself. */
export const activeStatuses = ["QUESTION_OPEN", "QUESTION_CLOSED", "SCORING"];

export type RankedPlayer = GameState["leaderboard"][number];
/** Last known own leaderboard entry – shown while the current question has no ranking yet. */
export type PersonalStanding = { questionIndex: number; player: RankedPlayer };

export const letter = (index: number) => String.fromCharCode(65 + index);

/** Points and place for the header and the identity line of a participant. */
export function standingInfo(state: GameState, participant?: Participation | null, result?: MyResult | null,
  standing?: PersonalStanding | null) {
  const currentPlayer = state.leaderboard.find((player) => player.participantId === participant?.participantId);
  const score = currentPlayer?.points ?? result?.totalPoints ?? standing?.player.points;
  const rank = currentPlayer?.rank ?? standing?.player.rank;
  const scoreLabel = score != null ? `${formatPoints(score)} Punkte` :
    state.questionIndex < 1 ? "Noch keine Wertung" : "Wertung nach der Auflösung";
  const standingLabel = scoreLabel + (rank != null ? ` · ${currentPlayer ? "Platz" : "Zuletzt Platz"} ${rank}` : "");
  return { score, rank, standingLabel };
}
