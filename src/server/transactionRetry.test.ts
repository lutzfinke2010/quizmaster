import { describe, expect, it, vi } from "vitest";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";

function canceled(code: string) {
  return Object.assign(new Error("transaction cancelled"), {
    name: "TransactionCanceledException",
    CancellationReasons: [{ Code: code }],
  });
}

describe("Transaktionskonflikte", () => {
  it("wiederholt Konflikte und gibt das tatsächliche Ergebnis zurück", async () => {
    const operation = vi.fn().mockRejectedValueOnce(canceled("TransactionConflict"))
      .mockRejectedValueOnce(canceled("TransactionConflict")).mockResolvedValue("ok");
    await expect(withTransactionConflictRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("wiederholt Bedingungsfehler nicht", async () => {
    const error = canceled("ConditionalCheckFailed");
    const operation = vi.fn().mockRejectedValue(error);
    expect(isConditionalFailure(error)).toBe(true);
    await expect(withTransactionConflictRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
