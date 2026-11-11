import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from "@angular/core";
import type { CalEvent } from "../models";
import { getColor, makeDefaultRepeat } from "../utils";
import { EventFields } from "./event-fields";

@Component({
  selector: "app-event-modal",
  imports: [EventFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .menu-item {
      display: block; width: 100%; text-align: left; padding: 10px 14px;
      background: none; border: none; color: #c4b8e8; font-size: 12px; cursor: pointer;
    }
    .menu-item:hover { background: #1a1530; }
    .menu-item.danger { color: #f87171; }
  `,
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header" [style.border-left]="'4px solid ' + accent()">
          <span style="flex:1;font-size:13px;font-weight:600;color:#e8e4f0">{{ form().title || 'Event' }}</span>
          <button class="modal-close" (click)="close.emit()">✕</button>
        </div>

        <div class="modal-body">
          <app-event-fields [form]="form()" (patch)="patch($event)" />
        </div>

        <div class="modal-footer">
          <div style="position:relative">
            @if (ev().repeatGroupId) {
              <button class="modal-btn-delete" (click)="menuOpen.set(!menuOpen())">Delete ▾</button>
              @if (menuOpen()) {
                <div style="position:absolute;bottom:calc(100% + 6px);left:0;background:#0d0c1a;border:0.5px solid #2a2448;border-radius:8px;overflow:hidden;min-width:210px;z-index:300;box-shadow:0 8px 32px rgba(0,0,0,0.6)">
                  <button class="menu-item" (click)="remove.emit(ev().id); close.emit()">Delete this event only</button>
                  <button class="menu-item" (click)="cancelSeries.emit({ ev: ev(), all: false }); close.emit()">Cancel this &amp; future events</button>
                  <button class="menu-item danger" (click)="cancelSeries.emit({ ev: ev(), all: true }); close.emit()">Cancel all events in series</button>
                </div>
              }
            } @else {
              <button class="modal-btn-delete" (click)="remove.emit(ev().id)">Delete</button>
            }
          </div>
          <button class="modal-btn-save" (click)="save.emit(form())">Save</button>
        </div>
      </div>
    </div>
  `,
})
export class EventModal {
  readonly ev = input.required<CalEvent>();
  readonly close = output<void>();
  readonly save = output<CalEvent>();
  readonly remove = output<number>();
  readonly cancelSeries = output<{ ev: CalEvent; all: boolean }>();

  protected readonly menuOpen = signal(false);
  /** editable copy of the event; resets if a different event is passed in */
  protected readonly form = linkedSignal<CalEvent>(() => {
    const e = this.ev();
    return { ...e, priority: e.priority || "medium", taskType: e.taskType || "flexible", repeat: e.repeat || makeDefaultRepeat() };
  });
  protected readonly accent = computed(() => getColor(this.form().color).border);

  protected patch(p: Partial<CalEvent>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }
}
