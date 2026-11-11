import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import { DAYS, MONTHS } from "../constants";

@Component({
  selector: "app-month-calendar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal-nav">
      <button class="cal-nav-btn" (click)="viewYear.set(viewYear() - 1)">«</button>
      <button class="cal-nav-btn" (click)="shiftMonth(-1)">‹</button>
      <span class="cal-nav-label">{{ months[viewMonth()] }} {{ viewYear() }}</span>
      <button class="cal-nav-btn" (click)="shiftMonth(1)">›</button>
      <button class="cal-nav-btn" (click)="viewYear.set(viewYear() + 1)">»</button>
    </div>

    <div class="month-grid">
      @for (d of days; track $index) {
        <div class="day-label">{{ d }}</div>
      }
      <div class="day-label-underline"></div>
      @for (b of blanks(); track $index) {
        <div class="day-cell empty"></div>
      }
      @for (c of cells(); track c.day) {
        <div
          class="day-cell"
          [class.today]="c.selected"
          [class.has-event]="c.hasEvent"
          [style.color]="c.today && !c.selected ? '#a78fff' : null"
          [style.font-weight]="c.today && !c.selected ? 600 : null"
          (click)="selectDate.emit(c.date)"
        >{{ c.day }}</div>
      }
    </div>

    <div class="mini-legend">
      <div class="legend-item"><span class="legend-dot purple"></span>Work / deadline</div>
      <div class="legend-item"><span class="legend-dot teal"></span>Exercise</div>
      <div class="legend-item"><span class="legend-dot pink"></span>Personal</div>
      <div class="legend-item"><span class="legend-dot gray"></span>Rest day</div>
    </div>
  `,
})
export class MonthCalendar {
  readonly selectedDate = input.required<Date>();
  /** ISO dates (YYYY-MM-DD) that have at least one event */
  readonly eventDays = input.required<string[]>();
  readonly selectDate = output<Date>();

  protected readonly days = DAYS;
  protected readonly months = MONTHS;

  private readonly now = new Date();
  protected readonly viewYear = signal(this.now.getFullYear());
  protected readonly viewMonth = signal(this.now.getMonth());

  protected readonly blanks = computed(() =>
    Array.from({ length: new Date(this.viewYear(), this.viewMonth(), 1).getDay() }),
  );

  protected readonly cells = computed(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const sel = this.selectedDate();
    const events = new Set(this.eventDays());
    const count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const day = i + 1;
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        day,
        date: new Date(y, m, day),
        today: y === this.now.getFullYear() && m === this.now.getMonth() && day === this.now.getDate(),
        selected: sel.getFullYear() === y && sel.getMonth() === m && sel.getDate() === day,
        hasEvent: events.has(iso),
      };
    });
  });

  protected shiftMonth(delta: 1 | -1): void {
    const next = this.viewMonth() + delta;
    if (next < 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else if (next > 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.set(next);
    }
  }
}
