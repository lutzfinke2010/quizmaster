import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toClientError } from "./clientError";

function awsError(name: string) {
  return Object.assign(new Error(`internal ${name} on table GameTable`), { name, $metadata: { requestId: "r" } });
}

describe("toClientError", () => {
  it("gibt fachliche Meldungen unverändert weiter", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(toClientError(new Error("Quiz nicht gefunden."), "getQuiz").message).toBe("Quiz nicht gefunden.");
  });

  it("verbirgt zod- und AWS-Interna", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const zod = z.object({ timerId: z.string() }).safeParse({});
    expect(toClientError(zod.error, "closeQuestion").message).toBe("Ungültige Anfrage.");
    expect(toClientError(awsError("ConditionalCheckFailedException"), "x").message).toMatch(/zwischenzeitlich geändert/);
    expect(toClientError(awsError("ThrottlingException"), "x").message).toMatch(/ausgelastet/);
    expect(toClientError(awsError("ResourceNotFoundException"), "x").message).not.toMatch(/GameTable/);
    expect(toClientError(new TypeError("cannot read properties of undefined"), "x").message).toMatch(/fehlgeschlagen/);
    expect(error).toHaveBeenCalled();
  });
});
