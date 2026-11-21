import type { GameState } from "../../cloud";
import { STREAK_RULE_TEXT } from "../../domain/gamification";
import { AnimatedPoints } from "../game/AnimatedPoints";
import { Avatar } from "../game/Avatar";
import { RateLamaMascot } from "../RateLamaMascot";
import { JoinDetails } from "./JoinDetails";

/** Waiting room: personal (phone), shared screen with QR code, or the quizmaster preview without join details. */
export function LiveLobby({ state, personal, joinCode, showJoinDetails = true }: {
  state: GameState; personal: boolean; joinCode?: string; showJoinDetails?: boolean;
}) {
  const code = joinCode || state.joinCode;
  const limit = personal ? 6 : 12;
  return <section className={`rl-live-lobby${personal ? " is-personal" : ""}`} aria-labelledby="lobby-title">
    <div className="rl-live-lobby-intro">
      <RateLamaMascot state="intro" size={190} decorative className="rl-live-llama" />
      <div>
        <span className="rl-eyebrow">ZUSAMMEN WIRD’S EINE RUNDE</span>
        <h1 id="lobby-title" className="rl-h1">{personal ? "Du bist dabei." : "Ein Platz für dein Aha."}</h1>
        <p className="rl-lead">Die Runde beginnt, sobald der Quizmaster startet.</p>
      </div>
    </div>
    {!personal && showJoinDetails && code && <JoinDetails code={code} />}
    <div className="rl-live-lobby-players">
      <p className="rl-live-lobby-count"><strong><AnimatedPoints value={state.participantCount} /></strong> Teilnehmende</p>
      {state.participants.length > 0 ? <ul className="rl-live-players" aria-label="Teilnehmende">
        {state.participants.slice(0, limit).map((player) => <li className="rl-live-player" key={player.participantId}>
          <Avatar avatarId={player.avatarId} /><span>{player.displayName}</span></li>)}
        {state.participantCount > limit && <li className="rl-live-more-players">+ {state.participantCount - limit} weitere</li>}
      </ul> : !personal && <p className="rl-hint">Noch niemand dabei. Teile den Spielcode!</p>}
    </div>
    <p className="rl-live-hint">{state.streakBonusEnabled ? STREAK_RULE_TEXT :
      "Sammle richtige Antworten, Serien und Abzeichen. Streak-Bonuspunkte sind in dieser Runde aus."}</p>
  </section>;
}
