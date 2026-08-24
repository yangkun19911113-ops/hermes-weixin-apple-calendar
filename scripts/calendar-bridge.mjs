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
        reject(new Error(stderr.trim() || `${command} exited with ${code}`));
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
  const script = `
tell application "Calendar"
  set calendarNames to {}
  repeat with c in calendars
    set end of calendarNames to name of c
  end repeat
  set AppleScript's text item delimiters to linefeed
  return calendarNames as text
end tell`;
  const output = await runOsascript(["-e", script]);
  printJson({ calendars: output.split("\n").map((name) => name.trim()).filter(Boolean) });
}

async function listEvents(calendar, date) {
  const script = `
on run argv
  set calName to item 1 of argv
  set yyyy to item 2 of argv as integer
  set mm to item 3 of argv as integer
  set dd to item 4 of argv as integer
  set dayStart to current date
  set year of dayStart to yyyy
  set month of dayStart to mm
  set day of dayStart to dd
  set hours of dayStart to 0
  set minutes of dayStart to 0
  set seconds of dayStart to 0
  set dayEnd to dayStart + (24 * hours)
  set rows to {}
  tell application "Calendar"
    set targetCalendar to first calendar whose name is calName
    repeat with e in (events of targetCalendar whose start date is greater than or equal to dayStart and start date is less than dayEnd)
      set end of rows to (summary of e & "||" & (start date of e as string) & "||" & (end date of e as string) & "||" & uid of e)
    end repeat
  end tell
  set AppleScript's text item delimiters to linefeed
  return rows as text
end run`;
  const [year, month, day] = date.split("-").map(Number);
  const output = await runOsascript(["-e", script, calendar, String(year), String(month), String(day)]);
  const events = output
    .split("\n")
    .filter(Boolean)
    .map((row) => {
      const [title, start, end, uid] = row.split("||");
      return { title, start, end, uid };
    });
  printJson({ calendar, date, events });
}

async function createEvent(event) {
  const script = `
on run argv
  set calName to item 1 of argv
  set eventTitle to item 2 of argv
  set eventNotes to item 3 of argv
  set yyyy to item 4 of argv as integer
  set mm to item 5 of argv as integer
  set dd to item 6 of argv as integer
  set hh to item 7 of argv as integer
  set mi to item 8 of argv as integer
  set durationMinutes to item 9 of argv as integer

  set startDate to current date
  set year of startDate to yyyy
  set month of startDate to mm
  set day of startDate to dd
  set hours of startDate to hh
  set minutes of startDate to mi
  set seconds of startDate to 0
  set endDate to startDate + (durationMinutes * minutes)

  tell application "Calendar"
    set targetCalendar to first calendar whose name is calName
    set newEvent to make new event at end of events of targetCalendar with properties {summary:eventTitle, start date:startDate, end date:endDate, description:eventNotes}
    make new display alarm at end of display alarms of newEvent with properties {trigger interval:0}
    return uid of newEvent
  end tell
end run`;

  const [year, month, day] = event.date.split("-").map(Number);
  const [hour, minute] = event.time.split(":").map(Number);
  const uid = await runOsascript([
    "-e",
    script,
    event.calendar,
    event.title,
    event.notes || "",
    String(year),
    String(month),
    String(day),
    String(hour),
    String(minute),
    String(event.duration || 60)
  ]);
  const weixinReminder = await scheduleWeixinReminder(event, uid);
  printJson({ ok: true, uid, weixin_reminder: weixinReminder });
}

async function createMany(events) {
  const created = [];
  for (const event of events) {
    const [year, month, day] = event.date.split("-").map(Number);
    const [hour, minute] = event.time.split(":").map(Number);
    const script = `
on run argv
  set calName to item 1 of argv
  set eventTitle to item 2 of argv
  set eventNotes to item 3 of argv
  set yyyy to item 4 of argv as integer
  set mm to item 5 of argv as integer
  set dd to item 6 of argv as integer
  set hh to item 7 of argv as integer
  set mi to item 8 of argv as integer
  set durationMinutes to item 9 of argv as integer
  set startDate to current date
  set year of startDate to yyyy
  set month of startDate to mm
  set day of startDate to dd
  set hours of startDate to hh
  set minutes of startDate to mi
  set seconds of startDate to 0
  set endDate to startDate + (durationMinutes * minutes)
  tell application "Calendar"
    set targetCalendar to first calendar whose name is calName
    set newEvent to make new event at end of events of targetCalendar with properties {summary:eventTitle, start date:startDate, end date:endDate, description:eventNotes}
    make new display alarm at end of display alarms of newEvent with properties {trigger interval:0}
    return uid of newEvent
  end tell
end run`;
    const uid = await runOsascript([
      "-e",
      script,
      event.calendar,
      event.title,
      event.notes || "",
      String(year),
      String(month),
      String(day),
      String(hour),
      String(minute),
      String(event.duration || 60)
    ]);
    const weixinReminder = await scheduleWeixinReminder(event, uid);
    created.push({ title: event.title, date: event.date, time: event.time, uid, weixin_reminder: weixinReminder });
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
