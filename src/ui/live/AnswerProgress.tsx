import type { GameState } from "../../cloud";
import { formatPoints } from "../format";

export function AnswerProgress({ state }: { state: GameState }) {
  const { answerCount, eligibleParticipantCount } = state;
  const percent = Math.min(100, answerCount / Math.max(1, eligibleParticipantCount) * 100);
  return <div className="rl-live-progress">
    <p><strong>{formatPoints(answerCount)} von {formatPoints(eligibleParticipantCount)}</strong> haben geantwortet</p>
    <progress className="rl-visually-hidden" value={Math.min(answerCount, eligibleParticipantCount)}
      max={Math.max(1, eligibleParticipantCount)} aria-label={`${answerCount} von ${eligibleParticipantCount} haben geantwortet`} />
    <span className="rl-live-progress-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
  </div>;
}
