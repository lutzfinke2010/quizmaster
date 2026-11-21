/** Turns thrown values (Error, GraphQL `{ errors: [{ message }] }`) into a readable German message. */
export function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    return error.errors.map((item: unknown) =>
      item && typeof item === "object" && "message" in item && typeof item.message === "string"
        ? item.message : "Unbekannter Fehler").join("; ");
  }
  return "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.";
}
