import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  defaultRepeat,
  type ChatResponse,
  type SleepIn,
  type SleepOut,
  type TaskCreateInput,
  type TaskDto,
  type TaskUpdate,
} from "@shared";
import type { CalEvent, EventDraft } from "./models";

const API = "/api";

/** wire (snake_case) → frontend (camelCase) */
export function toFrontend(t: TaskDto): CalEvent {
  return {
    id: t.id,
    title: t.title,
    color: t.color,
    startH: t.start_h,
    durH: t.dur_h,
    day: t.day,
    location: t.location ?? "",
    description: t.description ?? "",
    priority: t.priority,
    taskType: t.task_type,
    fixed_time: t.fixed_time,
    repeat: t.repeat ?? defaultRepeat(),
    repeatGroupId: t.repeat_group_id,
    is_completed: t.is_completed,
    is_missed: t.is_missed,
    miss_count: t.miss_count,
    complete_count: t.complete_count,
  };
}

/** frontend → wire */
export function toBackend(ev: EventDraft & { fixed_time?: string | null }): TaskCreateInput {
  return {
    title: ev.title,
    color: ev.color,
    start_h: ev.startH,
    dur_h: ev.durH,
    day: ev.day,
    location: ev.location || null,
    description: ev.description || null,
    priority: ev.priority,
    task_type: ev.taskType,
    fixed_time: ev.fixed_time || null,
    repeat: ev.repeat,
  };
}

@Injectable({ providedIn: "root" })
export class ApiService {
  private readonly http = inject(HttpClient);

  async fetchTasks(): Promise<CalEvent[]> {
    const data = await firstValueFrom(this.http.get<TaskDto[]>(`${API}/tasks`));
    return data.map(toFrontend);
  }

  async createTask(ev: EventDraft): Promise<CalEvent> {
    return toFrontend(await firstValueFrom(this.http.post<TaskDto>(`${API}/tasks`, toBackend(ev))));
  }

  async updateTask(id: number, changes: TaskUpdate): Promise<CalEvent> {
    return toFrontend(await firstValueFrom(this.http.patch<TaskDto>(`${API}/tasks/${id}`, changes)));
  }

  async deleteTask(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${API}/tasks/${id}`));
  }

  /** Cancel a recurring series from `fromDay` onwards (0 = the whole series). */
  async deleteRecurringGroup(groupId: string, fromDay = 0): Promise<void> {
    await firstValueFrom(this.http.delete(`${API}/tasks/group/${groupId}`, { params: { from_day: fromDay } }));
  }

  sendChatMessage(message: string, wakeTime: string, sleepTime: string, energyLevel: number): Promise<ChatResponse> {
    return firstValueFrom(
      this.http.post<ChatResponse>(`${API}/chat`, {
        message,
        wake_time: wakeTime,
        sleep_time: sleepTime,
        energy_level: energyLevel,
      }),
    );
  }

  async fetchLatestSleep(): Promise<SleepOut | null> {
    const data = await firstValueFrom(this.http.get<SleepOut[]>(`${API}/sleep/recent`));
    return data[0] ?? null;
  }

  /** Best-effort — never blocks the UI. */
  async saveSleepData(data: SleepIn): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API}/sleep`, data));
    } catch {
      /* intentionally silent */
    }
  }
}
