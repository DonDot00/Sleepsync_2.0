import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from "@angular/core";
import type { EventDraft } from "../models";
import { getColor, makeDefaultRepeat } from "../utils";
import { EventFields } from "./event-fields";

@Component({
  selector: "app-add-event-modal",
  imports: [EventFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header" [style.border-left]="'4px solid ' + accent()">
          <span style="flex:1;font-size:13px;font-weight:600;color:#e8e4f0">New event</span>
          <button class="modal-close" (click)="close.emit()">✕</button>
        </div>
        <div class="modal-body">
          <app-event-fields [form]="form()" (patch)="patch($event)" />
        </div>
        <div class="modal-footer">
          <button class="modal-btn-delete" (click)="close.emit()">Cancel</button>
          <button class="modal-btn-save" (click)="submit()">Add event</button>
        </div>
      </div>
    </div>
  `,
})
export class AddEventModal {
  readonly defaultDayOffset = input(0);
  readonly close = output<void>();
  readonly add = output<EventDraft>();

  protected readonly form = linkedSignal<EventDraft>(() => ({
    title: "", color: "purple", startH: 9, durH: 1, day: this.defaultDayOffset(), location: "", description: "",
    priority: "medium", taskType: "flexible", repeat: makeDefaultRepeat(),
  }));
  protected readonly accent = computed(() => getColor(this.form().color).border);

  protected patch(p: Partial<EventDraft>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected submit(): void {
    if (!this.form().title.trim()) return;
    this.add.emit(this.form());
    this.close.emit();
  }
}
