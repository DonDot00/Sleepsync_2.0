import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, viewChild,
} from "@angular/core";
import type { SleepOut } from "@shared";
import { ApiService } from "./api.service";
import { AddEventModal } from "./components/add-event-modal";
import { AiChat } from "./components/ai-chat";
import { DayColumn } from "./components/day-column";
import { EnergySlider } from "./components/energy-slider";
import { EventModal } from "./components/event-modal";
import { MonthCalendar } from "./components/month-calendar";
import { SleepHealth } from "./components/sleep-health";
import { HOUR_PX, TOTAL_HOURS } from "./constants";
import type { CalEvent, EventDraft } from "./models";
import { calcSleepHours, dateToDayOffset, dateToIso, dayLabel, inputToH, offsetToDate, randomTip, snap } from "./utils";

const hoursNow = (): number => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

@Component({
  selector: "app-root",
  imports: [MonthCalendar, EnergySlider, SleepHealth, AiChat, DayColumn, EventModal, AddEventModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app.html",
})
export class App {
  private readonly api = inject(ApiService);

  protected readonly events = signal<CalEvent[]>([]);
  protected readonly modalEv = signal<CalEvent | null>(null); // event open in the edit modal
  protected readonly showAdd = signal(false);
  protected readonly selectedDate = signal(new Date());
  protected readonly energy = signal(3); // 1–5: how energetic the user feels today
  protected readonly showEnergyWarning = signal(true);
  protected readonly tip = randomTip();
  protected readonly showTip = signal(true);
  protected readonly bedtime = signal("23:00");
  protected readonly waketime = signal("06:40");
  protected readonly numDays = signal(2);
  protected readonly sleepRecord = signal<SleepOut | null>(null);
  protected readonly nowH = signal(hoursNow());

  protected readonly hourPx = HOUR_PX;
  protected readonly hourLabels = Array.from({ length: TOTAL_HOURS }, (_, h) =>
    h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`,
  );
  protected readonly today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  protected readonly dayLabel = dayLabel;

  private readonly scrollArea = viewChild<ElementRef<HTMLElement>>("scrollArea");
  private readonly centerPanel = viewChild<ElementRef<HTMLElement>>("centerPanel");

  protected readonly bedtimeH = computed(() => inputToH(this.bedtime()));
  protected readonly selectedOffset = computed(() => dateToDayOffset(this.selectedDate()));
  protected readonly selectedLabel = computed(() =>
    this.selectedOffset() === 0
      ? "Today"
      : this.selectedDate().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
  );
  protected readonly eventDays = computed(() => [...new Set(this.events().map((e) => dateToIso(offsetToDate(e.day))))]);
  protected readonly sleepScore = computed(() =>
    Math.min(100, Math.round((calcSleepHours(this.bedtime(), "06:40") / 8) * 100)),
  );

  /** first column = selected date, second (if there's room) = the day after */
  protected readonly dayCols = computed(() => {
    const start = this.selectedOffset();
    const offsets = this.numDays() === 2 ? [start, start + 1] : [start];
    return offsets.map((offset, i) => ({
      offset,
      title: `${i === 0 ? (start === 0 ? "Today" : "Selected") : "Next day"} — ${dayLabel(offset)}`,
      evs: this.events().filter((e) => e.day === offset),
    }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.refreshEvents();
    this.api.fetchLatestSleep().then((r) => this.sleepRecord.set(r)).catch(() => {});

    // move the "now" line every minute
    const timer = setInterval(() => this.nowH.set(hoursNow()), 60_000);
    destroyRef.onDestroy(() => clearInterval(timer));

    afterNextRender(() => {
      // scroll the calendar to the current hour
      const el = this.scrollArea()?.nativeElement;
      if (el) el.scrollTop = Math.max(0, hoursNow() * HOUR_PX - 120);

      // 1 or 2 day columns depending on the width of the center panel
      const center = this.centerPanel()?.nativeElement;
      if (center) {
        const ro = new ResizeObserver((entries) => this.numDays.set(entries[0]!.contentRect.width >= 580 ? 2 : 1));
        ro.observe(center);
        destroyRef.onDestroy(() => ro.disconnect());
      }
    });

    // re-show the energy warning whenever the slider moves
    effect(() => {
      this.energy();
      this.showEnergyWarning.set(true);
    });
  }

  /** re-fetch everything — after the AI or a recurring series adds rows */
  protected refreshEvents(): void {
    this.api.fetchTasks().then((e) => this.events.set(e)).catch(() => {});
  }

  /** optimistic move, then sync the new start time */
  protected async onMoved({ ev, deltaH }: { ev: CalEvent; deltaH: number }): Promise<void> {
    const startH = Math.max(0, Math.min(TOTAL_HOURS - ev.durH, snap(ev.startH + deltaH)));
    this.events.update((all) => all.map((e) => (e.id === ev.id ? { ...e, startH } : e)));
    try {
      await this.api.updateTask(ev.id, { start_h: startH });
    } catch {
      /* keep the optimistic position */
    }
  }

  protected async onSave(u: CalEvent): Promise<void> {
    try {
      const saved = await this.api.updateTask(u.id, {
        title: u.title, color: u.color, start_h: u.startH, dur_h: u.durH, day: u.day,
        location: u.location, description: u.description, priority: u.priority, task_type: u.taskType,
        fixed_time: u.fixed_time || null, repeat: u.repeat,
      });
      // changing the repeat rule rewrites the series, so reload everything
      this.events.update((all) => all.map((e) => (e.id === saved.id ? saved : e)));
      this.refreshEvents();
    } catch {
      this.events.update((all) => all.map((e) => (e.id === u.id ? u : e)));
    }
    this.modalEv.set(null);
  }

  protected async onDelete(id: number): Promise<void> {
    try {
      await this.api.deleteTask(id);
    } catch {
      /* removed locally regardless */
    }
    this.events.update((all) => all.filter((e) => e.id !== id));
    this.modalEv.set(null);
  }

  /** cancel a recurring series — all=true removes everything, false removes this and future */
  protected async onCancelSeries({ ev, all }: { ev: CalEvent; all: boolean }): Promise<void> {
    if (!ev.repeatGroupId) return this.onDelete(ev.id);
    try {
      await this.api.deleteRecurringGroup(ev.repeatGroupId, all ? 0 : ev.day);
    } catch {
      /* refresh below shows the truth */
    }
    this.modalEv.set(null);
    this.refreshEvents();
  }

  /** the backend expands repeat rows, so refresh to see the copies */
  protected async onAdd(draft: EventDraft): Promise<void> {
    try {
      await this.api.createTask(draft);
      this.refreshEvents();
    } catch {
      alert("Failed to save event — is the backend running?");
    }
  }
}
