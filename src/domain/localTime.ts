type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function partsAt(timestamp: number, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(timestamp);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function sameLocalTime(left: LocalParts, right: LocalParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day &&
    left.hour === right.hour && left.minute === right.minute;
}

function offsetAt(timestamp: number, timeZone: string): number {
  const local = partsAt(timestamp, timeZone);
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) -
    Math.floor(timestamp / 60_000) * 60_000;
}

export function possibleInstants(localInput: string, timeZone: string): number[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localInput);
  if (!match) return [];
  const expected: LocalParts = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]),
  };
  const wallTime = Date.UTC(expected.year, expected.month - 1, expected.day, expected.hour, expected.minute);
  if (!sameLocalTime({
    year: new Date(wallTime).getUTCFullYear(), month: new Date(wallTime).getUTCMonth() + 1,
    day: new Date(wallTime).getUTCDate(), hour: new Date(wallTime).getUTCHours(),
    minute: new Date(wallTime).getUTCMinutes(),
  }, expected)) return [];

  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) offsets.add(offsetAt(wallTime + hours * 3_600_000, timeZone));
  return [...new Set([...offsets].map((offset) => wallTime - offset))]
    .filter((timestamp) => sameLocalTime(partsAt(timestamp, timeZone), expected))
    .sort((left, right) => left - right);
}

export function formatDateTimeInZone(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium", timeStyle: "short", timeZone,
  }).format(timestamp);
}

/** Absoluter Zeitpunkt mit erkennbarer Zeitzone, z. B. „24.12.2025, 18:00 Uhr MEZ“ (kein relativer Text, kein Countdown). */
export function formatDateTimeWithZone(timestamp: number, timeZone: string, style: "short" | "long" = "short"): string {
  const date = new Intl.DateTimeFormat("de-DE", style === "long"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }
    : { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(timestamp);
  const parts = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone, timeZoneName: "short",
  }).formatToParts(timestamp);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${date}, ${value("hour")}:${value("minute")} Uhr ${value("timeZoneName")}`.trim();
}
