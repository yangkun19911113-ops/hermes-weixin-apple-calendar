#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

function runOsascript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/osascript", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `osascript exited with ${code}`));
      }
    });
  });
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stdout.trim() || stderr.trim() || `${command} exited with ${code}`));
      }
    });
  });
}

function localStartDate(event) {
  return new Date(`${event.date}T${event.time}:00`);
}

async function scheduleWeixinReminder(event, uid) {
  const start = localStartDate(event);
  const delayMinutes = Math.ceil((start.getTime() - Date.now()) / 60000);
  if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) {
    return { ok: false, skipped: true, reason: "event_start_not_in_future" };
  }

  const scriptsDir = path.join(homedir(), ".hermes", "scripts");
  await mkdir(scriptsDir, { recursive: true });
  const safeUid = String(uid).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  const scriptName = `calendar-reminder-${safeUid}.sh`;
  const scriptPath = path.join(scriptsDir, scriptName);
  const hhmm = event.time;
  const message = `⏰ 日程提醒：${hhmm} ${event.title}${event.notes ? `\n${event.notes}` : ""}`;
  await writeFile(scriptPath, `printf '%s\\n' ${JSON.stringify(message)}\n`, { mode: 0o700 });

  const output = await runCommand("hermes", [
    "cron",
    "create",
    `${delayMinutes}m`,
    "--name",
    `日程提醒：${event.title}`,
    "--deliver",
    "weixin",
    "--no-agent",
    "--script",
    scriptName,
    "--repeat",
    "1"
  ]);
  const jobId = output.match(/Created job:\s*([A-Za-z0-9_-]+)/)?.[1] || "";
  return { ok: true, job_id: jobId, delay_minutes: delayMinutes, script: scriptName };
}

async function listCalendars() {
  const output = await runCommand("swift", ["scripts/eventkit-bridge.swift", "calendars"]);
  process.stdout.write(`${output}\n`);
}

async function listEvents(calendar, date) {
  const args = ["scripts/eventkit-bridge.swift", "events", "--date", date];
  if (calendar) args.push("--calendar", calendar);
  const output = await runCommand("swift", args);
  process.stdout.write(`${output}\n`);
}

async function createEventRecord(event) {
  const created = JSON.parse(await runCommand("swift", ["scripts/eventkit-bridge.swift", "create", "--json", JSON.stringify(event)]));
  if (!created.ok) {
    throw new Error(JSON.stringify(created));
  }
  const uid = created.uid;
  const weixinReminder = await scheduleWeixinReminder(event, uid);
  return { ok: true, uid, calendar: created.calendar, sync_capable: true, weixin_reminder: weixinReminder };
}

async function createEvent(event) {
  try {
    printJson(await createEventRecord(event));
  } catch (error) {
    try {
      printJson(JSON.parse(error.message));
    } catch {
      printJson({ ok: false, error: error.message });
    }
    process.exit(1);
  }
}

async function createMany(events) {
  const created = [];
  try {
    for (const event of events) {
      const result = await createEventRecord(event);
      created.push({ title: event.title, date: event.date, time: event.time, ...result });
    }
  } catch (error) {
    try {
      printJson(JSON.parse(error.message));
    } catch {
      printJson({ ok: false, error: error.message });
    }
    process.exit(1);
  }
  printJson({ ok: true, created });
}

function usage() {
  printJson({
    commands: [
      "calendars",
      "events --calendar 日历 --date 2026-08-25",
      "create --json '{...}'",
      "create-many --json '[...]'"
    ]
  });
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

try {
  const command = process.argv[2];
  if (command === "calendars") {
    await listCalendars();
  } else if (command === "events") {
    await listEvents(valueAfter("--calendar"), valueAfter("--date"));
  } else if (command === "create") {
    await createEvent(JSON.parse(valueAfter("--json")));
  } else if (command === "create-many") {
    await createMany(JSON.parse(valueAfter("--json")));
  } else {
    usage();
  }
} catch (error) {
  printJson({ ok: false, error: error.message });
  process.exit(1);
}
