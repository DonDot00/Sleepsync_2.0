import type { RepeatConfig } from "../../shared/src/schemas.js";
import { addDays, daysBetween, weekday } from "./dates.js";

/**
 * Day offsets (from `today`) of every copy of a recurring task.
 * The base task is day 0 of the series; copies start the day after it and run
 * up to `end_date` (default: 60 days out) on the selected weekdays.
 */
export function repeatOffsets(baseDay: number, cfg: RepeatConfig, today: string): number[] {
  if (!cfg.enabled || cfg.days.length === 0) return [];

  const end = cfg.end_date ?? addDays(today, 60);
  const out: number[] = [];
  for (let cur = addDays(today, baseDay + 1); cur <= end; cur = addDays(cur, 1)) {
    if (cfg.days.includes(weekday(cur))) out.push(daysBetween(today, cur));
  }
  return out;
}
