import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { badgeLabels, STREAK_RULE_TEXT } from "../domain/gamification";
import { AnswerCelebration } from "./AnswerCelebration";
import { BadgeIcon, GameIcon, GameIllustration } from "./GameAssets";

const seenEvents = new Set<string>();
export function claimGameEvent(key: string) {
  if (seenEvents.has(key)) return false;
  if (seenEvents.size >= 500) seenEvents.delete(seenEvents.values().next().value!);
  seenEvents.add(key);
  return true;
}

function useAwardEvent(eventId: string, eligible: boolean) {
  const [allowed, setAllowed] = useState(false);
  const current = useRef<string | null>(null);
  useEffect(() => {
    if (current.current !== eventId) {
      current.current = eventId;
      setAllowed(false);
    }
    if (eligible && claimGameEvent(eventId)) setAllowed(true);
  }, [eventId, eligible]);
  return allowed;
}

export function useFinaleTransition(final: boolean | undefined, enabled = true) {
  const previous = useRef(final);
  const previouslyEnabled = useRef(enabled);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (final === false && previous.current !== false) setCelebrate(false);
    if (final === true && previous.current === false && enabled && previouslyEnabled.current) setCelebrate(true);
    if (final !== undefined) previous.current = final;
    previouslyEnabled.current = enabled;
  }, [final, enabled]);
  return celebrate;
}

const badgeLabel = (badge: string) => Object.hasOwn(badgeLabels, badge) ? badgeLabels[badge] : badge;

export function AnimatedPoints({ value, from = value, format = (n) => n.toLocaleString("de-DE") }: {
  value: number; from?: number; format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const counter = useMotionValue(from);
  const text = useTransform(counter, (n) => format(Math.round(n)));
  const previous = useRef(from);
  useEffect(() => {
    counter.set(previous.current);
    previous.current = value;
    if (reduced) { counter.set(value); return; }
    const animation = animate(counter, value, { duration: .85, ease: "easeOut" });
    return () => animation.stop();
  }, [value, counter, reduced]);
  return <span className="animated-points" role="img" aria-label={format(value)}>
    {reduced ? <span aria-hidden="true">{format(value)}</span> : <motion.span aria-hidden="true">{text}</motion.span>}
  </span>;
}

export function StreakBonusOption({ enabled, onChange, disabled = false }: {
  enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean;
}) {
  return <div className="gamification-option">
    <label className="radio-option"><input type="checkbox" checked={enabled} disabled={disabled}
      onChange={(event) => onChange(event.target.checked)} />Streak-Bonuspunkte aktivieren</label>
    <p className="hint">{STREAK_RULE_TEXT} Serien und Abzeichen gibt es auch ohne Bonuspunkte.</p>
  </div>;
}

export function Encouragement() {
  return <p className="encouragement">Auch danebenraten gehört dazu. Jetzt weißt du mehr!</p>;
}

export function Achievements({ streak = 0, maxStreak = 0, badges = [] }: {
  streak?: number | null; maxStreak?: number | null; badges?: string[] | null;
}) {
  const current = streak ?? 0;
  const target = current < 3 ? 3 : current < 5 ? 5 : current + 1;
  return <div className={`achievements${current >= 3 ? " is-on-fire" : ""}`}>
    <div className="streak-heading"><GameIcon name={current >= 3 ? "streak-active" : "streak-idle"} size={22} />
      <strong>{current > 0 ? `${current} richtig in Folge` : "Die nächste Serie wartet!"}</strong>
      {(maxStreak ?? 0) > 0 && <span className={current === maxStreak ? "at-best" : undefined}>
        {current === maxStreak && <GameIcon name="trophy" size={16} />} Beste Serie: {maxStreak}</span>}
    </div>
    <progress value={Math.min(current, target)} max={target} aria-label={`${current} richtige Antworten in Folge; nächstes Ziel ${target}`} />
    <p className="streak-next">{current < 5 ? `Noch ${target - current} bis zum nächsten Serien-Meilenstein` : "Stark! Halte deine Serie am Laufen."}</p>
    {(badges ?? []).length > 0 && <ul className="achievement-badges" aria-label="Deine Abzeichen">
      {(badges ?? []).map((badge) => <li key={badge}><BadgeIcon badge={badge} size={16} />{badgeLabel(badge)}</li>)}
    </ul>}
  </div>;
}

export function ScoreAward({ points, extra = 0, streak = 0, badges = [], celebrate = false, eventId }: {
  points: number; extra?: number | null; streak?: number | null; badges?: string[] | null;
  celebrate?: boolean; eventId: string;
}) {
  const allowed = useAwardEvent(eventId, celebrate && points > 0);
  const reduced = useReducedMotion();
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const badgeSignature = (badges ?? []).join(",");
  const scope = eventId.split(":points:")[0];
  const lastBadges = useRef<string | null>(null);
  useEffect(() => {
    const key = `${scope}:${badgeSignature}`;
    if (lastBadges.current === key) return;
    lastBadges.current = key;
    const earned = badgeSignature ? badgeSignature.split(",") : [];
    const fresh = earned.filter((badge) => claimGameEvent(`${scope}:badge:${badge}`));
    setNewBadges(celebrate ? fresh : []);
  }, [badgeSignature, scope, celebrate]);
  const milestone = newBadges.includes("STREAK_5") ? "Unaufhaltsam!" :
    newBadges.includes("STREAK_3") ? "Dreier-Serie!" : (streak ?? 0) >= 3 ? `${streak} richtig in Folge!` : null;
  return <div className="score-award">
    {allowed && <div className="award-sequence" role="status" aria-live="polite">
      {!reduced && <AnswerCelebration />}
      <div className="points-pop" aria-hidden="true">+{points.toLocaleString("de-DE")}</div>
      <span className="sr-only">{points.toLocaleString("de-DE")} Punkte gewonnen.</span>
      {milestone && <div className="milestone-pop"><GameIcon name="streak-milestone" size={20} />{milestone}</div>}
      {newBadges.slice(-1).map((badge) =>
        <div className="badge-pop" key={badge}><BadgeIcon badge={badge} size={18} />{badgeLabel(badge)}</div>)}
    </div>}
    <div className="points">{points > 0 && <GameIcon name="points" size={24} />}+{" "}
      <AnimatedPoints key={String(allowed)} value={points} from={allowed && !reduced ? 0 : points} /></div>
    <p>Punkte für diese Frage</p>
    {(extra ?? 0) > 0 && <p className="streak-bonus"><GameIcon name="streak-active" size={16} />
      Davon +{extra} Streak-Bonuspunkte</p>}
  </div>;
}

export function RankRise({ change, eventId, celebrate }: { change: number; eventId: string; celebrate: boolean }) {
  const allowed = useAwardEvent(eventId, celebrate && change > 0);
  return change > 0 ? <div className={`rank-rise${allowed ? " rank-rise-animated" : ""}`} role="status">
    <GameIcon name="rank-up" size={22} /><strong>{change} {change === 1 ? "Platz" : "Plätze"} gutgemacht!</strong>
  </div> : null;
}

export function Finale({ winner = false, shared = false, celebrate = false, eventId }: {
  winner?: boolean; shared?: boolean; celebrate?: boolean; eventId: string;
}) {
  const reduced = useReducedMotion();
  const allowed = useAwardEvent(eventId, celebrate);
  return <div className={`finale-banner${allowed ? " finale-celebrating" : ""}`}>
    {!reduced && allowed && <AnswerCelebration final />}
    <GameIllustration name={winner ? "finale-winner" : "finale-participant"} className="finale-illustration" />
    <GameIcon name="trophy" size={32} />
    <strong>{winner ? "Ganz oben! Das ist dein Moment." :
      shared ? "Geschafft. Zeit, gemeinsam zu feiern!" : "Geschafft. Zeit, dich zu feiern!"}</strong>
  </div>;
}
