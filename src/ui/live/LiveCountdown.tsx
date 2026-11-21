import type { GameState } from "../../cloud";
import { DeadlineTimer } from "../game/Timers";
import { LlamaCharacter } from "../LlamaCharacter";

export function LiveCountdown({ state, offset }: { state: GameState; offset: number }) {
  return <section className="rl-live-countdown" aria-labelledby="countdown-title">
    <span className="rl-eyebrow">FRAGE {state.questionIndex + 1} VON {state.questionCount}</span>
    <LlamaCharacter mood="curious" className="rl-live-llama" />
    <h1 id="countdown-title" className="rl-h1">Gleich geht’s los!</h1>
    {state.opensAt != null && <DeadlineTimer deadline={state.opensAt} offset={offset} size="stage" />}
    <p className="rl-lead">Mach dich bereit für die nächste Frage.</p>
  </section>;
}

export function LiveCancelled() {
  return <section className="rl-live-countdown" aria-labelledby="cancelled-title">
    <h1 id="cancelled-title" className="rl-h1">Runde abgebrochen</h1>
    <p className="rl-lead">Diese Sitzung wurde vom Quizmaster beendet.</p>
  </section>;
}
