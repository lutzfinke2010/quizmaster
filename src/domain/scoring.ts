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
