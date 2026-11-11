import type { FastifyInstance } from "fastify";
import {
  AppleHealthSleepInSchema,
  SleepInSchema,
  type SleepOut,
} from "../../../shared/src/schemas.js";
import { query, run, type Row } from "../db.js";
import { addDays, localParts } from "../dates.js";

type SleepFields = Omit<SleepOut, "id" | "record_date">;

const toSleepOut = (r: Row): SleepOut => ({
  id: Number(r["id"]),
  record_date: String(r["record_date"]),
  bedtime: String(r["bedtime"]),
  wake_time: String(r["wake_time"]),
  goal_hours: Number(r["goal_hours"]),
  total_hours: r["total_hours"] == null ? (null as never) : Number(r["total_hours"]),
  score: r["score"] == null ? (null as never) : Number(r["score"]),
  deep_mins: r["deep_mins"] == null ? (null as never) : Number(r["deep_mins"]),
  rem_mins: r["rem_mins"] == null ? (null as never) : Number(r["rem_mins"]),
  light_mins: r["light_mins"] == null ? (null as never) : Number(r["light_mins"]),
});

/** One record per night: update it if it exists, otherwise insert. */
async function upsert(recordDate: string, p: SleepFields): Promise<SleepOut> {
  const existing = await query("SELECT id FROM sleep_records WHERE record_date = ?", [recordDate]);
  const values = [p.bedtime, p.wake_time, p.goal_hours, p.total_hours, p.score, p.deep_mins, p.rem_mins, p.light_mins];
  let id: number;
  if (existing[0]) {
    id = Number(existing[0]["id"]);
    await run(
      `UPDATE sleep_records SET bedtime=?, wake_time=?, goal_hours=?, total_hours=?, score=?,
         deep_mins=?, rem_mins=?, light_mins=? WHERE id=?`,
      [...values, id],
    );
  } else {
    const res = await run(
      `INSERT INTO sleep_records
         (bedtime, wake_time, goal_hours, total_hours, score, deep_mins, rem_mins, light_mins, record_date)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      [...values, recordDate],
    );
    id = Number(res.lastInsertRowid);
  }
  return toSleepOut((await query("SELECT * FROM sleep_records WHERE id = ?", [id]))[0]!);
}

export async function sleepRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", async (req) => upsert(localParts().iso, SleepInSchema.parse(req.body)));

  // Called by the iOS Shortcut after the morning alarm.
  app.post("/apple-health", async (req) => {
    const data = AppleHealthSleepInSchema.parse(req.body);
    const { iso, hour } = localParts();
    // Before noon the sleep happened last night; noon or later means tonight's data.
    const recordDate = hour >= 12 ? iso : addDays(iso, -1);

    const totalHours = Math.round((data.total_minutes / 60) * 100) / 100;
    return upsert(recordDate, {
      bedtime: data.bedtime,
      wake_time: data.wake_time,
      goal_hours: data.goal_hours,
      total_hours: totalHours,
      score: Math.min(100, Math.round((totalHours / data.goal_hours) * 100)),
      deep_mins: Math.round(data.deep_minutes),
      rem_mins: Math.round(data.rem_minutes),
      light_mins: Math.round(data.light_minutes),
    });
  });

  app.get("/recent", async () =>
    (await query("SELECT * FROM sleep_records ORDER BY record_date DESC LIMIT 7")).map(toSleepOut),
  );
}
