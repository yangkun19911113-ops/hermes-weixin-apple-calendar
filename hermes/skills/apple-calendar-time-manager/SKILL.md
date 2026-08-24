---
name: apple-calendar-time-manager
description: Plan tasks into time blocks, launch a local drag-and-drop schedule board, and write confirmed events to Apple Calendar on macOS.
version: 1.0.0
author: Local Codex
license: MIT
platforms: [macos]
tags: [calendar, time-management, apple-calendar, schedule, planning]
---

# Apple Calendar Time Manager

Use this skill when the user wants Hermes to plan a day or week, turn natural-language tasks into calendar blocks, review the schedule visually, or write confirmed events to Apple Calendar.

## Local Project

The local implementation lives in the project directory where this repository was cloned.

Primary commands:

```bash
npm start
```

The local board runs at:

`http://127.0.0.1:42725`

Calendar bridge:

```bash
node scripts/calendar-bridge.mjs calendars
node scripts/calendar-bridge.mjs events --calendar "日历" --date "2026-08-25"
node scripts/calendar-bridge.mjs create --json '{"calendar":"日历","title":"复盘","notes":"说明","date":"2026-08-25","time":"15:00","duration":60}'
node scripts/calendar-bridge.mjs create-many --json '[{"calendar":"日历","title":"复盘","notes":"说明","date":"2026-08-25","time":"15:00","duration":60}]'
```

Events created by the bridge include:

1. A default Apple Calendar display reminder at the event start time (`trigger interval: 0`).
2. A one-shot Hermes cron reminder delivered to Weixin at the event start time.

## Operating Rules

1. Read existing calendar availability before proposing a plan when the user asks for a real schedule.
2. Ask for confirmation before writing, moving, or deleting Apple Calendar events.
3. Never expose private event details unless the user explicitly asks to review them.
4. Prefer small executable blocks: title, date, time, duration, notes, expected output.
5. If the user gives vague tasks, do not give a dead-end "send me your tasks" reply. Give a useful collection card with examples, or turn any concrete phrase into a draft task and mark assumptions.
6. If the user asks for a visual schedule, start the local board and send them the local URL.
7. If Apple Calendar permission fails, tell the user to grant Calendar access in macOS Privacy & Security, then retry.
8. In Weixin/WeChat, keep replies short, action-oriented, and conversational. Avoid long explanations.
9. If the input is an empty media message or looks like a bad transcription, say so and ask the user to resend as text or a clearer voice note.
10. If the user says "明天/今天/这周", resolve it to a concrete date in the reply.

## Weixin Workflow

When the user says "帮我排明天/今天日程" but does not include a task list:

1. Still check Apple Calendar availability.
2. Reply with a short status line and a task collection card.
3. Ask for tasks in one message, using this format:

```text
我已看过 8月25日的日历：目前空档较多。
把任务按这个格式发我，我马上给你排确认表：
1. 任务名 / 预计时长 / 偏好时间 / 产出
例如：直播选题 90分钟 上午 输出10个标题

你也可以直接语音说：上午做什么、下午做什么、晚上做什么。
```

If the user sends a partial task such as "明天去看产品" or "看他们产品":

1. Treat it as a real task instead of asking from scratch.
2. Create a draft confirmation table with assumed duration and a note asking the user to confirm or correct.
3. Do not write to Apple Calendar until the user replies "确认写入" or clearly approves.

Example:

| 时间 | 任务 | 时长 | 备注 |
| --- | --- | --- | --- |
| 09:30 | 看产品/产品调研 | 90分钟 | 先按上午高精力时段排；请确认时长 |

Reply after the table:

```text
回复「确认写入」我再写进苹果日历；要改时间就直接说。
```

## Planning Format

When proposing a schedule, use this compact table:

| 时间 | 任务 | 时长 | 备注 |
| --- | --- | --- | --- |

After confirmation, convert every row into JSON for `create-many`.

Example JSON:

```json
[
  {
    "calendar": "日历",
    "title": "整理本周内容选题",
    "notes": "输出：一周内容主题与发布日期",
    "date": "2026-08-25",
    "time": "09:00",
    "duration": 60
  }
]
```

## Conflict Handling

Before writing events:

1. Check the target day with `events`.
2. If a slot is occupied, propose the nearest free alternatives.
3. Keep high-focus work in 60-120 minute blocks.
4. Keep communication and follow-up work in 30-60 minute blocks.
5. Leave buffer time around meetings and livestream operations.

## Board Workflow

To use the visual board:

1. Start `npm start` from the local project.
2. Open `http://127.0.0.1:42725`.
3. Let the user drag tasks into time blocks.
4. Use the board's write button for direct Apple Calendar sync, or write via `create-many` after confirmation.

## Acceptance Check

A completed run should have:

1. Calendar list checked.
2. Proposed blocks confirmed by user.
3. Apple Calendar write command returned `{ "ok": true }`.
4. User told which calendar and dates were changed.
5. User told that every created event includes a start-time Apple Calendar reminder and a Weixin reminder.
