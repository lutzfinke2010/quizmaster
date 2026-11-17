import type { GameEvent, GameState } from "../cloud";

export type LiveEventAction =
  | { kind: "reload" }
  | { kind: "patch"; state: GameState; reloadParticipants: boolean }
  | { kind: "ignore" };

/**
 * Entscheidet, wie ein Live-Event verarbeitet wird. `version` ändert sich nur bei Phasenwechseln und erfordert
 * einen Reload. Reine Zählerstände (Antworten, Beitritte/Löschungen) werden lokal übernommen; ändert sich die
 * Teilnehmendenzahl, muss die Spielerliste gedrosselt nachgeladen werden.
 */
export function classifyLiveEvent(current: GameState | null, event: GameEvent): LiveEventAction {
  if (!current || event.version > current.version) return { kind: "reload" };
  if (event.version < current.version) return { kind: "ignore" };
  const participantCount = event.participantCount ?? current.participantCount;
  const answerCount = event.answerCount ?? current.answerCount;
  if (participantCount === current.participantCount && answerCount === current.answerCount) return { kind: "ignore" };
  return {
    kind: "patch",
    state: { ...current, participantCount, answerCount },
    reloadParticipants: participantCount !== current.participantCount,
  };
}
