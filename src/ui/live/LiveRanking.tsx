import type { GameState, Participation } from "../../cloud";
import { AnimatedPoints } from "../game/AnimatedPoints";
import { Leaderboard, Podium, RankChange } from "../game/Ranking";
import { Achievements, Finale, RankRise } from "../game/Rewards";
import { Trophy } from "../Illustrations";

/** Intermediate and final ranking: personal with neighbouring places, shared with podium 2 – 1 – 3 and places 4 – 8. */
export function LiveRanking({ state, participant, personal, celebrate, celebrateFinal }: {
  state: GameState; participant?: Participation | null; personal: boolean; celebrate: boolean; celebrateFinal: boolean;
}) {
  const final = state.status === "FINISHED";
  const ownIndex = state.leaderboard.findIndex((player) => player.participantId === participant?.participantId);
  const own = state.leaderboard[ownIndex];
  const rows = personal
    ? state.leaderboard.slice(Math.max(0, ownIndex - 1), Math.max(0, ownIndex - 1) + 3)
    : state.leaderboard.slice(3, 8);
  const animateChanges = celebrate && state.questionIndex > 0;
  const leader = state.leaderboard[0];
  return <section className={`rl-live-ranking${personal ? " is-personal" : " is-shared"}${final ? " is-final" : ""}`}
    aria-labelledby="ranking-title">
    <div className="rl-live-ranking-head">
      <span className="rl-eyebrow">{final ? "DAS WAR EURE RUNDE" : `ZWISCHENSTAND · NACH FRAGE ${state.questionIndex + 1}`}</span>
      <h1 id="ranking-title" className="rl-h1">{final ? "Endstand" : "Zwischenstand"}</h1>
      {!personal && <p className="rl-live-ranking-intro">{final ? "Zusammen gerätselt. Gemeinsam gefeiert." : "Da geht noch was."}</p>}
    </div>
    {final && (personal ? Boolean(own) : state.leaderboard.length > 0) &&
      <Finale winner={personal && own?.rank === 1} shared={!personal} celebrate={celebrateFinal}
        eventId={`${state.sessionId}:${personal ? participant?.participantId ?? "personal" : "shared"}:finale`} />}
    {personal ? own ? <div className="rl-live-own-rank">
      <Trophy className="rl-live-trophy" />
      <h2 className="rl-live-own-place"><span className="rl-visually-hidden">Dein {final ? "Endstand" : "Zwischenstand"}: </span>
        Platz {own.rank}</h2>
      <p className="rl-live-own-points"><AnimatedPoints value={own.points} from={celebrate ? own.previousPoints ?? own.points : own.points} />
        <span>Punkte insgesamt</span></p>
      {final && <p className="rl-live-own-correct">{own.correctAnswers} von {state.questionCount} Fragen richtig beantwortet</p>}
      <RankChange player={own} questionIndex={state.questionIndex} />
      {state.questionIndex > 0 && own.previousRank > 0 && <RankRise change={own.rankChange}
        eventId={`${state.sessionId}:${own.participantId}:rank:${state.questionIndex}`} celebrate={celebrate} />}
      <Achievements streak={own.streak} maxStreak={own.maxStreak} badges={own.badges} />
    </div> : <p role="status" className="rl-hint">Deine Platzierung ist noch nicht verfügbar.</p> :
      <div className="rl-live-ranking-podium">
        {!final && state.questionIndex > 0 && (leader?.previousRank ?? 0) > 1 && celebrate &&
          <RankRise change={leader.rankChange} eventId={`${state.sessionId}:leader:${state.questionIndex}`} celebrate />}
        <Podium players={state.leaderboard} final={final} animateChanges={animateChanges} />
      </div>}
    <div className="rl-live-ranking-rows">
      {state.leaderboard.length === 0 ? <p className="rl-hint">Noch keine Teilnehmenden.</p> : rows.length > 0 &&
        <Leaderboard players={rows} participantId={participant?.participantId} animateChanges={animateChanges}
          label={personal ? "Deine benachbarten Plätze" : "Weitere Plätze"} />}
      {!personal && state.leaderboard.length > 8 && <p className="rl-hint rl-live-ranking-count">
        Die ersten 8 von {state.leaderboard.length} Teilnehmenden · Deine Position siehst du auf deinem Handy.</p>}
      {!final && <p className="rl-live-hint">Die nächste Frage startet der Quizmaster.</p>}
    </div>
  </section>;
}
