import { z } from "zod";
import { defaultRepeat } from "./defaults.js";

// ── Enums ────────────────────────────────────────────────────────────────────

export const PrioritySchema = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const TaskTypeSchema = z.enum(["fixed", "flexible", "free"]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

// ── Tasks ────────────────────────────────────────────────────────────────────

export const RepeatConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** 0=Sun … 6=Sat */
  days: z.array(z.number().int().min(0).max(6)).default([]),
  /** ISO date, e.g. "2026-05-01" */
  end_date: z.string().nullable().default(null),
});
export type RepeatConfig = z.infer<typeof RepeatConfigSchema>;

export { defaultRepeat };

export const TaskCreateSchema = z.object({
  title: z.string(),
  color: z.string().default("purple"),
  start_h: z.number().default(9),
  dur_h: z.number().default(1),
  /** days from today — 0 = today */
  day: z.number().int().default(0),
  location: z.string().nullish(),
  description: z.string().nullish(),
  priority: PrioritySchema.default("medium"),
  task_type: TaskTypeSchema.default("flexible"),
  fixed_time: z.string().nullish(),
  repeat: RepeatConfigSchema.default(defaultRepeat),
  repeat_group_id: z.string().nullish(),
});
export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskCreateInput = z.input<typeof TaskCreateSchema>;

/** Partial update. `null`/missing fields are ignored (matches the old FastAPI behaviour). */
export const TaskUpdateSchema = z.object({
  title: z.string().nullish(),
  color: z.string().nullish(),
  start_h: z.number().nullish(),
  dur_h: z.number().nullish(),
  day: z.number().int().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  priority: PrioritySchema.nullish(),
  task_type: TaskTypeSchema.nullish(),
  fixed_time: z.string().nullish(),
  repeat: RepeatConfigSchema.nullish(),
  repeat_group_id: z.string().nullish(),
  is_completed: z.boolean().nullish(),
  is_missed: z.boolean().nullish(),
});
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

/** A task as returned by the API (snake_case wire format). */
export interface TaskDto {
  id: number;
  title: string;
  color: string;
  start_h: number;
  dur_h: number;
  day: number;
  location: string | null;
  description: string | null;
  priority: Priority;
  task_type: TaskType;
  fixed_time: string | null;
  repeat: RepeatConfig;
  repeat_group_id: string | null;
  is_completed: boolean;
  is_missed: boolean;
  miss_count: number;
  complete_count: number;
}

// ── Sleep ────────────────────────────────────────────────────────────────────

export const SleepInSchema = z.object({
  bedtime: z.string(),
  wake_time: z.string(),
  goal_hours: z.number(),
  total_hours: z.number(),
  score: z.number().int(),
  deep_mins: z.number().int(),
  rem_mins: z.number().int(),
  light_mins: z.number().int(),
});
export type SleepIn = z.infer<typeof SleepInSchema>;

export const AppleHealthSleepInSchema = z.object({
  bedtime: z.string(),
  wake_time: z.string(),
  total_minutes: z.number(),
  deep_minutes: z.number().default(0),
  rem_minutes: z.number().default(0),
  light_minutes: z.number().default(0),
  goal_hours: z.number().default(8),
});
export type AppleHealthSleepIn = z.infer<typeof AppleHealthSleepInSchema>;

export interface SleepOut extends SleepIn {
  id: number;
  record_date: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  message: z.string(),
  wake_time: z.string().default("07:00"),
  sleep_time: z.string().default("23:00"),
  energy_level: z.number().int().min(1).max(5).default(3),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** One event the AI wants to create. */
export interface AiTask {
  task_name: string;
  new_time: string;
  new_day: number;
  duration_minutes: number;
  priority: Priority;
  task_type: TaskType;
  color: string | null;
  repeat: RepeatConfig;
}

export type ChatAction = "add_task" | "reschedule" | "delete_task" | "generate_schedule" | "none";

export interface ChatResponse {
  message: string;
  action: ChatAction;
  tasks: AiTask[];
  task_id: number | null;
  new_time: string | null;
  new_day: number | null;
  warning: string | null;
  created_task_ids: number[];
}

// ── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  task_id: number | null;
  name: string;
  start: string;
  end: string;
  type: "fixed" | "flexible" | "sleep";
  priority: string;
}
