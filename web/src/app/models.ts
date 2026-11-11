import type { Priority, RepeatConfig, TaskType } from "@shared";

/** Fields the user edits in the add/edit modals. */
export interface EventDraft {
  title: string;
  color: string;
  /** start time as decimal hours, e.g. 9.5 = 9:30 */
  startH: number;
  /** duration in hours */
  durH: number;
  /** days from today — 0 = today */
  day: number;
  location: string;
  description: string;
  priority: Priority;
  taskType: TaskType;
  repeat: RepeatConfig;
}

/** A calendar event (a task, in frontend naming). */
export interface CalEvent extends EventDraft {
  id: number;
  fixed_time: string | null;
  repeatGroupId: string | null;
  is_completed: boolean;
  is_missed: boolean;
  miss_count: number;
  complete_count: number;
}

export interface EventColor {
  id: string;
  bg: string;
  border: string;
  text: string;
}

export interface ChatMessage {
  from: "ai" | "user";
  text: string;
}

export interface PositionedEvent {
  ev: CalEvent;
  colIndex: number;
  totalCols: number;
}
