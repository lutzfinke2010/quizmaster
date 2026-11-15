import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), ensure: vi.fn() }));
vi.mock("../../amplify/functions/timer/clients", () => ({
  database: { send: mocks.send },
  sfn: {},
  environment: (name: string) => name,
}));
vi.mock("./timerDispatch", () => ({ ensureTimerStarted: mocks.ensure }));
import { handler } from "../../amplify/functions/timer/sweep";

describe("Timer-Sweep", () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.ensure.mockReset();
  });

  it("verarbeitet nach einem fehlgeschlagenen Auftrag weitere Aufträge und meldet den Fehler", async () => {
    mocks.send.mockImplementation(async (command: { input: { ExpressionAttributeValues: { ":partition": string } } }) => ({
      Items: command.input.ExpressionAttributeValues[":partition"] === "PENDING#0"
        ? [{ sessionId: "s1", questionId: "q1", timerId: "bad" }, { sessionId: "s2", questionId: "q2", timerId: "good" }]
        : [],
    }));
    mocks.ensure.mockImplementation(async (_db, _sfn, _table, _machine, key: { timerId: string }) => {
      if (key.timerId === "bad") throw new Error("Fehlerhafter Auftrag");
    });

    await expect(handler()).rejects.toThrow("1 Timeraufträge oder Shards");
    expect(mocks.send).toHaveBeenCalledTimes(16);
    expect(mocks.ensure).toHaveBeenCalledTimes(2);
    expect(mocks.ensure.mock.calls[1][4]).toEqual({ sessionId: "s2", questionId: "q2", timerId: "good" });
  });
});
