import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from "@angular/core";
import type { SleepOut } from "@shared";
import { ApiService } from "../api.service";
import { calcSleepHours, estimateStages, fmtMins } from "../utils";

const RING_R = 34;
const RING_CIRC = 2 * Math.PI * RING_R;

@Component({
  selector: "app-sleep-health",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sleep-section">
      <div class="panel-title">Sleep health</div>

      <!-- sleep score ring -->
      <div class="sleep-ring-row">
        <div class="ring-wrap" style="width:80px;height:80px">
          <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg)">
            <circle cx="40" cy="40" [attr.r]="r" fill="none" stroke="#1e1830" stroke-width="6" />
            <circle cx="40" cy="40" [attr.r]="r" fill="none" stroke="#7c3aed" stroke-width="6"
              [attr.stroke-dasharray]="circ" [attr.stroke-dashoffset]="ringOffset()" stroke-linecap="round" />
          </svg>
          <div class="ring-center" style="font-size:18px">{{ score() }}</div>
        </div>
        <div class="sleep-meta">
          <div class="sleep-meta-val" style="font-size:22px">{{ fmtMins(totalMin()) }}</div>
          <div class="sleep-meta-label">{{ hasWatch() ? 'Apple Watch · last night' : 'Estimated · last night' }}</div>
        </div>
      </div>

      <!-- Deep / REM / Light stage bars -->
      <div class="sleep-bars">
        @for (b of stageDefs(); track b.label) {
          <div class="bar-row">
            <span class="bar-label">{{ b.label }}</span>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="b.pct" [style.background]="b.color"></div>
            </div>
            <span class="bar-val">{{ fmtMins(b.mins) }}</span>
          </div>
        }
      </div>

      <!-- editable bedtime, wake time, and sleep goal chips -->
      <div class="sleep-chips">
        <div class="sleep-chip sleep-chip-editable">
          <input class="sleep-time-chip-input" type="time" [value]="bedtime()"
            (change)="bedtimeChange.emit($any($event.target).value)" />
          <div class="sleep-chip-label">Bedtime</div>
        </div>
        <div class="sleep-chip sleep-chip-editable">
          <input class="sleep-time-chip-input" type="time" [value]="waketime()"
            (change)="waketimeChange.emit($any($event.target).value)" />
          <div class="sleep-chip-label">Wake</div>
        </div>
        <div class="sleep-chip sleep-chip-editable" style="align-items:center;text-align:center">
          <div class="sleep-chip-goal-row" style="justify-content:center">
            <input class="sleep-goal-input" type="number" min="4" max="12" step="0.5" style="text-align:center"
              [value]="goalHours()" (input)="goalHours.set(+$any($event.target).value)" />
            <span class="sleep-goal-unit">h</span>
          </div>
          <div class="sleep-chip-label">Sleep goal</div>
        </div>
        <div class="sleep-chip">
          <div class="sleep-chip-val" [style.color]="avgDiff() >= 0 ? '#84cc16' : '#f87171'">
            {{ avgDiff() >= 0 ? '+' : '' }}{{ avgDiff() }}m
          </div>
          <div class="sleep-chip-label">vs avg</div>
        </div>
      </div>

      @if (showTip()) {
        <div class="tip-card">
          <div class="tip-label">Sleep tip</div>
          <div class="tip-text">{{ tip() }}</div>
          <div class="tip-actions">
            <button class="tip-btn-dontshow" (click)="dontShowTip.emit()">Don't show again</button>
            <button class="tip-btn-close" (click)="dismissTip.emit()">✕</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class SleepHealth {
  private readonly api = inject(ApiService);

  readonly showTip = input.required<boolean>();
  readonly tip = input.required<string>();
  readonly bedtime = input.required<string>();
  readonly waketime = input.required<string>();
  readonly sleepRecord = input<SleepOut | null>(null);

  readonly dismissTip = output<void>();
  readonly dontShowTip = output<void>();
  readonly bedtimeChange = output<string>();
  readonly waketimeChange = output<string>();

  protected readonly goalHours = signal(8);
  protected readonly r = RING_R;
  protected readonly circ = RING_CIRC;
  protected readonly fmtMins = fmtMins;

  // Real Apple Watch data when available, otherwise estimate from the bedtime inputs.
  protected readonly hasWatch = computed(() => this.sleepRecord()?.total_hours != null);
  protected readonly totalHours = computed(() =>
    this.hasWatch() ? this.sleepRecord()!.total_hours : calcSleepHours(this.bedtime(), this.waketime()),
  );
  protected readonly stages = computed(() => {
    const rec = this.sleepRecord();
    return this.hasWatch() && rec
      ? { deep: rec.deep_mins, rem: rec.rem_mins, light: rec.light_mins }
      : estimateStages(this.totalHours());
  });
  protected readonly totalMin = computed(() => Math.round(this.totalHours() * 60));
  protected readonly score = computed(() =>
    this.hasWatch()
      ? this.sleepRecord()!.score
      : Math.min(100, Math.round((this.totalHours() / this.goalHours()) * 100)),
  );
  protected readonly avgDiff = computed(() => Math.round((this.totalHours() - 6.47) * 60));
  protected readonly ringOffset = computed(() => RING_CIRC - (this.score() / 100) * RING_CIRC);
  protected readonly stageDefs = computed(() => {
    const s = this.stages();
    const total = this.totalMin() || 1;
    return [
      { label: "Deep", mins: s.deep, color: "#4338ca" },
      { label: "REM", mins: s.rem, color: "#7c3aed" },
      { label: "Light", mins: s.light, color: "#3b82f6" },
    ].map((b) => ({ ...b, pct: Math.round((b.mins / total) * 100) }));
  });

  constructor() {
    // Auto-save whenever bedtime, wake time or goal changes (not when a record loads).
    effect(() => {
      const bedtime = this.bedtime();
      const wake_time = this.waketime();
      const goal_hours = this.goalHours();
      untracked(() => {
        const s = this.stages();
        void this.api.saveSleepData({
          bedtime,
          wake_time,
          goal_hours,
          total_hours: this.totalHours(),
          score: this.score(),
          deep_mins: s.deep,
          rem_mins: s.rem,
          light_mins: s.light,
        });
      });
    });
  }
}
