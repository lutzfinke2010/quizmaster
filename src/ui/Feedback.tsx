import type { CSSProperties } from "react";
import { Lightbulb } from "lucide-react";
import { Star } from "./Illustrations";
import { formatPoints } from "./format";
import "./celebration.css";

const CONFETTI = [
  [-150, -120, "#ff5b6e", 0], [-110, -170, "#ffc21a", 40], [-60, -200, "#21b07c", 80], [0, -220, "#3aa0ff", 20],
  [60, -200, "#ff8a2a", 60], [110, -170, "#b26bf0", 0], [150, -120, "#21b07c", 90], [-170, -50, "#3aa0ff", 50],
  [170, -50, "#ff5b6e", 30], [-90, -110, "#ff8a2a", 120], [90, -110, "#ffc21a", 100], [-30, -150, "#b26bf0", 140],
  [30, -150, "#ff5b6e", 70], [-130, -10, "#ffc21a", 110], [130, -10, "#21b07c", 150],
] as const;

const STARS = [[-120, 0, 0], [-60, 20, 120], [0, -10, 60], [60, 20, 180], [120, 0, 90]] as const;

/** Reward animation layer – independent of the quiz flow, just render it when an answer was correct. */
export function Celebration() {
  return <div className="rl-celebration" aria-hidden="true">
    {CONFETTI.map(([x, y, color, delay], index) => <span key={index} className="rl-confetto"
      style={{ "--x": `${x}px`, "--y": `${y}px`, "--delay": `${delay}ms`, background: color } as CSSProperties} />)}
    {STARS.map(([x, y, delay], index) => <Star key={index} className="rl-flying-star"
      style={{ "--x": `${x}px`, "--y": `${y}px`, "--delay": `${delay}ms` } as CSSProperties} />)}
  </div>;
}

export function ExplanationCard({ correctText, explanation, timedOut }: {
  correctText: string; explanation?: string; timedOut: boolean;
}) {
  return <div className="rl-explanation">
    <Lightbulb className="rl-explanation-icon" aria-hidden="true" />
    <div>
      {timedOut && <p className="rl-explanation-hint">Die Zeit ist abgelaufen.</p>}
      <p className="rl-explanation-title">Richtig ist: {correctText}</p>
      {explanation && <p className="rl-explanation-text">{explanation}</p>}
    </div>
  </div>;
}

export function ScorePill({ score }: { score: number }) {
  return <span className="rl-score" role="status" aria-label={`${formatPoints(score)} Punkte`}>
    <Star className="rl-score-star" />
    <span key={score} className="rl-score-value" aria-hidden="true">{formatPoints(score)}</span>
  </span>;
}
