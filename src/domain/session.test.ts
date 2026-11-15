import { describe, expect, it } from "vitest";
import { canAcceptAnswer, transition, type SessionState } from "./session";

function lobby(questionCount = 2): SessionState {
  return { status: "LOBBY", version: 0, questionIndex: -1, questionCount, opensAt: null, closesAt: null };
}

describe("Spielzustände", () => {
  it("führt zwei Fragen in der erlaubten Reihenfolge bis zum Ende", () => {
    let state = transition(lobby(), 0, { type: "startQuestion", now: 1000, durationSeconds: 5 });
    for (let question = 0; question < 2; question++) {
      expect(state.status).toBe("COUNTDOWN");
      expect(state.questionIndex).toBe(question);
      state = transition(state, state.version, { type: "openQuestion", now: state.opensAt! });
      state = transition(state, state.version, { type: "closeQuestion", now: state.closesAt!, automatic: true });
      state = transition(state, state.version, { type: "beginScoring" });
      state = transition(state, state.version, { type: "publishReveal" });
      state = transition(state, state.version, { type: "showLeaderboard" });
      if (question === 0) state = transition(state, state.version, { type: "nextQuestion", now: 20_000, durationSeconds: 5 });
    }
    state = transition(state, state.version, { type: "finishSession" });
    expect(state.status).toBe("FINISHED");
    expect(state.version).toBe(13);
  });

  it("verhindert veraltete, doppelte und unzulässige Schritte", () => {
    const state = transition(lobby(), 0, { type: "startQuestion", now: 0, durationSeconds: 20 });
    expect(() => transition(state, 0, { type: "startQuestion", now: 0, durationSeconds: 20 })).toThrow(/Version/);
    expect(() => transition(state, 1, { type: "startQuestion", now: 0, durationSeconds: 20 })).toThrow();
    expect(() => transition(state, 1, { type: "publishReveal" })).toThrow();
    expect(() => transition(state, 1, { type: "openQuestion", now: 2999 })).toThrow();
    expect(() => transition(state, 1, { type: "openQuestion", now: 23_000 })).toThrow();
    expect(() => transition(state, 1, { type: "closeQuestion", now: 10, automatic: false })).toThrow();
  });

  it("akzeptiert Antworten nur innerhalb der offenen Frist", () => {
    let state = transition(lobby(), 0, { type: "startQuestion", now: 0, durationSeconds: 5 });
    expect(canAcceptAnswer(state, 3000)).toBe(false);
    state = transition(state, 1, { type: "openQuestion", now: 3000 });
    expect(canAcceptAnswer(state, 2999)).toBe(false);
    expect(canAcceptAnswer(state, 3000)).toBe(true);
    expect(canAcceptAnswer(state, 7999)).toBe(true);
    expect(canAcceptAnswer(state, 8000)).toBe(false);
    expect(canAcceptAnswer(state, NaN)).toBe(false);
    expect(() => transition(state, 2, { type: "closeQuestion", now: 7999, automatic: true })).toThrow();
    state = transition(state, 2, { type: "closeQuestion", now: 4000, automatic: false });
    expect(canAcceptAnswer(state, 4000)).toBe(false);
  });

  it("erlaubt verspätetes automatisches Schließen auch bei verpasstem Öffnungsschritt", () => {
    const state = transition(lobby(), 0, { type: "startQuestion", now: 0, durationSeconds: 5 });
    expect(transition(state, 1, { type: "closeQuestion", now: 8000, automatic: true }).status).toBe("QUESTION_CLOSED");
  });

  it("sperrt weitere Steuerung nach Abbruch", () => {
    const state = transition(lobby(), 0, { type: "cancelSession" });
    expect(() => transition(state, 1, { type: "cancelSession" })).toThrow();
    expect(() => transition(state, 1, { type: "startQuestion", now: 0, durationSeconds: 20 })).toThrow();
  });
});
