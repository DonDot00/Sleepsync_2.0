import type { FastifyInstance } from "fastify";
import { ChatRequestSchema, type ChatResponse } from "../../../shared/src/schemas.js";
import { query } from "../db.js";
import { localParts, timeToHours } from "../dates.js";
import { chatWithAi, MissingApiKeyError } from "../services/ai.js";
import { createTaskWithRepeats, rowToTask } from "./tasks.js";

const ENERGY_LABELS = ["Exhausted", "Low", "Moderate", "Good", "Peak"];

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", async (req, reply) => {
    const body = ChatRequestSchema.parse(req.body);

    const tasks = (await query("SELECT * FROM tasks WHERE day >= 0")).map(rowToTask);
    const sleep = (await query("SELECT * FROM sleep_records ORDER BY record_date DESC LIMIT 1"))[0];

    const scheduleContext = {
      wake_time: body.wake_time,
      sleep_time: body.sleep_time,
      energy_level: body.energy_level,
      energy_label: ENERGY_LABELS[body.energy_level - 1],
      today_date: localParts().iso,
      sleep: {
        last_score: sleep?.["score"] ?? null,
        last_hours: sleep?.["total_hours"] ?? null,
        goal_hours: sleep?.["goal_hours"] ?? 8,
        bedtime: sleep?.["bedtime"] ?? "23:00",
        wake_time: sleep?.["wake_time"] ?? "07:00",
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.task_type,
        priority: t.priority,
        fixed_time: t.fixed_time,
        start_h: t.start_h,
        dur_h: t.dur_h,
        day: t.day,
        miss_streak: t.miss_count,
      })),
    };

    let result;
    try {
      result = await chatWithAi(body.message, scheduleContext);
    } catch (err) {
      if (err instanceof MissingApiKeyError) return reply.code(503).send({ detail: err.message });
      throw err;
    }

    const created_task_ids: number[] = [];
    if (result.action === "add_task") {
      for (const t of result.tasks) {
        const created = await createTaskWithRepeats({
          title: t.task_name,
          color: t.color || "purple",
          start_h: timeToHours(t.new_time),
          dur_h: t.duration_minutes / 60,
          day: t.new_day,
          priority: t.priority,
          task_type: t.task_type,
          repeat: t.repeat,
        });
        created_task_ids.push(created.id);
      }
    }

    const response: ChatResponse = { ...result, created_task_ids };
    return response;
  });
}
