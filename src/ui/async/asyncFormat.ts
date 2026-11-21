import type { AsyncGuestState } from "../../cloud";
import { ASYNC_SPEED_V1, type AsyncScoringRule } from "../../domain/scoring";

/** Value for `<input type="datetime-local">` in the browser's local time zone. */
export function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const pointsText = (value: number) => value.toLocaleString("de-DE");
export const secondsText = (ms: number) => `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;

export type AsyncScoringFields = Pick<AsyncGuestState, "scoringVersion" | "basePoints" | "maxBonusPoints" | "bonusWindowMs">;

export function scoringRuleOf(info: AsyncScoringFields | null | undefined): AsyncScoringRule | null {
  if (info?.scoringVersion !== ASYNC_SPEED_V1.version) return null;
  return {
    version: ASYNC_SPEED_V1.version,
    basePoints: info.basePoints ?? ASYNC_SPEED_V1.basePoints,
    maxBonusPoints: info.maxBonusPoints ?? ASYNC_SPEED_V1.maxBonusPoints,
    bonusWindowMs: info.bonusWindowMs ?? ASYNC_SPEED_V1.bonusWindowMs,
  };
}

export function speedIntro(rule: AsyncScoringRule) {
  return `Richtig antworten bringt ${pointsText(rule.basePoints)} Punkte. Je schneller du bist, desto mehr Bonus bekommst du – bis zu ${pointsText(rule.maxBonusPoints)} Punkte zusätzlich.`;
}

export const asyncStatusText = (status: string) => status === "ACTIVE" ? "Aktiv" : status === "ENDED" ? "Vorzeitig beendet" : "Abgelaufen";

export const attemptStatusText = (status: string) => status === "COMPLETED" ? "abgeschlossen" : status === "IN_PROGRESS" ? "läuft" : "Frist abgelaufen";
