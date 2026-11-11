import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { generateSchedule } from "../services/schedule-engine.js";
import { rowToTask } from "./tasks.js";

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { wake_time?: string; sleep_time?: string } }>("/generate", async (req) => {
    const { wake_time = "07:00", sleep_time = "23:00" } = req.query;
    const tasks = (await query("SELECT * FROM tasks")).map(rowToTask);
    return { schedule: generateSchedule(tasks, wake_time, sleep_time) };
  });
}
