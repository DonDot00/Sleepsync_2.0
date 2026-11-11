import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { HOUR_PX, TOTAL_HOURS } from "../constants";
import type { CalEvent } from "../models";
import { fmtH, layoutEvents } from "../utils";
import { DayEvent } from "./day-event";

@Component({
  selector: "app-day-column",
  imports: [DayEvent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="day-col-wrap" [style.height.px]="totalPx" style="position:relative">
      @for (h of hours; track h) {
        <div style="position:absolute;left:0;right:0;pointer-events:none" [style.top.px]="h * hourPx">
          <div class="hour-bg-line"></div>
          <div class="half-bg-line"></div>
        </div>
      }

      @for (p of laid(); track p.ev.id) {
        <app-day-event
          [ev]="p.ev" [colIndex]="p.colIndex" [totalCols]="p.totalCols" [bedtimeH]="bedtimeH()"
          (clicked)="clickEvent.emit($event)"
          (moved)="moved.emit($event)"
        />
      }

      @if (bedtimeH() > 0) {
        <div class="bedtime-line" [style.top.px]="bedtimeH() * hourPx">
          <span class="bedtime-line-label">{{ fmt(bedtimeH()) }} bedtime</span>
        </div>
      }

      <!-- live "now" indicator — only passed for today's column -->
      @if (nowH() !== null) {
        <div class="now-line" style="position:absolute;left:0;right:0" [style.top.px]="nowH()! * hourPx">
          <div class="now-dot"></div>
        </div>
      }
    </div>
  `,
})
export class DayColumn {
  readonly events = input.required<CalEvent[]>();
  readonly bedtimeH = input.required<number>();
  /** current time in decimal hours, or null when this isn't today's column */
  readonly nowH = input<number | null>(null);

  readonly clickEvent = output<CalEvent>();
  readonly moved = output<{ ev: CalEvent; deltaH: number }>();

  protected readonly hourPx = HOUR_PX;
  protected readonly totalPx = TOTAL_HOURS * HOUR_PX;
  protected readonly hours = Array.from({ length: TOTAL_HOURS }, (_, h) => h);
  protected readonly fmt = fmtH;
  protected readonly laid = computed(() => layoutEvents(this.events()));
}
