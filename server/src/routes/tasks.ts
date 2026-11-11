import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  TaskCreateSchema,
  TaskUpdateSchema,
  defaultRepeat,
  type RepeatConfig,
  type TaskCreate,
  type TaskDto,
} from "../../../shared/src/schemas.js";
import { query, run, db, type Row } from "../db.js";
import { todayIso } from "../dates.js";
import { repeatOffsets } from "../repeat.js";

// ── Row <-> DTO ──────────────────────────────────────────────────────────────

function parseRepeat(raw: unknown): RepeatConfig {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...defaultRepeat(), ...(v as object) };
  } catch {
    return defaultRepeat();
  }
}

export function rowToTask(r: Row): TaskDto {
  return {
    id: Number(r["id"]),
    title: String(r["title"]),
    color: (r["color"] as string) ?? "purple",
    start_h: Number(r["start_h"]),
    dur_h: Number(r["dur_h"]),
    day: Number.isFinite(Number(r["day"])) ? Number(r["day"]) : 0,
    location: (r["location"] as string) ?? null,
    description: (r["description"] as string) ?? null,
    priority: (r["priority"] as TaskDto["priority"]) ?? "medium",
    task_type: (r["task_type"] as TaskDto["task_type"]) ?? "flexible",
    fixed_time: (r["fixed_time"] as string) ?? null,
    repeat: parseRepeat(r["repeat"]),
    repeat_group_id: (r["repeat_group_id"] as string) ?? null,
    is_completed: Boolean(r["is_completed"]),
    is_missed: Boolean(r["is_missed"]),
    miss_count: Number(r["miss_count"] ?? 0),
    complete_count: Number(r["complete_count"] ?? 0),
  };
}

const INSERT_SQL = `INSERT INTO tasks
  (title, color, start_h, dur_h, day, location, description, priority, task_type,
   fixed_time, repeat, repeat_group_id)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

const insertArgs = (t: TaskCreate) => [
  t.title,
  t.color,
  t.start_h,
  t.dur_h,
  t.day,
  t.location ?? null,
  t.description ?? null,
  t.priority,
  t.task_type,
  t.fixed_time ?? null,
  JSON.stringify(t.repeat),
  t.repeat_group_id ?? null,
];

export async function getTask(id: number): Promise<TaskDto | undefined> {
  const rows = await query("SELECT * FROM tasks WHERE id = ?", [id]);
  return rows[0] ? rowToTask(rows[0]) : undefined;
}

/** Insert a task and, if it repeats, all of its future copies. Returns the base task. */
export async function createTaskWithRepeats(input: TaskCreate): Promise<TaskDto> {
  const repeating = input.repeat.enabled && input.repeat.days.length > 0;
  const groupId = input.repeat_group_id ?? (repeating ? randomUUID() : null);
  const base: TaskCreate = { ...input, repeat_group_id: groupId };

  const res = await run(INSERT_SQL, insertArgs(base));
  const id = Number(res.lastInsertRowid);
  await insertCopies(base, id);
  return (await getTask(id))!;
}

/** Create the series copies for an already-saved base task. */
async function insertCopies(base: TaskCreate, baseId: number): Promise<void> {
  const offsets = repeatOffsets(base.day, base.repeat, todayIso());
  if (offsets.length === 0) return;

  let groupId = base.repeat_group_id;
  if (!groupId) {
    groupId = randomUUID();
    await run("UPDATE tasks SET repeat_group_id = ? WHERE id = ?", [groupId, baseId]);
  }
  const copy = (day: number): TaskCreate => ({
    ...base,
    day,
    repeat: defaultRepeat(),
    repeat_group_id: groupId,
  });
  await (await db()).batch(
    offsets.map((day) => ({ sql: INSERT_SQL, args: insertArgs(copy(day)) })),
    "write",
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────

const UPDATABLE = [
  "title", "color", "start_h", "dur_h", "day", "location", "description",
  "priority", "task_type", "fixed_time", "repeat", "repeat_group_id",
  "is_completed", "is_missed",
] as const;

type SqlArg = string | number | null;

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", async (req) => createTaskWithRepeats(TaskCreateSchema.parse(req.body)));

  app.get("/", async () => (await query("SELECT * FROM tasks WHERE day >= 0")).map(rowToTask));

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const existing = await getTask(id);
    if (!existing) return reply.code(404).send({ detail: "Task not found" });

    const update = TaskUpdateSchema.parse(req.body);
    const changes = new Map<string, SqlArg>();
    for (const key of UPDATABLE) {
      const v = update[key];
      if (v === null || v === undefined) continue; // null/missing = leave unchanged
      changes.set(key, key === "repeat" ? JSON.stringify(v) : typeof v === "boolean" ? Number(v) : (v as SqlArg));
    }

    // Habit tracking: 3+ misses demote priority; completions are counted.
    if (update.is_missed) {
      const miss = existing.miss_count + 1;
      changes.set("miss_count", miss);
      const prio = update.priority ?? existing.priority;
      if (miss >= 3 && prio === "high") changes.set("priority", "medium");
      else if (miss >= 3 && prio === "medium") changes.set("priority", "low");
    }
    if (update.is_completed) changes.set("complete_count", existing.complete_count + 1);

    if (changes.size) {
      const cols = [...changes.keys()].map((k) => `${k} = ?`).join(", ");
      await run(`UPDATE tasks SET ${cols} WHERE id = ?`, [...changes.values(), id]);
    }
    let task = (await getTask(id))!;

    // Changing the repeat rule replaces the rest of the series.
    if (update.repeat && task.repeat_group_id) {
      await run("DELETE FROM tasks WHERE repeat_group_id = ? AND id != ?", [task.repeat_group_id, id]);
    }
    if (update.repeat?.enabled && update.repeat.days.length) {
      await insertCopies(task, id);
      task = (await getTask(id))!;
    }
    return task;
  });

  app.delete<{ Params: { groupId: string }; Querystring: { from_day?: string } }>(
    "/group/:groupId",
    async (req, reply) => {
      const fromDay = Number(req.query.from_day ?? 0);
      const res = await run("DELETE FROM tasks WHERE repeat_group_id = ? AND day >= ?", [
        req.params.groupId,
        fromDay,
      ]);
      if (res.rowsAffected === 0) {
        return reply.code(404).send({ detail: "No matching recurring tasks found" });
      }
      return { detail: `Deleted ${res.rowsAffected} occurrence(s) from day ${fromDay} onwards` };
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const res = await run("DELETE FROM tasks WHERE id = ?", [Number(req.params.id)]);
    if (res.rowsAffected === 0) return reply.code(404).send({ detail: "Task not found" });
    return { detail: "deleted" };
  });
}
