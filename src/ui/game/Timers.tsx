import { useEffect, useState } from "react";
import { Timer, Zap } from "lucide-react";
import { asyncSpeedBonus, type AsyncScoringRule } from "../../domain/scoring";
import { formatCountdown } from "../Countdown";
import { formatPoints } from "../format";
import "../quizPlay.css";
import "./game.css";

/** Ticks while the deadline lies in the future. `offset` = server time − client time in ms. */
function useNow(deadline: number, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  const running = deadline - now - offset > 0;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

/**
 * Countdown towards a server deadline (epoch ms). Informative only – the backend decides if an answer was in time.
 * `totalMs` enables the progress track; `size="stage"` is the large variant for the shared screen.
 */
export function DeadlineTimer({ deadline, offset = 0, totalMs, size = "pill" }: {
  deadline: number; offset?: number; totalMs?: number; size?: "pill" | "stage";
}) {
  const now = useNow(deadline, offset);
  const remainingMs = Math.max(0, deadline - now - offset);
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds > 0 && seconds <= 5;
  if (size === "stage") {
    return <span className={`rl-stage-timer${urgent ? " is-urgent" : ""}`} role="timer" aria-live="off" aria-label={`Noch ${seconds} Sekunden`}>
      <span key={seconds} className="rl-stage-timer-digit">{seconds}</span><small>Sekunden</small></span>;
  }
  const percent = totalMs ? Math.max(0, Math.min(100, remainingMs / totalMs * 100)) : null;
  return <div className={`rl-countdown${urgent ? " is-urgent" : ""}${percent === null ? " is-compact" : ""}`}>
    <Timer className="rl-countdown-icon" aria-hidden="true" strokeWidth={2.6} />
    <span className="rl-countdown-time" role="timer" aria-live="off" aria-label={`Noch ${seconds} Sekunden`}>{formatCountdown(seconds)}</span>
    {percent !== null && <span className="rl-countdown-track" aria-hidden="true">
      <span className="rl-countdown-fill" style={{ width: `${percent}%` }} /></span>}
  </div>;
}

/**
 * Purely informative speed bonus display; only the server-side timestamps count.
 * Not announced continuously (aria-live=off); the backend computes the bonus.
 */
export function SpeedBonus({ startedAt, offset, rule }: { startedAt: number; offset: number; rule: AsyncScoringRule }) {
  const [now, setNow] = useState(() => Date.now());
  const elapsed = Math.max(0, now + offset - startedAt);
  const active = elapsed < rule.bonusWindowMs;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);
  if (!active) {
    return <span className="rl-speed-bonus is-over" aria-live="off">
      Kein Tempo-Bonus mehr · richtige Antwort weiterhin {formatPoints(rule.basePoints)} Punkte
    </span>;
  }
  const bonus = asyncSpeedBonus(elapsed, rule);
  const seconds = Math.ceil((rule.bonusWindowMs - elapsed) / 1000);
  return <span className="rl-speed-bonus" aria-live="off" title={`Tempo-Bonus noch ${seconds} Sekunden`}>
    <Zap aria-hidden="true" strokeWidth={2.6} />
    <span>Tempo-Bonus <strong>+{formatPoints(bonus)}</strong></span>
    <span className="rl-speed-bonus-track" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, bonus / Math.max(1, rule.maxBonusPoints) * 100))}%` }} />
    </span>
    <span className="rl-visually-hidden">, noch {seconds} Sekunden</span>
  </span>;
}

/** "Frage 2 von 8" with the playful progress bar from the mockup. */
export function QuestionPosition({ index, total }: { index: number; total: number }) {
  const percent = total > 0 ? Math.min(100, (index + 1) / total * 100) : 0;
  return <div className="rl-question-position">
    <span className="rl-question-position-label">Frage {index + 1} von {total}</span>
    <span className="rl-question-position-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
  </div>;
}
