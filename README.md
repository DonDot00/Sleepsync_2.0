# SleepSync

> An AI-powered scheduling assistant that optimizes your calendar around your sleep — so you perform at your best, every day.

---

## Table of Contents
- [Quick Start](#quick-start)
- [About](#about)
- [Why SleepSync?](#why-sleepsync)
- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [Team](#team)

---

## Quick Start

Requires [Node.js](https://nodejs.org) 24+.

```bash
npm install
cp .env.example .env      # then add your OPENAI_API_KEY (https://platform.openai.com/api-keys)
npm run dev               # API on :8000, app on http://localhost:4200
```

Data is stored in a local SQLite file (`server/data/sleepsync.db`) — no database setup needed.

Other commands: `npm test` (API tests), `npm run typecheck`, `npm run build`.

### Deploy to Vercel

1. Create a free [Turso](https://turso.tech) database (Vercel's filesystem is read-only, so SQLite needs a hosted home):
   `turso db create sleepsync`, then `turso db show sleepsync --url` and `turso db tokens create sleepsync`.
2. Import the repo into Vercel. `vercel.json` already configures the build.
3. Add environment variables: `OPENAI_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `APP_TIMEZONE` (e.g. `America/New_York`).

> Heads up: there is no login yet, so a public deployment lets anyone read your data and use your OpenAI key. Keep it private or add auth first.

### Apple Watch integration (optional)

```bash
npm run shortcut -- https://your-app.vercel.app
```

AirDrop the generated `SleepSync.shortcut` to your iPhone and tap **Add Shortcut**. To automate it: Shortcuts app → Automation → When my alarm stops → Run Shortcut → SleepSync.

For local use, run `npm run shortcut` with no argument (it bakes in your LAN IP) and start the API with `HOST=0.0.0.0`.

---
## About

SleepSync is an AI assistant that analyzes your schedule and helps you build positive habits around optimal sleep — tailored to you. Instead of letting the demands of daily life eat into your rest, SleepSync meticulously plans your day with your sleep health as its main priority.

Whether you're striving to meet a deadline or managing a packed week, SleepSync makes sure you're never sacrificing the sleep you need to perform at your best.

---

## Why SleepSync?

### Sleep-first scheduling matters more than you think

Most calendar apps treat sleep as an afterthought — a blank block at the end of the day. SleepSync treats it as the foundation everything else is built around.

> **The average adult needs 7–9 hours of sleep. Most get 6.5.**

That gap compounds fast. One night of poor sleep reduces cognitive performance by up to 30%. Three nights and decision-making, emotional regulation, and physical performance all decline measurably. No productivity system fixes a sleep debt.

### How SleepSync is different

| Feature | Google Calendar / Notion | SleepSync |
|---|---|---|
| Scheduling | Manual | AI-assisted |
| Sleep awareness | None | Core feature |
| Bedtime protection | None | Non-negotiable |
| Pattern learning | None | Tracks misses and habits |
| AI assistant | No | Yes — chat to reschedule |
| Wind-down reminders | No | Automatic |
| Energy-aware scheduling | No | Energy slider input |

### The science behind it

SleepSync is built around three principles from sleep research:

- **Circadian consistency** — going to bed and waking at the same time every day, even weekends, is the single highest-impact sleep habit.
- **Sleep pressure** — your body builds adenosine (sleep pressure) throughout the day. SleepSync uses this to schedule demanding tasks when you're naturally alert and lighter tasks as pressure builds.
- **REM protection** — REM sleep, the most cognitively restorative phase, is concentrated in the last third of the night. Cutting sleep short — even by 90 minutes — eliminates most of it. SleepSync treats your wake time as sacred.

---

## Features

- 🤖 **AI Assistant** — Chat naturally to plan your day, reschedule events, and get personalized sleep advice.
- 😴 **Sleep Optimization** — Suggests ideal bedtimes and wake times based on your workload and personal goals.
- 🗓 **Smart Scheduling** — AI places flexible tasks in optimal time slots based on your energy and sleep patterns.
- ⚡ **Real-time Adjustments** — Adapts your schedule on the fly when things change.
- 📊 **Sleep Health Panel** — Tracks Deep, REM, and Light sleep using estimated stage breakdowns.
- 🔁 **Repeating Events** — Set recurring tasks (e.g. class MWF at 9am) and the scheduler accounts for them automatically.
- 🌙 **Bedtime Line** — A visible bedtime line on your calendar warns you when events conflict with your set wind-down window.
- ⚡ **Energy Slider** — Tell SleepSync how you feel today and it adjusts your schedule accordingly.
- 📅 **Dual-day View** — See today and tomorrow side by side, collapsing to one column on smaller screens.
- 🔴 **Priority Tracking** — High / Medium / Low priority with automatic demotion after repeated misses.

---

## How It Works

```
1. Input your sleep goals
   └── Set your bedtime, wake time, and sleep goal (e.g. 8h)

2. Add your tasks and events
   └── Fixed tasks (class at 9am), flexible tasks (study session),
       and free-time blocks — with priority and repeat settings

3. The AI optimizes your day
   └── Fills your schedule around sleep, respects fixed commitments,
       and places flexible tasks in your best focus windows

4. Adjust on the fly
   └── Chat with the assistant: "I'm tired today" or "move my run to 6am"
       and it reschedules intelligently without touching your sleep block

5. Track patterns over time
   └── Missed a task 3 times? The AI notices and adapts your schedule.
       Consistently completing your morning workout? It gets locked in earlier.
```

---

### Data flow for a chat message

```
User types "I'm stressed, move my workout to later"
    ↓
Frontend sends POST /api/chat { message, wake_time, sleep_time, energy_level }
    ↓
Backend fetches all tasks from DB
    ↓
Builds schedule_context dict (tasks + times)
    ↓
Sends context + message to OpenAI
    ↓
OpenAI returns { message, action, task_name, new_time, warning }
    ↓
Backend returns JSON to frontend
    ↓
Frontend displays AI message + optionally refreshes calendar
```

---

## Tech Stack

| Layer      | Technology              | Why                                       |
|------------|-------------------------|-------------------------------------------|
| Frontend   | Angular, TypeScript     | Signals, standalone components            |
| Styling    | Plain CSS + Rubik/Syne  | Custom dark theme, no framework overhead  |
| Backend    | Node + Fastify (TypeScript) | Same language and types as the frontend |
| Database   | SQLite via libSQL / Turso | Local file in dev, hosted on Vercel     |
| AI         | OpenAI GPT-4o-mini      | Fast, cheap, structured JSON output       |
| Drag/Drop  | Angular CDK             | Vertical drag-to-reschedule               |
| Hosting    | Vercel                  | Static frontend + serverless API          |
| Validation | Zod                     | One schema shared by API and frontend     |

---

## Roadmap

This hackathon project covers the core scheduling loop. Here is where SleepSync may go next:

### Near term
- [ ] User accounts and authentication.
- [x] Persistent sleep history applied across sessions.
- [ ] Weekly comprehensive sleep report with data such as most missed tasks, goal hit rate, sleep stats.
- [ ] Streak tracking (Duolingo-style) for consistent habits

### Medium term
- [ ] Google Calendar and Outlook sync to pull existing events automatically and fit them into SleepSync.
- [x] Wearable integration — Apple Watch sleep data (deep, REM, light) via iOS Shortcuts.
- [ ] Burnout detection which flags when sleep debt accumulates over multiple days.
- [ ] Mood journal — one-word daily check-in, correlated with sleep score and energy level over time.

### Long term
- [ ] Team scheduling to find shared availability with others without anyone sacrificing sleep.
- [ ] Multi-timezone support for distributed teams.
- [ ] Native iOS and Android apps.
- [ ] Integration with academic calendars (Canvas, Blackboard) for student scheduling

---

## Team

**Started with C4's, Celsius, Aulani's and not enough sleep at HackHound — Loyola Maryland, 4/11/2026 to 4/12/2026**

| Name             | Role                |
|------------------|---------------------|
| Donovan Raymond  | Back End Developer  |
| Rasheed Mustapha | Front End Developer |

- [⬆️ Back to Top](#sleepsync)
