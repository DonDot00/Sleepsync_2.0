import {
  ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, inject, input, output, signal, viewChild,
} from "@angular/core";
import { ApiService } from "../api.service";
import { INITIAL_MESSAGES } from "../constants";
import type { ChatMessage } from "../models";

@Component({
  selector: "app-ai-chat",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat-section">
      <div class="panel-title">AI assistant</div>
      <div class="chat-messages">
        @for (m of messages(); track $index) {
          <div class="msg" [class.msg-ai]="m.from === 'ai'" [class.msg-user]="m.from === 'user'">{{ m.text }}</div>
        }
        @if (loading()) {
          <div class="msg msg-ai" style="opacity:0.5">Thinking...</div>
        }
        <div #end></div>
      </div>
      <div class="chat-input-row">
        <input class="chat-input" placeholder="Ask SleepSync..." [value]="input()"
          (input)="input.set($any($event.target).value)" (keydown.enter)="send()" />
        <button class="send-btn" (click)="send()">↑</button>
      </div>
    </div>
  `,
})
export class AiChat {
  private readonly api = inject(ApiService);

  readonly energy = input.required<number>();
  readonly bedtime = input.required<string>();
  readonly waketime = input.required<string>();
  readonly eventCreated = output<void>();

  protected readonly messages = signal<ChatMessage[]>(INITIAL_MESSAGES);
  protected readonly input = signal("");
  protected readonly loading = signal(false);
  private readonly end = viewChild<ElementRef<HTMLElement>>("end");

  constructor() {
    // keep the latest message in view
    afterRenderEffect(() => {
      this.messages();
      this.loading();
      this.end()?.nativeElement.scrollIntoView({ behavior: "smooth" });
    });
  }

  private push(m: ChatMessage): void {
    this.messages.update((p) => [...p, m]);
  }

  protected async send(): Promise<void> {
    const txt = this.input().trim();
    if (!txt || this.loading()) return;
    this.push({ from: "user", text: txt });
    this.input.set("");
    this.loading.set(true);
    try {
      const res = await this.api.sendChatMessage(txt, this.waketime(), this.bedtime(), this.energy());
      this.push({ from: "ai", text: res.message });
      if (res.warning) this.push({ from: "ai", text: `⚠️ ${res.warning}` });
      if (res.action === "add_task" && res.created_task_ids.length > 0) this.eventCreated.emit();
    } catch {
      this.push({ from: "ai", text: "I'm having trouble connecting right now." });
    } finally {
      this.loading.set(false);
    }
  }
}
