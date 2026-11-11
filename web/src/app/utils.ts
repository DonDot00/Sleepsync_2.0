import type { Priority, RepeatConfig, TaskType } from "@shared";
import { EVENT_COLORS, SLEEP_TIPS } from "./constants";
import type { CalEvent, EventColor, PositionedEvent } from "./models";

// ── Time helpers ──

/** 9.5 → "9:30am" */
export function fmtH(h: number): string {
  const hrs = Math.floor(h) % 24;
  const mins = Math.round((h % 1) * 60);
  const p = hrs >= 12 ? "pm" : "am";
  const d = hrs % 12 === 0 ? 12 : hrs % 12;
  return mins === 0 ? `${d}${p}` : `${d}:${String(mins).padStart(2, "0")}${p}`;
}

/** snap to the nearest 15 minutes */
export const snap = (h: number): number => Math.round(h * 4) / 4;

/** decimal hour → "HH:MM" for time inputs */
export function hToInput(h: number): string {
  const hrs = Math.floor(h) % 24;
  const mins = Math.round((h % 1) * 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** "HH:MM" → decimal hour */
export function inputToH(str: string | null | undefined): number {
  if (!str) return 9;
  const [h, m] = str.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

// ── Date helpers ──

/** Local-date ISO string (not UTC — toISOString() would shift the day late in the evening). */
export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MS_PER_DAY = 86_400_000;

/** days between a Date and today (0=today, 1=tomorrow…) */
export function dateToDayOffset(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sel = new Date(date);
  sel.setHours(0, 0, 0, 0);
  return Math.round((sel.getTime() - today.getTime()) / MS_PER_DAY);
}

export function offsetToDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

export function dayLabel(offset: number): string {
  return offsetToDate(offset).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function isoToOffset(iso: string): number {
  const sel = new Date(`${iso}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((sel.getTime() - t.getTime()) / MS_PER_DAY));
}

export const offsetToIso = (offset: number): string => dateToIso(offsetToDate(offset));

// ── Sleep helpers ──

export function calcSleepHours(bed: string, wake: string): number {
  const b = inputToH(bed);
  const w = inputToH(wake);
  return w > b ? w - b : 24 - b + w;
}

export function estimateStages(h: number): { light: number; deep: number; rem: number } {
  const m = h * 60;
  return { light: Math.round(m * 0.5), deep: Math.round(m * 0.18), rem: Math.round(m * 0.22) };
}

export function fmtMins(m: number): string {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return mn === 0 ? `${h}h` : `${h}h ${mn}m`;
}

// ── Event helpers ──

export const getColor = (id: string): EventColor => EVENT_COLORS.find((c) => c.id === id) ?? EVENT_COLORS[0]!;
export const randomTip = (): string => SLEEP_TIPS[Math.floor(Math.random() * SLEEP_TIPS.length)]!;
export const makeDefaultRepeat = (): RepeatConfig => ({ enabled: false, days: [], end_date: null });

export function deriveBadge(priority: Priority, taskType: TaskType): string | null {
  if (priority === "high" && taskType === "fixed") return "High priority · Fixed";
  if (priority === "high") return "High priority";
  if (taskType === "fixed") return "Fixed task";
  if (taskType === "free") return "Free time";
  return null;
}

/** Side-by-side columns so overlapping events don't render on top of each other. */
export function layoutEvents(events: CalEvent[]): PositionedEvent[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.startH - b.startH);
  const columns: CalEvent[][] = [];
  for (const ev of sorted) {
    const col = columns.find((c) => {
      const last = c[c.length - 1]!;
      return last.startH + last.durH <= ev.startH;
    });
    if (col) col.push(ev);
    else columns.push([ev]);
  }
  return events.map((ev) => {
    const evEnd = ev.startH + ev.durH;
    const overlapCols = columns.filter((col) => col.some((o) => o.startH < evEnd && o.startH + o.durH > ev.startH));
    return { ev, colIndex: overlapCols.findIndex((col) => col.includes(ev)), totalCols: overlapCols.length };
  });
}
