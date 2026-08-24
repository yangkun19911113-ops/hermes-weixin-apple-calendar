# Hermes Weixin Apple Calendar Time Manager

一个本地时间管理系统：用 Hermes 接收微信消息，读取 Apple 日历空档，生成确认表，确认后写入 Apple 日历，并在日程开始时同时触发 Apple 日历提醒和微信提醒。

## 功能

- 微信私聊触发 Hermes 时间管家
- 读取 macOS Apple Calendar 日历和某日事件
- 生成“先确认、不直接写入”的日程表
- 确认后写入 Apple 日历
- 默认添加 Apple 日历开始时提醒
- 默认创建 Hermes cron，到点通过微信提醒
- 本地拖拽排程看板：`http://127.0.0.1:42725`

## 适用环境

- macOS
- 已安装 Hermes Agent
- 已通过 Hermes 配置 Nous/OpenAI/OpenRouter 等模型 provider
- 已通过 Hermes gateway 配置 Weixin / WeChat
- Apple Calendar 已授权给 Terminal/Hermes

## 安装

```bash
git clone <your-repo-url>
cd hermes-weixin-apple-calendar
npm start
```

安装 Hermes skill：

```bash
bash scripts/install-hermes-skill.sh
```

确认 Hermes 能看到 skill：

```bash
hermes skills list --source local
```

## Hermes / 微信配置

安装 Hermes：

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.zshrc
hermes doctor --fix
```

配置模型：

```bash
hermes portal login
```

配置个人微信：

```bash
hermes gateway setup
```

选择 `Weixin / WeChat`，用微信扫码登录。建议将 DM 策略设为 allowlist 或 pairing。

启动 gateway：

```bash
hermes gateway install
hermes gateway start
```

## 使用

在微信里发：

```text
明天去看他们产品，帮我排进苹果日历，先给确认表。
```

Hermes 会先返回确认表。你回复：

```text
确认写入
```

它才会写入 Apple 日历。

## 日历桥接命令

列出日历：

```bash
node scripts/calendar-bridge.mjs calendars
```

查看某天事件：

```bash
node scripts/calendar-bridge.mjs events --calendar "日历" --date "2026-08-25"
```

创建事件：

```bash
node scripts/calendar-bridge.mjs create --json '{"calendar":"日历","title":"看产品","notes":"确认产品细节","date":"2026-08-25","time":"09:30","duration":90}'
```

创建事件时会自动：

- 写入 Apple 日历
- 添加 Apple 日历开始时弹窗提醒
- 创建一次性 Hermes cron，到点发微信提醒

## 本地看板

```bash
npm start
```

打开：

```text
http://127.0.0.1:42725
```

## 安全说明

本仓库不应包含：

- `~/.hermes/.env`
- `~/.hermes/auth.json`
- 微信 token
- Nous/OpenAI/OpenRouter API key
- Apple 日历私人数据
- `outputs/` 和 `work/` 临时文件

这些都已经通过 `.gitignore` 排除。
