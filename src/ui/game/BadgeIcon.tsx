import { Award, Sparkles, Trophy } from "lucide-react";
import { badgeLabels } from "../../domain/gamification";
import { Flame, Star } from "../Illustrations";

export const badgeLabel = (badge: string) => Object.hasOwn(badgeLabels, badge) ? badgeLabels[badge] : badge;

export function BadgeIcon({ badge, className = "rl-badge-icon" }: { badge: string; className?: string }) {
  switch (badge) {
    case "FIRST_CORRECT": return <Star className={className} />;
    case "STREAK_3": return <Flame className={className} />;
    case "STREAK_5": return <span className={`${className} rl-badge-double`} aria-hidden="true"><Flame /><Sparkles /></span>;
    case "PERFECT": return <Trophy className={className} aria-hidden="true" strokeWidth={2.4} />;
    default: return <Award className={className} aria-hidden="true" strokeWidth={2.4} />;
  }
}
