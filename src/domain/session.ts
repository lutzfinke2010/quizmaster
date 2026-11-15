export type SessionStatus =
  | "LOBBY" | "COUNTDOWN" | "QUESTION_OPEN" | "QUESTION_CLOSED"
  | "SCORING" | "REVEAL" | "LEADERBOARD" | "FINISHED" | "CANCELLED";

export interface SessionState {
  status: SessionStatus;
  version: number;
  questionIndex: number;
  questionCount: number;
  opensAt: number | null;
  closesAt: number | null;
}

export type SessionCommand =
  | { type: "startQuestion"; durationSeconds: number; now: number }
  | { type: "openQuestion"; now: number }
  | { type: "closeQuestion"; now: number; automatic: boolean }
  | { type: "beginScoring" }
  | { type: "publishReveal" }
  | { type: "showLeaderboard" }
  | { type: "nextQuestion"; durationSeconds: number; now: number }
  | { type: "finishSession" }
  | { type: "cancelSession" };

function countdown(state: SessionState, questionIndex: number, now: number, durationSeconds: number) {
  if (!Number.isFinite(now) || !Number.isInteger(durationSeconds) ||
      durationSeconds < 5 || durationSeconds > 120) {
    throw new Error("Ungültige Fragezeit.");
  }
  const opensAt = now + 3000;
  return { ...state, status: "COUNTDOWN" as const, questionIndex, opensAt,
    closesAt: opensAt + durationSeconds * 1000 };
}

export function transition(
  state: SessionState,
  expectedVersion: number,
  command: SessionCommand,
): SessionState {
  if (state.version !== expectedVersion) throw new Error("Veraltete Version.");
  let next: SessionState;
  switch (command.type) {
    case "startQuestion":
      if (state.status !== "LOBBY" || state.questionCount < 1) break;
      next = countdown(state, 0, command.now, command.durationSeconds);
      return { ...next, version: state.version + 1 };
    case "openQuestion":
      if (state.status !== "COUNTDOWN" || state.opensAt === null ||
          state.closesAt === null || !Number.isFinite(command.now) ||
          command.now < state.opensAt || command.now >= state.closesAt) break;
      next = { ...state, status: "QUESTION_OPEN" };
      return { ...next, version: state.version + 1 };
    case "closeQuestion":
      if ((state.status !== "QUESTION_OPEN" && state.status !== "COUNTDOWN") ||
          state.closesAt === null || !Number.isFinite(command.now) ||
          (state.status === "COUNTDOWN" && !command.automatic) ||
          (command.automatic && command.now < state.closesAt)) break;
      next = { ...state, status: "QUESTION_CLOSED" };
      return { ...next, version: state.version + 1 };
    case "beginScoring":
      if (state.status !== "QUESTION_CLOSED") break;
      next = { ...state, status: "SCORING" };
      return { ...next, version: state.version + 1 };
    case "publishReveal":
      if (state.status !== "SCORING") break;
      next = { ...state, status: "REVEAL" };
      return { ...next, version: state.version + 1 };
    case "showLeaderboard":
      if (state.status !== "REVEAL") break;
      next = { ...state, status: "LEADERBOARD" };
      return { ...next, version: state.version + 1 };
    case "nextQuestion":
      if (state.status !== "LEADERBOARD" || state.questionIndex + 1 >= state.questionCount) break;
      next = countdown(state, state.questionIndex + 1, command.now, command.durationSeconds);
      return { ...next, version: state.version + 1 };
    case "finishSession":
      if (state.status !== "LEADERBOARD" || state.questionIndex !== state.questionCount - 1) break;
      next = { ...state, status: "FINISHED" };
      return { ...next, version: state.version + 1 };
    case "cancelSession":
      if (state.status === "FINISHED" || state.status === "CANCELLED") break;
      next = { ...state, status: "CANCELLED" };
      return { ...next, version: state.version + 1 };
  }
  throw new Error("Dieser Schritt ist im aktuellen Spielstatus nicht erlaubt.");
}

export function canAcceptAnswer(state: SessionState, receivedAt: number): boolean {
  return state.status === "QUESTION_OPEN" &&
    state.opensAt !== null && state.closesAt !== null && Number.isFinite(receivedAt) &&
    receivedAt >= state.opensAt && receivedAt < state.closesAt;
}
