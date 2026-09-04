import type { StageState } from "./stage-engine";

export type EscalationLevel = "OK" | "WARN" | "BREACH";

function utcDayFloor(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysBetweenUtc(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((utcDayFloor(end) - utcDayFloor(start)) / msPerDay));
}

export function daysInStage(stage: StageState, now: Date): number {
  if (!stage.activatedAt) {
    return 0;
  }
  return daysBetweenUtc(new Date(stage.activatedAt), now);
}

export function isOverSla(stage: StageState, slaDays: number, now: Date): boolean {
  return daysInStage(stage, now) >= slaDays;
}

export function escalationLevel(
  stage: StageState,
  slaDays: number,
  now: Date,
): EscalationLevel {
  const days = daysInStage(stage, now);
  const breachThreshold = Math.ceil(slaDays * 1.5);

  if (days >= breachThreshold) {
    return "BREACH";
  }
  if (days >= slaDays) {
    return "WARN";
  }
  return "OK";
}
