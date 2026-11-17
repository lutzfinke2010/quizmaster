import { describe, expect, it } from "vitest";
import type { GameState } from "../cloud";
import { classifyLiveEvent } from "./liveEvents";

const state = {
  sessionId: "s", status: "QUESTION_OPEN", version: 4, title: "T", questionIndex: 0, questionCount: 3,
  participantCount: 10, answerCount: 2, eligibleParticipantCount: 10, serverTime: 0, participants: [], leaderboard: [],
} as GameState;

describe("classifyLiveEvent", () => {
  it("lädt bei neuer Version oder fehlendem Zustand neu", () => {
    expect(classifyLiveEvent(null, { sessionId: "s", version: 1 })).toEqual({ kind: "reload" });
    expect(classifyLiveEvent(state, { sessionId: "s", version: 5, answerCount: 0 })).toEqual({ kind: "reload" });
  });

  it("übernimmt reine Antwortzähler ohne Reload", () => {
    const action = classifyLiveEvent(state, { sessionId: "s", version: 4, participantCount: 10, answerCount: 7 });
    expect(action).toMatchObject({ kind: "patch", reloadParticipants: false, state: { answerCount: 7, participantCount: 10 } });
  });

  it("fordert bei geänderter Teilnehmendenzahl die Spielerliste an", () => {
    expect(classifyLiveEvent(state, { sessionId: "s", version: 4, participantCount: 11, answerCount: 2 }))
      .toMatchObject({ kind: "patch", reloadParticipants: true });
  });

  it("ignoriert veraltete oder unveränderte Events", () => {
    expect(classifyLiveEvent(state, { sessionId: "s", version: 3, answerCount: 9 })).toEqual({ kind: "ignore" });
    expect(classifyLiveEvent(state, { sessionId: "s", version: 4, participantCount: 10, answerCount: 2 })).toEqual({ kind: "ignore" });
    expect(classifyLiveEvent(state, { sessionId: "s", version: 4 })).toEqual({ kind: "ignore" });
  });
});
