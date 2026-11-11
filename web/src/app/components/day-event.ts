import { CdkDrag, type CdkDragEnd } from "@angular/cdk/drag-drop";
import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { HOUR_PX } from "../constants";
import type { CalEvent } from "../models";
import { deriveBadge, fmtH, getColor } from "../utils";

const GAP = 3;

/** A draggable event block inside a day column. Dragging is vertical only. */
@Component({
  selector: "app-day-event",
  imports: [CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="cal-event"
      cdkDrag
      cdkDragLockAxis="y"
      (cdkDragStarted)="dragging = true"
      (cdkDragEnded)="onDragEnd($event)"
      (click)="onClick()"
      [style.top.px]="ev().startH * hourPx"
      [style.height.px]="heightPx()"
      [style.width]="widthCss()"
      [style.left]="leftCss()"
      [style.z-index]="colIndex() + 2"
      [style.background]="color().bg"
      [style.border-left]="'2px solid ' + color().border"
      [style.color]="color().text"
      style="border-top:1px solid rgba(255,255,255,0.06);cursor:pointer"
    >
      <div class="cal-event-title">{{ ev().title }}</div>
      @if (!compact()) {
        <div class="cal-event-time">{{ fmt(ev().startH) }} – {{ fmt(ev().startH + ev().durH) }}</div>
        @if (windDown()) {
          <div class="winddown-badge">Wind down by {{ fmt(bedtimeH()) }}</div>
        } @else if (badge()) {
          <div class="sleep-badge">{{ badge() }}</div>
        }
      }
    </div>
  `,
})
export class DayEvent {
  readonly ev = input.required<CalEvent>();
  readonly colIndex = input.required<number>();
  readonly totalCols = input.required<number>();
  readonly bedtimeH = input.required<number>();

  readonly clicked = output<CalEvent>();
  /** how far the event was dragged, in hours (unsnapped) */
  readonly moved = output<{ ev: CalEvent; deltaH: number }>();

  protected readonly hourPx = HOUR_PX;
  protected readonly fmt = fmtH;
  protected dragging = false;

  protected readonly color = computed(() => getColor(this.ev().color));
  protected readonly heightPx = computed(() => Math.max(this.ev().durH * HOUR_PX - 3, 26));
  protected readonly compact = computed(() => this.heightPx() < 48);
  protected readonly badge = computed(() => deriveBadge(this.ev().priority, this.ev().taskType));
  protected readonly windDown = computed(() => {
    const e = this.ev();
    const b = this.bedtimeH();
    return b > 0 && e.startH < b && e.startH + e.durH > b;
  });
  protected readonly widthCss = computed(() =>
    this.totalCols() > 1 ? `calc(${100 / this.totalCols()}% - ${GAP}px)` : "calc(100% - 4px)",
  );
  protected readonly leftCss = computed(() =>
    this.totalCols() > 1
      ? `calc(${(this.colIndex() / this.totalCols()) * 100}% + ${this.colIndex() * (GAP / this.totalCols())}px)`
      : "2px",
  );

  protected onDragEnd(e: CdkDragEnd): void {
    const { y } = e.source.getFreeDragPosition();
    e.source.reset(); // the new top comes from the updated event; drop the transform
    this.moved.emit({ ev: this.ev(), deltaH: y / HOUR_PX });
    // swallow the click that follows the pointer-up of a drag
    setTimeout(() => (this.dragging = false));
  }

  protected onClick(): void {
    if (!this.dragging) this.clicked.emit(this.ev());
  }
}
