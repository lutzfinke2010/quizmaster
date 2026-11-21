import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { STREAK_RULE_TEXT } from "../../domain/gamification";
import { Celebration } from "../Feedback";
import { formatPoints } from "../format";
import { Flame, Star, Trophy } from "../Illustrations";
import { LlamaCharacter } from "../LlamaCharacter";
import { AnimatedPoints } from "./AnimatedPoints";
import { BadgeIcon, badgeLabel } from "./BadgeIcon";
import { claimGameEvent, useAwardEvent } from "./events";
import "../celebration.css";
import "../llama.css";
import "./game.css";

/** Option in the publish/session form – the bonus is computed by the backend. */
export function StreakBonusOption({ enabled, onChange, disabled = false }: {
  enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean;
}) {
  return <div className="rl-streak-option">
    <label className="rl-checkbox"><input type="checkbox" checked={enabled} disabled={disabled}
      onChange={(event) => onChange(event.target.checked)} />Streak-Bonuspunkte aktivieren</label>
    <p className="rl-hint">{STREAK_RULE_TEXT} Serien und Abzeichen gibt es auch ohne Bonuspunkte.</p>
  </div>;
}

export function Encouragement() {
  return <p className="rl-encouragement">Auch danebenraten gehört dazu. Jetzt weißt du mehr!</p>;
}

export function Achievements({ streak = 0, maxStreak = 0, badges = [] }: {
  streak?: number | null; maxStreak?: number | null; badges?: string[] | null;
}) {
  const current = streak ?? 0;
  const target = current < 3 ? 3 : current < 5 ? 5 : current + 1;
  return <div className={`rl-achievements${current >= 3 ? " is-on-fire" : ""}`}>
    <div className="rl-achievements-heading"><Flame className="rl-achievements-flame" />
      <strong>{current > 0 ? `${current} richtig in Folge` : "Die nächste Serie wartet!"}</strong>
      {(maxStreak ?? 0) > 0 && <span className={`rl-pill${current === maxStreak ? " rl-pill-orange" : ""}`}>
        {current === maxStreak && <Trophy className="rl-achievements-trophy" />} Beste Serie: {maxStreak}</span>}
    </div>
    <progress className="rl-meter" value={Math.min(current, target)} max={target}
      aria-label={`${current} richtige Antworten in Folge; nächstes Ziel ${target}`} />
    <p className="rl-hint">{current < 5 ? `Noch ${target - current} bis zum nächsten Serien-Meilenstein` : "Stark! Halte deine Serie am Laufen."}</p>
    {(badges ?? []).length > 0 && <ul className="rl-badges" aria-label="Deine Abzeichen">
      {(badges ?? []).map((badge) => <li key={badge}><BadgeIcon badge={badge} />{badgeLabel(badge)}</li>)}
    </ul>}
  </div>;
}

/**
 * Points for one question. Confetti, points jump, streak milestone and fresh badges play only once per
 * `eventId` (see `claimGameEvent`), so reloads or re-renders don't celebrate twice.
 */
export function ScoreAward({ points, extra = 0, streak = 0, badges = [], celebrate = false, eventId }: {
  points: number; extra?: number | null; streak?: number | null; badges?: string[] | null;
  celebrate?: boolean; eventId: string;
}) {
  const allowed = useAwardEvent(eventId, celebrate && points > 0);
  const reduced = useReducedMotion();
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const badgeSignature = (badges ?? []).join(",");
  const scope = eventId.split(":points:")[0];
  const lastBadgesRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${scope}:${badgeSignature}`;
    if (lastBadgesRef.current === key) return;
    lastBadgesRef.current = key;
    const earned = badgeSignature ? badgeSignature.split(",") : [];
    const fresh = earned.filter((badge) => claimGameEvent(`${scope}:badge:${badge}`));
    setNewBadges(celebrate ? fresh : []);
  }, [badgeSignature, scope, celebrate]);
  const milestone = newBadges.includes("STREAK_5") ? "Unaufhaltsam!" :
    newBadges.includes("STREAK_3") ? "Dreier-Serie!" : (streak ?? 0) >= 3 ? `${streak} richtig in Folge!` : null;
  return <div className="rl-score-award">
    {allowed && <div className="rl-award-sequence" role="status" aria-live="polite">
      {!reduced && <Celebration />}
      <div className="rl-points-pop" aria-hidden="true"><Star className="rl-points-pop-star" />Richtig!</div>
      <span className="rl-visually-hidden">{formatPoints(points)} Punkte gewonnen.</span>
      {milestone && <div className="rl-milestone-pop"><Flame className="rl-milestone-flame" />{milestone}</div>}
      {newBadges.slice(-1).map((badge) =>
        <div className="rl-badge-pop" key={badge}><BadgeIcon badge={badge} />{badgeLabel(badge)}</div>)}
    </div>}
    <div className="rl-score-award-points">{points > 0 && <Star className="rl-score-award-star" />}+{" "}
      <AnimatedPoints key={String(allowed)} value={points} from={allowed && !reduced ? 0 : points} /></div>
    <p className="rl-score-award-label">Punkte für diese Frage</p>
    {(extra ?? 0) > 0 && <p className="rl-streak-bonus"><Flame className="rl-streak-bonus-flame" />
      Davon +{extra} Streak-Bonuspunkte</p>}
  </div>;
}

export function RankRise({ change, eventId, celebrate }: { change: number; eventId: string; celebrate: boolean }) {
  const allowed = useAwardEvent(eventId, celebrate && change > 0);
  return change > 0 ? <div className={`rl-rank-rise${allowed ? " is-animated" : ""}`} role="status">
    <TrendingUp aria-hidden="true" strokeWidth={2.8} /><strong>{change} {change === 1 ? "Platz" : "Plätze"} gutgemacht!</strong>
  </div> : null;
}

export function Finale({ winner = false, shared = false, celebrate = false, eventId }: {
  winner?: boolean; shared?: boolean; celebrate?: boolean; eventId: string;
}) {
  const reduced = useReducedMotion();
  const allowed = useAwardEvent(eventId, celebrate);
  return <div className={`rl-finale${allowed ? " is-celebrating" : ""}`}>
    {!reduced && allowed && <Celebration />}
    <LlamaCharacter mood={winner ? "cheering" : "proud"} className="rl-finale-llama" />
    <Trophy className="rl-finale-trophy" />
    <strong className="rl-finale-text">{winner ? "Ganz oben! Das ist dein Moment." :
      shared ? "Geschafft. Zeit, gemeinsam zu feiern!" : "Geschafft. Zeit, dich zu feiern!"}</strong>
  </div>;
}
