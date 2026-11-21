import { useEffect, useState } from "react";

/**
 * True while a question is open and its server deadline lies in the future (`offset` = server − client).
 * Only informative for locking the cards – the backend decides whether an answer was in time.
 */
export function useTimeRemaining(open: boolean, closesAt: number | null | undefined, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    if (!open || closesAt == null) return () => window.clearTimeout(first);
    const timer = window.setInterval(() => {
      tick();
      if (Date.now() + offset >= closesAt) window.clearInterval(timer);
    }, 250);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [open, closesAt, offset]);
  return open && closesAt != null && now + offset < closesAt;
}
