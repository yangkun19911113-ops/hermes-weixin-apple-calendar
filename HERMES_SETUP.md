# Hermes Apple Calendar Time Manager

This package turns the local schedule board into a Hermes skill.

## What You Need To Provide

1. Install Hermes Agent if `hermes` is not available.
2. Finish Hermes model login or API provider setup.
3. Grant macOS Calendar permission when prompted.
4. Tell Hermes which Apple Calendar to write to, for example `日历`.

## Install Hermes

Official macOS/Linux CLI install:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.zshrc
hermes doctor
hermes setup
```

Hermes Desktop can also be installed from the official website if you want the GUI.

## Install This Skill

From this project:

```bash
bash scripts/install-hermes-skill.sh
```

## Test Calendar Bridge

```bash
node scripts/calendar-bridge.mjs calendars
node scripts/calendar-bridge.mjs create --json '{"calendar":"日历","title":"Hermes 测试事件","notes":"创建后可手动删除","date":"2026-08-25","time":"15:00","duration":30}'
```

## Start Board

```bash
npm start
```

Open:

```text
http://127.0.0.1:42725
```

## Hermes Prompt

```text
/apple-calendar-time-manager
请读取我的苹果日历空档，把明天的任务排成时间块。先给我确认表，不要直接写入日历。
任务：
1. 门店团购资料复盘 60分钟
2. 直播选题整理 90分钟
3. 客户跟进 30分钟
4. 晚上做当天复盘 30分钟
```
