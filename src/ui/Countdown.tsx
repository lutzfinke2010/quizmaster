import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** Remount (via `key`) for every question to restart the countdown. */
export function Countdown({ seconds, running, onExpire }: { seconds: number; running: boolean; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const remainingRef = useRef(seconds);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    if (!running || remainingRef.current <= 0) return;
    const deadline = Date.now() + remainingRef.current * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      remainingRef.current = left;
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(timer);
        onExpireRef.current();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [running]);

  const percent = seconds > 0 ? (remaining / seconds) * 100 : 0;
  const urgent = remaining <= 5;
  return <div className={`rl-countdown${urgent ? " is-urgent" : ""}`}>
    <Timer className="rl-countdown-icon" aria-hidden="true" strokeWidth={2.6} />
    <span className="rl-countdown-time" role="timer" aria-label={`Noch ${Math.ceil(remaining)} Sekunden`}>
      {formatCountdown(remaining)}
    </span>
    <span className="rl-countdown-track" aria-hidden="true">
      <span className="rl-countdown-fill" style={{ width: `${percent}%` }} />
    </span>
  </div>;
}
