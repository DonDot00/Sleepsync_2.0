import type { ScheduleBlock, TaskDto } from "../../../shared/src/schemas.js";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const fmt = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const durMin = (t: TaskDto): number => Math.round(t.dur_h * 60);

/**
 * Lay out a single day: fixed tasks stay at their fixed_time, flexible tasks
 * fill the gaps by priority, and nothing is scheduled past bedtime.
 */
export function generateSchedule(tasks: TaskDto[], wakeTime: string, sleepTime: string): ScheduleBlock[] {
  const schedule: ScheduleBlock[] = [];
  let current = toMin(wakeTime);
  const sleepAt = toMin(sleepTime);

  const fixed = tasks
    .filter((t) => t.task_type === "fixed" && t.fixed_time)
    .sort((a, b) => a.fixed_time!.localeCompare(b.fixed_time!));
  const flexible = tasks
    .filter((t) => t.task_type !== "fixed")
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  const place = (t: TaskDto, start: number, end: number, type: "fixed" | "flexible") =>
    schedule.push({
      task_id: t.id,
      name: t.title,
      start: fmt(start),
      end: fmt(end),
      type,
      priority: t.priority,
    });

  for (const t of fixed) {
    const start = toMin(t.fixed_time!);
    const end = start + durMin(t);

    // Fill the gap before this fixed block with flexible tasks that fit entirely.
    while (flexible.length && current < start) {
      const ft = flexible[0]!;
      const ftEnd = current + durMin(ft);
      if (ftEnd > start) break;
      place(ft, current, ftEnd, "flexible");
      current = ftEnd;
      flexible.shift();
    }
    place(t, start, end, "fixed");
    current = Math.max(current, end);
  }

  // Remaining flexible tasks go after the last fixed block, never past bedtime.
  for (const ft of flexible) {
    const ftEnd = current + durMin(ft);
    if (ftEnd <= sleepAt) {
      place(ft, current, ftEnd, "flexible");
      current = ftEnd;
    }
  }

  schedule.push({
    task_id: null,
    name: "Sleep",
    start: fmt(sleepAt),
    end: wakeTime,
    type: "sleep",
    priority: "non-negotiable",
  });
  return schedule;
}
