import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

const LABELS = ["Exhausted", "Low", "Moderate", "Good", "Peak"];
const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

@Component({
  selector: "app-energy-slider",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="energy-panel">
      <span class="energy-title">Energy</span>
      <input
        type="range" min="1" max="5" step="1"
        class="energy-slider"
        [value]="value()"
        [style.--thumb-color]="color()"
        (input)="changed.emit(+$any($event.target).value)"
      />
      <span class="energy-label" [style.color]="color()">{{ label() }}</span>
    </div>
  `,
})
export class EnergySlider {
  readonly value = input.required<number>();
  readonly changed = output<number>();

  protected readonly label = computed(() => LABELS[this.value() - 1]);
  protected readonly color = computed(() => COLORS[this.value() - 1]);
}
