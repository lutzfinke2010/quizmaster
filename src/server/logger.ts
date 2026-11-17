type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

let context: Fields = {};

/** Setzt Korrelationsfelder (z. B. `requestId`, `operation`), die jeder folgenden Logzeile beigefügt werden. */
export function setLogContext(fields: Fields): void {
  context = { ...fields };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const named = error as Error & { code?: unknown; $metadata?: { requestId?: unknown } };
    return { name: error.name, message: error.message, code: named.code, awsRequestId: named.$metadata?.requestId };
  }
  return { name: "UnknownError" };
}

function write(level: Level, event: string, fields: Fields = {}): void {
  const entry: Fields = { level, event, timestamp: new Date().toISOString(), ...context };
  for (const [key, value] of Object.entries(fields)) entry[key] = key === "error" ? serializeError(value) : value;
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Minimales strukturiertes JSON-Logging für Lambda/CloudWatch (Logs Insights kann die Felder direkt filtern).
 * Keine personenbezogenen Daten loggen: keine Identity-IDs, Tokens, Namen oder Antworten.
 */
export const logger = {
  debug: (event: string, fields?: Fields) => { if (process.env.LOG_LEVEL === "debug") write("debug", event, fields); },
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
