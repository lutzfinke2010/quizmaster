export interface AnswerScore {
  points: number;
  elapsedMs: number;
}

export function scoreAnswer(
  correct: boolean,
  receivedAt: number,
  opensAt: number,
  durationMs: number,
): AnswerScore {
  if (!Number.isFinite(receivedAt) || !Number.isFinite(opensAt) ||
      !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Ungültige Zeitangaben.");
  }
  const elapsedMs = Math.max(0, Math.min(receivedAt - opensAt, durationMs));
  return {
    elapsedMs,
    points: correct ? 500 + Math.round(500 * (1 - elapsedMs / durationMs)) : 0,
  };
}

/** Async-Wertung „Quiz per Link“: Grundpunkte plus linear fallender Tempo-Bonus (kein hartes Zeitlimit). */
export const ASYNC_SPEED_V1 = Object.freeze({
  version: "ASYNC_SPEED_V1",
  basePoints: 1000,
  maxBonusPoints: 500,
  bonusWindowMs: 30_000,
} as const);
/** Historische Async-Runden ohne gespeicherte Wertungsversion: ein Punkt je richtiger Antwort. */
export const ASYNC_LEGACY_SCORING = Object.freeze({
  version: "LEGACY_CORRECT",
  basePoints: 1,
  maxBonusPoints: 0,
  bonusWindowMs: 0,
} as const);

export interface AsyncScoringRule {
  version: string;
  basePoints: number;
  maxBonusPoints: number;
  bonusWindowMs: number;
}

export interface AsyncAnswerScore {
  elapsedMs: number;
  basePoints: number;
  bonusPoints: number;
  points: number;
}

/** Rein informative Restbonus-Berechnung; maßgeblich ist ausschließlich die serverseitige Wertung. */
export function asyncSpeedBonus(elapsedMs: number, rule: AsyncScoringRule = ASYNC_SPEED_V1): number {
  if (!Number.isFinite(elapsedMs) || rule.bonusWindowMs <= 0) return 0;
  return Math.round(rule.maxBonusPoints * Math.max(0, 1 - Math.max(0, elapsedMs) / rule.bonusWindowMs));
}

export function scoreAsyncSpeedAnswer(
  correct: boolean, questionStartedAt: number, answerAcceptedAt: number, rule: AsyncScoringRule = ASYNC_SPEED_V1,
): AsyncAnswerScore {
  if (!Number.isSafeInteger(questionStartedAt) || !Number.isSafeInteger(answerAcceptedAt)) {
    throw new Error("Ungültige Zeitangaben.");
  }
  const elapsedMs = Math.max(0, answerAcceptedAt - questionStartedAt);
  if (!correct) return { elapsedMs, basePoints: 0, bonusPoints: 0, points: 0 };
  const bonusPoints = asyncSpeedBonus(elapsedMs, rule);
  return { elapsedMs, basePoints: rule.basePoints, bonusPoints, points: rule.basePoints + bonusPoints };
}

export interface Score {
  participantId: string;
  points: number;
  correctAnswers: number;
  correctElapsedMs: number;
}

export interface RankedScore extends Score {
  rank: number;
}

export function rankScores(scores: readonly Score[]): RankedScore[] {
  const sorted = [...scores].sort((a, b) =>
    b.points - a.points ||
    b.correctAnswers - a.correctAnswers ||
    a.correctElapsedMs - b.correctElapsedMs ||
    (a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0),
  );
  return sorted.map((score, index) => {
    const previous = sorted[index - 1];
    const tied = previous && score.points === previous.points &&
      score.correctAnswers === previous.correctAnswers &&
      score.correctElapsedMs === previous.correctElapsedMs;
    if (!tied) return { ...score, rank: index + 1 };
    let first = index - 1;
    while (first > 0) {
      const earlier = sorted[first - 1];
      if (earlier.points !== score.points || earlier.correctAnswers !== score.correctAnswers ||
          earlier.correctElapsedMs !== score.correctElapsedMs) break;
      first--;
    }
    return { ...score, rank: first + 1 };
  });
}
