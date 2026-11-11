import type { Priority, TaskType } from "@shared";
import type { ChatMessage, EventColor } from "./models";

export const HOUR_PX     = 64;
export const TOTAL_HOURS = 24;
export const DAYS        = ["S","M","T","W","T","F","S"];
export const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DOW         = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export const SLEEP_TIPS = [
  "Keep your wake-up time consistent, even on weekends.",
  "Avoid caffeine after 2pm — it has a half-life of 5–6 hours.",
  "Cool your room to 65–68°F for optimal deep sleep.",
  "Dim your lights an hour before bed to trigger melatonin.",
  "A 10–20 minute nap before 3pm restores alertness without disrupting nighttime sleep.",
  "Avoid alcohol within 3 hours of bedtime — it fragments your sleep cycles.",
  "Write a to-do list before bed to offload mental chatter.",
  "Exercise improves sleep quality, but avoid intense workouts within 2 hours of bedtime.",
  "Expose yourself to bright light within 30 minutes of waking to set your circadian clock.",
  "Keep your bedroom for sleep only — no work, no scrolling.",
  "A consistent bedtime matters more than total hours for sleep quality.",
  "REM sleep peaks in the last third of the night.",
  "Stress is the #1 cause of insomnia. A 5-minute body scan reduces cortisol.",
  "Reading a physical book before bed is one of the most effective wind-down habits.",
  "Avoid large meals within 2–3 hours of bedtime.",
  "Even one night of poor sleep reduces cognitive performance by up to 30%.",
  "Blue light from screens suppresses melatonin by up to 3 hours.",
  "If you can't sleep after 20 minutes, get up and do something calm.",
  "Journaling 3 things you're grateful for before bed reduces anxiety.",
  "Your chronotype is largely genetic — work with it, not against it.",
];

export const EVENT_COLORS: EventColor[] = [
  { id:"purple", bg:"#2a2050", border:"#7f77dd", text:"#a78fff" },
  { id:"teal",   bg:"#0d2820", border:"#1d9e75", text:"#5dcaa5" },
  { id:"pink",   bg:"#2a1020", border:"#d4537e", text:"#ed93b1" },
  { id:"gray",   bg:"#1a1828", border:"#444441", text:"#888780" },
  { id:"blue",   bg:"#0d1a30", border:"#3b82f6", text:"#60a5fa" },
  { id:"amber",  bg:"#2a1a00", border:"#d97706", text:"#fbbf24" },
  { id:"red",    bg:"#2a0a10", border:"#ef4444", text:"#f87171" },
  { id:"green",  bg:"#0a2010", border:"#22c55e", text:"#4ade80" },
];

export const PRIORITY_LABELS: Record<Priority, string> = { high:"High", medium:"Medium", low:"Low" };
export const TASK_TYPE_LABELS: Record<TaskType, string> = { fixed:"Fixed", flexible:"Flexible", free:"Free time" };

export const INITIAL_MESSAGES: ChatMessage[] = [
  { from:"ai", text:"Hey! I'm your SleepSync assistant. Ask me to add events, reschedule tasks, or get advice on your day." },
];