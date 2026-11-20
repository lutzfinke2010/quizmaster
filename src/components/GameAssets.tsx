import { useState } from "react";
import {
  ArrowLeftRight, Award, Check, CheckCircle2, CircleX, Clock3, Flame, Sparkles, TrendingDown, TrendingUp, Trophy, Zap,
  type LucideIcon,
} from "lucide-react";

const iconFallbacks = {
  "points": Sparkles,
  "speed": Zap,
  "streak-idle": Flame,
  "streak-active": Flame,
  "streak-milestone": Flame,
  "rank-up": TrendingUp,
  "rank-down": TrendingDown,
  "rank-steady": ArrowLeftRight,
  "trophy": Trophy,
  "crown": Trophy,
  "answer-correct": CheckCircle2,
  "answer-incorrect": CircleX,
  "answer-saved": Check,
  "timer": Clock3,
  "ready": Sparkles,
  "badge-generic": Award,
} satisfies Record<string, LucideIcon>;

const badgeFiles = {
  FIRST_CORRECT: "first-correct",
  STREAK_3: "streak-3",
  STREAK_5: "streak-5",
  PERFECT: "perfect",
} as const;

const illustrationFiles = {
  "lobby-welcome": "lobby-welcome",
  "countdown-ready": "countdown-ready",
  "answer-celebrate": "answer-celebrate",
  "answer-encourage": "answer-encourage",
  "finale-participant": "finale-participant",
  "finale-winner": "finale-winner",
} as const;

export type GameIconName = keyof typeof iconFallbacks;
export type GameIllustrationName = keyof typeof illustrationFiles;

function IconImage({ src, pngSrc, size, fallback: Fallback, className }: {
  src: string; pngSrc: string; size: number; fallback: LucideIcon; className?: string;
}) {
  const [failure, setFailure] = useState<{ src: string; stage: "svg" | "png" } | null>(null);
  const stage = failure?.src === src ? failure.stage : null;
  const classes = ["game-icon", className].filter(Boolean).join(" ");
  if (stage === "png") return <Fallback size={size} className={classes} aria-hidden="true" />;
  const currentSrc = stage === "svg" ? pngSrc : src;
  return <img className={classes} src={currentSrc} width={size} height={size} alt="" aria-hidden="true" decoding="async"
    onError={() => {
      console.warn(`Gamification-Grafik konnte nicht geladen werden: ${currentSrc}`);
      setFailure({ src, stage: stage === "svg" ? "png" : "svg" });
    }} />;
}

export function GameIcon({ name, size, className }: { name: GameIconName; size: number; className?: string }) {
  return <IconImage src={`${import.meta.env.BASE_URL}assets/gamification/icons/${name}.svg`}
    pngSrc={`${import.meta.env.BASE_URL}assets/gamification/icons/png/128/${name}.png`}
    size={size} className={className} fallback={iconFallbacks[name]} />;
}

function isKnownBadge(badge: string): badge is keyof typeof badgeFiles {
  return Object.hasOwn(badgeFiles, badge);
}

export function BadgeIcon({ badge, size }: { badge: string; size: number }) {
  if (!isKnownBadge(badge)) return <GameIcon name="badge-generic" size={size} />;
  return <IconImage src={`${import.meta.env.BASE_URL}assets/gamification/badges/${badgeFiles[badge]}.svg`}
    pngSrc={`${import.meta.env.BASE_URL}assets/gamification/badges/png/256/${badgeFiles[badge]}.png`}
    size={size} fallback={Award} />;
}

export function GameIllustration({ name, className, onUnavailable }: {
  name: GameIllustrationName; className?: string; onUnavailable?: () => void;
}) {
  const [failure, setFailure] = useState<{ name: GameIllustrationName; stage: "high" | "all" } | null>(null);
  const stage = failure?.name === name ? failure.stage : null;
  if (stage === "all") return null;
  const file = illustrationFiles[name];
  const base = `${import.meta.env.BASE_URL}assets/gamification/illustrations`;
  const src = `${base}/512/${file}.png`;
  const high = `${base}/1024/${file}.png`;
  return <img className={["game-illustration", className].filter(Boolean).join(" ")}
    src={src} srcSet={stage === "high" ? undefined : `${high} 2x`} width={128} height={128}
    alt="" aria-hidden="true" decoding="async" onError={(event) => {
      const current = event.currentTarget.currentSrc || src;
      console.warn(`Gamification-Grafik konnte nicht geladen werden: ${current}`);
      if (stage !== "high" && current === new URL(high, window.location.href).href) {
        setFailure({ name, stage: "high" });
      } else {
        setFailure({ name, stage: "all" });
        onUnavailable?.();
      }
    }} />;
}

export function MomentVisual({ icon, illustration, subdued = false }: {
  icon: GameIconName; illustration?: GameIllustrationName; subdued?: boolean;
}) {
  const [failedIllustration, setFailedIllustration] = useState<GameIllustrationName | null>(null);
  const showIllustration = illustration && failedIllustration !== illustration;
  const sticker = <div className={`result-sticker${subdued ? " result-sticker-peach" : ""}`}>
    <GameIcon name={icon} size={showIllustration ? 24 : 34} />
  </div>;
  if (!showIllustration) return <div aria-hidden="true">{sticker}</div>;
  return <div className="moment-visual" aria-hidden="true">
    <GameIllustration name={illustration} className="moment-illustration"
      onUnavailable={() => setFailedIllustration(illustration)} />
    {sticker}
  </div>;
}
