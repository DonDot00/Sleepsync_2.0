/**
 * Date helpers. "Today" is evaluated in APP_TIMEZONE (default: the host's zone)
 * because serverless hosts run in UTC, which would flip the day at the wrong time.
 * All ISO-date math is done in UTC at noon so DST never shifts a day.
 */

const zone = () => process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

export function localParts(now: Date = new Date()): { iso: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export const todayIso = (now?: Date): string => localParts(now).iso;

const toDate = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((toDate(toIso).getTime() - toDate(fromIso).getTime()) / 86_400_000);

/** 0=Sun … 6=Sat */
export const weekday = (iso: string): number => toDate(iso).getUTCDay();

/** "17:30" → 17.5 */
export function timeToHours(t: string | null | undefined): number {
  if (!t) return 9;
  const [h, m] = t.split(":");
  return Number(h) + Number(m ?? 0) / 60;
}
