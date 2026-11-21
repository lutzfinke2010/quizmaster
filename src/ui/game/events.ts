import { useEffect, useRef, useState } from "react";

const seenEvents = new Set<string>();

/** Each reward event (points, badge, rank, finale) is celebrated only once per page load. */
export function claimGameEvent(key: string) {
  if (seenEvents.has(key)) return false;
  if (seenEvents.size >= 500) seenEvents.delete(seenEvents.values().next().value!);
  seenEvents.add(key);
  return true;
}

export function useAwardEvent(eventId: string, eligible: boolean) {
  const [allowed, setAllowed] = useState(false);
  const currentRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentRef.current !== eventId) {
      currentRef.current = eventId;
      setAllowed(false);
    }
    if (eligible && claimGameEvent(eventId)) setAllowed(true);
  }, [eventId, eligible]);
  return allowed;
}

/** True once a game switches from "not final" to "final" while the page is open (not when opened afterwards). */
export function useFinaleTransition(final: boolean | undefined, enabled = true) {
  const previousRef = useRef(final);
  const previouslyEnabledRef = useRef(enabled);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (final === false && previousRef.current !== false) setCelebrate(false);
    if (final === true && previousRef.current === false && enabled && previouslyEnabledRef.current) setCelebrate(true);
    if (final !== undefined) previousRef.current = final;
    previouslyEnabledRef.current = enabled;
  }, [final, enabled]);
  return celebrate;
}
