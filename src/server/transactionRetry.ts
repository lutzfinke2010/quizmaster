import { logger } from "./logger";

function cancellationCodes(error: unknown): unknown[] {
  if (!(error instanceof Error) || error.name !== "TransactionCanceledException" ||
      !("CancellationReasons" in error) || !Array.isArray(error.CancellationReasons)) return [];
  return error.CancellationReasons.map((reason: unknown) =>
    typeof reason === "object" && reason !== null && "Code" in reason ? reason.Code : undefined,
  );
}

export function isConditionalFailure(error: unknown): boolean {
  return error instanceof Error && (error.name === "ConditionalCheckFailedException" ||
    cancellationCodes(error).includes("ConditionalCheckFailed"));
}

export async function withTransactionConflictRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const conflict = error instanceof Error &&
        (error.name === "TransactionConflictException" || cancellationCodes(error).includes("TransactionConflict"));
      if (!conflict || isConditionalFailure(error) || attempt >= 10) {
        if (conflict && attempt >= 10) logger.warn("transaction.conflictRetriesExhausted", { attempts: attempt + 1 });
        throw error;
      }
      logger.debug("transaction.conflictRetry", { attempt });
      const maxDelay = Math.min(2_000, (2 ** attempt) * 50);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * maxDelay));
    }
  }
}
