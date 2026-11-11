import { beforeEach, describe, expect, it } from "vitest";
import { defaultRepeat, type TaskDto } from "../../shared/src/schemas.js";
import { buildApp } from "./app.js";
import { resetDbForTests } from "./db.js";
import { addDays, daysBetween, todayIso, weekday } from "./dates.js";
import { repeatOffsets } from "./repeat.js";
import { generateSchedule } from "./services/schedule-engine.js";
import { normalizeAiResult } from "./services/ai.js";

process.env["NODE_ENV"] = "test";

describe("dates", () => {
  it("does day math across month and DST boundaries", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(weekday("2026-11-11")).toBe(3); // Wednesday
  });
});

describe("repeatOffsets", () => {
  it("returns Mon/Wed copies until end_date, excluding the base day", () => {
    const today = todayIso();
    const end = addDays(today, 14);
    const offs = repeatOffsets(0, { enabled: true, days: [1, 3], end_date: end }, today);
    expect(offs.length).toBeGreaterThanOrEqual(4);
    expect(offs).not.toContain(0);
    for (const o of offs) expect([1, 3]).toContain(weekday(addDays(today, o)));
    expect(Math.max(...offs)).toBeLessThanOrEqual(14);
  });

  it("does nothing when disabled or no days", () => {
    expect(repeatOffsets(0, defaultRepeat(), todayIso())).toEqual([]);
    expect(repeatOffsets(0, { enabled: true, days: [], end_date: null }, todayIso())).toEqual([]);
  });
});

describe("generateSchedule", () => {
  const task = (o: Partial<TaskDto>): TaskDto => ({
    id: 1, title: "t", color: "purple", start_h: 9, dur_h: 1, day: 0, location: null,
    description: null, priority: "medium", task_type: "flexible", fixed_time: null,
    repeat: defaultRepeat(), repeat_group_id: null, is_completed: false, is_missed: false,
    miss_count: 0, complete_count: 0, ...o,
  });

  it("works around fixed tasks and never schedules past bedtime", () => {
    const out = generateSchedule(
      [
        task({ id: 1, title: "Meeting", task_type: "fixed", fixed_time: "10:00", dur_h: 1 }),
        task({ id: 2, title: "Short", dur_h: 1, priority: "high" }),
        task({ id: 3, title: "Too long", dur_h: 30, priority: "low" }),
      ],
      "07:00",
      "23:00",
    );
    expect(out.map((b) => b.name)).toEqual(["Short", "Meeting", "Sleep"]);
    expect(out[0]).toMatchObject({ start: "07:00", end: "08:00" });
  });
});

describe("normalizeAiResult", () => {
  it("migrates a flat legacy task into the tasks array", () => {
    const r = normalizeAiResult({ action: "create_task", message: "ok", task_name: "Run", new_time: "06:00" });
    expect(r.action).toBe("add_task");
    expect(r.tasks[0]).toMatchObject({ task_name: "Run", new_time: "06:00", duration_minutes: 60, new_day: 0 });
  });

  it("falls back to safe defaults for junk values", () => {
    const r = normalizeAiResult({ action: "explode", tasks: [{ task_name: "x", priority: "urgent" }] });
    expect(r.action).toBe("none");
    expect(r.tasks[0]?.priority).toBe("medium");
  });
});

describe("API", () => {
  beforeEach(() => resetDbForTests());

  it("creates, lists, updates and deletes a task", async () => {
    const app = buildApp();
    const created = (await app.inject({ method: "POST", url: "/api/tasks/", payload: { title: "Run", start_h: 7 } })).json();
    expect(created).toMatchObject({ title: "Run", start_h: 7, priority: "medium", repeat: defaultRepeat() });

    const list = (await app.inject({ method: "GET", url: "/api/tasks" })).json();
    expect(list).toHaveLength(1);

    const patched = (await app.inject({ method: "PATCH", url: `/api/tasks/${created.id}`, payload: { start_h: 8.5 } })).json();
    expect(patched.start_h).toBe(8.5);
    expect(patched.title).toBe("Run");

    expect((await app.inject({ method: "DELETE", url: `/api/tasks/${created.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/api/tasks/${created.id}` })).statusCode).toBe(404);
  });

  it("expands a repeating task and cancels the series from a given day", async () => {
    const app = buildApp();
    const base = (
      await app.inject({
        method: "POST",
        url: "/api/tasks/",
        payload: { title: "Gym", repeat: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], end_date: addDays(todayIso(), 5) } },
      })
    ).json();
    expect(base.repeat_group_id).toBeTruthy();
    expect((await app.inject({ method: "GET", url: "/api/tasks" })).json()).toHaveLength(6); // days 0..5

    const del = await app.inject({ method: "DELETE", url: `/api/tasks/group/${base.repeat_group_id}?from_day=3` });
    expect(del.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/tasks" })).json()).toHaveLength(3);
  });

  it("demotes priority after three misses", async () => {
    const app = buildApp();
    const t = (await app.inject({ method: "POST", url: "/api/tasks/", payload: { title: "x", priority: "high" } })).json();
    let out;
    for (let i = 0; i < 3; i++) {
      out = (await app.inject({ method: "PATCH", url: `/api/tasks/${t.id}`, payload: { is_missed: true } })).json();
    }
    expect(out).toMatchObject({ miss_count: 3, priority: "medium" });
  });

  it("upserts Apple Health sleep for one night", async () => {
    const app = buildApp();
    const payload = { bedtime: "23:00", wake_time: "07:00", total_minutes: 420, deep_minutes: 80, rem_minutes: 90, light_minutes: 250 };
    const a = (await app.inject({ method: "POST", url: "/api/sleep/apple-health", payload })).json();
    const b = (await app.inject({ method: "POST", url: "/api/sleep/apple-health", payload: { ...payload, total_minutes: 480 } })).json();
    expect(a.id).toBe(b.id);
    expect(b).toMatchObject({ total_hours: 8, score: 100 });
    expect((await app.inject({ method: "GET", url: "/api/sleep/recent" })).json()).toHaveLength(1);
  });

  it("rejects bad input with 422 and returns 503 for chat without an API key", async () => {
    const app = buildApp();
    expect((await app.inject({ method: "POST", url: "/api/tasks/", payload: { priority: "high" } })).statusCode).toBe(422);
    delete process.env["OPENAI_API_KEY"];
    const chat = await app.inject({ method: "POST", url: "/api/chat/", payload: { message: "hi" } });
    expect(chat.statusCode).toBe(503);
  });
});
