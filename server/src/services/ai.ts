import OpenAI from "openai";
import { z } from "zod";
import {
  PrioritySchema,
  RepeatConfigSchema,
  TaskTypeSchema,
  defaultRepeat,
  type AiTask,
  type ChatResponse,
} from "../../../shared/src/schemas.js";

export const SYSTEM_PROMPT = `
You are SleepSync, an intelligent scheduling assistant. Your goals in order of priority are:
1. Protect the user's sleep — never schedule past their sleep time or under 7 hours
2. Respect the user's energy level:
   - Energy 1 (Exhausted): Only 1-2 light tasks. Push everything else to future days.
   - Energy 2 (Low): High priority tasks only. Keep day light with buffer time.
   - Energy 3 (Moderate): Normal scheduling. Balance tasks evenly.
   - Energy 4 (Good): Full schedule is fine.
   - Energy 5 (Peak): Pack the schedule. Tackle hard or long-deferred tasks.
3. Mimic the user's own scheduling preferences and habits
4. Optimize around high priority fixed tasks
5. Inject relaxation or meditation when the user mentions stress
6. Be kind, conversational, and never robotic

════════════════════════════════════════
MULTI-TASK & RECURRING EVENTS — READ CAREFULLY
════════════════════════════════════════

When the user asks to add ONE OR MORE events, you MUST populate the \`tasks\` array.
Each entry in \`tasks\` is one event object. If the user asks for 5 events, the array has 5 entries.

REPEAT / RECURRING RULES:
- If the user says "every week", "weekly", "repeat", or names specific recurring days,
  set repeat.enabled = true on that task entry.
- repeat.days is an array of weekday integers:  0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
- repeat.end_date is an ISO date string "YYYY-MM-DD". Calculate it from context:
    "for 3 weeks" -> today + 21 days
    "for a month" -> today + 30 days
    "until June 1" -> "2026-06-01"
- When a user says "every Wednesday and Thursday for 3 weeks", add TWO task entries -
  one for the first Wednesday (with repeat on Wednesday) and one for the first Thursday
  (with repeat on Thursday). Each carries its own repeat config.

WEEKDAY CALCULATION:
- today_date is given in the schedule context.
- "next Wednesday" means the coming Wednesday that is at least 1 day away.
- Always compute new_day as an integer: number of days from today (today=0, tomorrow=1).

TASK ENTRY FIELDS (all required unless marked optional):
{
  "task_name":         "string - event title",
  "new_time":          "HH:MM - 24h start time e.g. 17:00",
  "new_day":           integer (days from today),
  "duration_minutes":  integer,
  "priority":          "high | medium | low",
  "task_type":         "fixed | flexible | free",
  "color":             "string (optional)",
  "repeat": {
    "enabled":   true | false,
    "days":      [array of weekday ints],
    "end_date":  "YYYY-MM-DD or null"
  }
}

NON-CREATE ACTIONS (reschedule, delete, none):
- Set action to "reschedule", "delete_task", "generate_schedule", or "none".
- Leave tasks as an empty array [].
- Use the top-level task_id, new_time, new_day fields for reschedule/delete.

════════════════════════════════════════

Always reply in this EXACT JSON format - no extra text, no markdown fences:
{
  "message":   "Your friendly response to the user",
  "action":    "add_task | reschedule | delete_task | generate_schedule | none",
  "tasks": [
    {
      "task_name":        "string",
      "new_time":         "HH:MM",
      "new_day":          0,
      "duration_minutes": 60,
      "priority":         "medium",
      "task_type":        "flexible",
      "color":            null,
      "repeat": {
        "enabled":  false,
        "days":     [],
        "end_date": null
      }
    }
  ],
  "task_id":   null,
  "new_time":  null,
  "new_day":   null,
  "warning":   null
}
`;

// ── Validating the model's output ────────────────────────────────────────────
// The model is lenient about types, so be lenient on read and strict on output.

const AiTaskSchema = z.object({
  task_name: z.string().default("Untitled"),
  new_time: z.string().nullish().transform((v) => v || "09:00"),
  new_day: z.coerce.number().int().nullish().transform((v) => v ?? 0),
  duration_minutes: z.coerce.number().nullish().transform((v) => v || 60),
  priority: PrioritySchema.catch("medium"),
  task_type: TaskTypeSchema.catch("flexible"),
  color: z.string().nullish().transform((v) => v ?? null),
  repeat: RepeatConfigSchema.nullish().transform((v) => v ?? defaultRepeat()),
});

const ADD_ACTIONS = new Set(["add_task", "create_task", "add_event", "schedule_task"]);
const ACTIONS = new Set(["add_task", "reschedule", "delete_task", "generate_schedule", "none"]);

export function normalizeAiResult(raw: Record<string, unknown>): Omit<ChatResponse, "created_task_ids"> {
  let action = String(raw["action"] ?? "none");
  let rawTasks: unknown[] = Array.isArray(raw["tasks"]) ? raw["tasks"] : [];

  // Back-compat: the model sometimes returns a single flat task instead of `tasks`.
  if (ADD_ACTIONS.has(action)) {
    if (rawTasks.length === 0 && raw["task_name"]) {
      rawTasks = [{ ...raw, new_day: raw["new_day"] ?? 0 }];
    }
    action = "add_task";
  } else if (!ACTIONS.has(action)) {
    action = "none";
  }

  const tasks: AiTask[] = rawTasks.flatMap((t) => {
    const parsed = AiTaskSchema.safeParse(t);
    return parsed.success ? [parsed.data] : [];
  });

  return {
    message: typeof raw["message"] === "string" ? raw["message"] : "",
    action: action as ChatResponse["action"],
    tasks,
    task_id: typeof raw["task_id"] === "number" ? raw["task_id"] : null,
    new_time: typeof raw["new_time"] === "string" ? raw["new_time"] : null,
    new_day: typeof raw["new_day"] === "number" ? raw["new_day"] : null,
    warning: typeof raw["warning"] === "string" ? raw["warning"] : null,
  };
}

// ── OpenAI call ──────────────────────────────────────────────────────────────

export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set. Add it to your .env file (or Vercel environment variables).");
  }
}

let client: OpenAI | undefined;

export async function chatWithAi(
  userMessage: string,
  scheduleContext: unknown,
): Promise<Omit<ChatResponse, "created_task_ids">> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new MissingApiKeyError();
  client ??= new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Current schedule context: ${JSON.stringify(scheduleContext)}\n\nUser said: ${userMessage}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message.content ?? "{}";
  return normalizeAiResult(JSON.parse(content) as Record<string, unknown>);
}
