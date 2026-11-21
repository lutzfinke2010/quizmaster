import { motion, useReducedMotion } from "motion/react";
import { Crown, MoveHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import { formatPoints as defaultFormat } from "../format";
import { Flame } from "../Illustrations";
import { AnimatedPoints } from "./AnimatedPoints";
import { Avatar } from "./Avatar";
import "./game.css";

export type RankingPlayer = {
  participantId: string; avatarId: string; displayName: string; points: number; rank: number;
  streak?: number | null; badges?: string[] | null; rankChange?: number | null; previousRank?: number | null;
  previousPoints?: number | null; detail?: string;
};

/** "2 Plätze gutgemacht" / "1 Platz zurück" / "Platz gehalten" – only from the second question on. */
export function RankChange({ player, questionIndex }: { player: RankingPlayer; questionIndex: number }) {
  if (questionIndex < 1 || (player.previousRank ?? 0) < 1) return null;
  const change = player.rankChange ?? 0;
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : MoveHorizontal;
  return <span className={`rl-rank-change${change > 0 ? " is-up" : change < 0 ? " is-down" : ""}`}>
    <Icon aria-hidden="true" strokeWidth={2.6} />
    {change > 0 ? `${change} ${change === 1 ? "Platz" : "Plätze"} gutgemacht` :
      change < 0 ? `${-change} ${change === -1 ? "Platz" : "Plätze"} zurück` : "Platz gehalten"}</span>;
}

/** Top three in podium order 2 – 1 – 3. */
export function Podium({ players, final = true, formatPoints = defaultFormat, animateChanges = false }: {
  players: RankingPlayer[]; final?: boolean; formatPoints?: (points: number) => string; animateChanges?: boolean;
}) {
  const top = players.slice(0, 3);
  const reduced = useReducedMotion();
  const podium = top.length > 1 ? [top[1], top[0], ...top.slice(2)] : top;
  return <div className={`rl-podium${final ? " is-final" : ""}`} role="group" aria-label={final ? "Siegerpodest" : "Führende der Runde"}>
    {podium.map((player) => <motion.div layout={reduced ? false : "position"} initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : .45, delay: reduced ? 0 : player.rank === 1 ? .35 : player.rank === 2 ? .15 : 0 }}
      className={`rl-podium-player is-rank-${Math.min(player.rank, 3)}`} key={player.participantId}>
      {player.rank === 1 && <Crown className="rl-podium-crown" aria-hidden="true" strokeWidth={2.4} />}
      <Avatar avatarId={player.avatarId} />
      <strong className="rl-podium-name">{player.displayName}</strong>
      <span className="rl-podium-points"><AnimatedPoints value={player.points}
        from={animateChanges ? player.previousPoints ?? player.points : player.points} format={formatPoints} /> Punkte</span>
      {(player.streak ?? 0) >= 3 && <small className="rl-podium-streak"><Flame />{player.streak} in Folge</small>}
      {player.detail && <small className="rl-podium-detail">{player.detail}</small>}
      <div className="rl-podium-block"><span className="rl-visually-hidden">Platz </span>{player.rank}</div>
    </motion.div>)}
  </div>;
}

export function Leaderboard({ players, participantId, label = "Weitere Plätze", formatPoints = defaultFormat, animateChanges = false }: {
  players: RankingPlayer[]; participantId?: string; label?: string; formatPoints?: (points: number) => string; animateChanges?: boolean;
}) {
  const reduced = useReducedMotion();
  return <ol className="rl-leaderboard" aria-label={label}>
    {players.map((player, index) => {
      const gained = animateChanges && (player.rankChange ?? 0) > 0;
      return <motion.li layout={reduced ? false : "position"}
        initial={reduced ? false : { opacity: 0, x: -12,
          y: animateChanges && (player.previousRank ?? 0) > 0
            ? Math.max(-100, Math.min(100, ((player.previousRank ?? player.rank) - player.rank) * 50)) : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: reduced ? 0 : .35, delay: reduced ? 0 : Math.min(index, 5) * .06 }}
        key={player.participantId} className={player.participantId === participantId ? "is-you" : undefined}>
        <span className={`rl-leaderboard-rank${gained ? " is-gained" : ""}`}
          aria-label={`Platz ${player.rank}${gained ? `, ${player.rankChange} Plätze gutgemacht` : ""}`}>{player.rank}</span>
        <Avatar avatarId={player.avatarId} />
        <span className="rl-leaderboard-name">{player.displayName}{player.participantId === participantId && " (du)"}</span>
        <strong className="rl-leaderboard-points"><AnimatedPoints value={player.points}
          from={animateChanges ? player.previousPoints ?? player.points : player.points} format={formatPoints} /> <span>Punkte</span></strong>
      </motion.li>;
    })}
  </ol>;
}
