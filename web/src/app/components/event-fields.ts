import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import type { Priority, RepeatConfig, TaskType } from "@shared";
import { DOW, EVENT_COLORS, PRIORITY_LABELS, TASK_TYPE_LABELS } from "../constants";
import type { EventDraft } from "../models";
import { dateToIso, hToInput, inputToH, isoToOffset, offsetToIso } from "../utils";

/** The form body shared by the add-event and edit-event modals (including the repeat picker). */
@Component({
  selector: "app-event-fields",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: contents" },
  template: `
    <label class="modal-label">Title</label>
    <input class="modal-input" placeholder="Event title..."
      [value]="form().title" (input)="patch.emit({ title: val($event) })" />

    <label class="modal-label">Date</label>
    <input class="modal-input" type="date" style="color-scheme:dark"
      [value]="dateIso()" [min]="todayIso"
      (change)="patch.emit({ day: toOffset(val($event)) })" />

    <label class="modal-label">Location</label>
    <input class="modal-input" placeholder="Add location..."
      [value]="form().location" (input)="patch.emit({ location: val($event) })" />

    <label class="modal-label">Description</label>
    <textarea class="modal-textarea" placeholder="Add description..." rows="4"
      [value]="form().description" (input)="patch.emit({ description: val($event) })"></textarea>

    <div class="modal-row">
      <div class="modal-col">
        <label class="modal-label">Start time</label>
        <input class="modal-input" type="time"
          [value]="toInput(form().startH)" (change)="patch.emit({ startH: fromInput(val($event)) })" />
      </div>
      <div class="modal-col">
        <label class="modal-label">End time</label>
        <input class="modal-input" type="time"
          [value]="toInput(endH())" (change)="setEnd(val($event))" />
      </div>
    </div>
    <div class="modal-duration-hint">{{ durationLabel() }}</div>

    <div class="modal-row">
      <div class="modal-col">
        <label class="modal-label">Priority</label>
        <div class="pill-group">
          @for (p of priorities; track p) {
            <button class="pill-btn" [class.pill-active]="form().priority === p" [attr.data-priority]="p"
              (click)="patch.emit({ priority: p })">{{ priorityLabels[p] }}</button>
          }
        </div>
      </div>
      <div class="modal-col">
        <label class="modal-label">Task type</label>
        <div class="pill-group">
          @for (t of taskTypes; track t) {
            <button class="pill-btn" [class.pill-active]="form().taskType === t"
              (click)="patch.emit({ taskType: t })">{{ taskTypeLabels[t] }}</button>
          }
        </div>
      </div>
    </div>

    <!-- repeat picker -->
    <div class="repeat-section">
      <div class="repeat-toggle-row">
        <label class="repeat-label">Repeat</label>
        <label class="toggle-switch">
          <input type="checkbox" [checked]="form().repeat.enabled"
            (change)="setRepeat({ enabled: checked($event) })" />
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
      @if (form().repeat.enabled) {
        <div class="repeat-days">
          @for (d of dow; track $index) {
            <button class="dow-btn" [class.active]="form().repeat.days.includes($index)"
              (click)="toggleDay($index)">{{ d }}</button>
          }
        </div>
        <div style="margin-top:8px">
          <label class="modal-label">Repeat until</label>
          <input class="modal-input" type="date" style="color-scheme:dark;margin-top:4px"
            [value]="form().repeat.end_date ?? ''" [min]="todayIso"
            (change)="setRepeat({ end_date: val($event) || null })" />
        </div>
      }
    </div>

    <label class="modal-label">Color</label>
    <div class="color-picker-row">
      @for (c of colors; track c.id) {
        <button class="color-swatch" [class.selected]="form().color === c.id"
          [style.background]="c.bg" [style.border-color]="c.border"
          (click)="patch.emit({ color: c.id })">
          @if (form().color === c.id) {
            <span class="color-swatch-check" [style.color]="c.text">✓</span>
          }
        </button>
      }
    </div>
  `,
})
export class EventFields {
  readonly form = input.required<EventDraft>();
  readonly patch = output<Partial<EventDraft>>();

  protected readonly priorities: Priority[] = ["high", "medium", "low"];
  protected readonly taskTypes: TaskType[] = ["fixed", "flexible", "free"];
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly taskTypeLabels = TASK_TYPE_LABELS;
  protected readonly colors = EVENT_COLORS;
  protected readonly dow = DOW;
  protected readonly todayIso = dateToIso(new Date());
  protected readonly toInput = hToInput;
  protected readonly fromInput = inputToH;
  protected readonly toOffset = isoToOffset;

  protected readonly dateIso = computed(() => offsetToIso(this.form().day));
  protected readonly endH = computed(() => this.form().startH + this.form().durH);
  protected readonly durationLabel = computed(() => {
    const d = this.form().durH;
    const m = Math.round((d % 1) * 60);
    return `Duration: ${Math.floor(d)}h ${m > 0 ? `${m}m` : ""}`;
  });

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected setEnd(value: string): void {
    this.patch.emit({ durH: Math.max(0.25, inputToH(value) - this.form().startH) });
  }

  protected setRepeat(change: Partial<RepeatConfig>): void {
    this.patch.emit({ repeat: { ...this.form().repeat, ...change } });
  }

  protected toggleDay(d: number): void {
    const { days } = this.form().repeat;
    this.setRepeat({ days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b) });
  }
}
