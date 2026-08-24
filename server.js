import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 42725);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

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

async function scheduleWeixinReminder(event, uid) {
  const start = new Date(`${event.date}T${event.time}:00`);
  const delayMinutes = Math.ceil((start.getTime() - Date.now()) / 60000);
  if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) {
    return { ok: false, skipped: true, reason: "event_start_not_in_future" };
  }

  const scriptsDir = path.join(homedir(), ".hermes", "scripts");
  await mkdir(scriptsDir, { recursive: true });
  const safeUid = String(uid).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  const scriptName = `calendar-reminder-${safeUid}.sh`;
  const scriptPath = path.join(scriptsDir, scriptName);
  const message = `⏰ 日程提醒：${event.time} ${event.title}${event.notes ? `\n${event.notes}` : ""}`;
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
  const parsed = JSON.parse(output);
  if (!parsed.ok) {
    throw new Error(parsed.error || "Unable to list calendars");
  }
  return parsed.calendars || [];
}

async function createCalendarEvent(payload) {
  const event = { ...payload };
  const genericCalendarNames = new Set(["日历", "苹果日历", "apple calendar", "calendar", "default", "默认", "默认日历", "icloud"]);
  if (!event.calendar || genericCalendarNames.has(String(event.calendar).trim().toLowerCase())) {
    delete event.calendar;
  }

  const created = JSON.parse(await runCommand("swift", ["scripts/eventkit-bridge.swift", "create", "--json", JSON.stringify(event)]));
  if (!created.ok) {
    throw new Error(created.error || "Calendar event creation failed");
  }
  const uid = created.uid;
  const weixinReminder = await scheduleWeixinReminder(event, uid);
  return { uid, calendar: created.calendar, syncCapable: true, weixinReminder };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": mime[".json"] });
  res.end(JSON.stringify(body));
}

async function readRequestJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) {
      throw new Error("Request too large");
    }
  }
  return JSON.parse(raw || "{}");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/calendars") {
      sendJson(res, 200, { calendars: await listCalendars() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/events") {
      const payload = await readRequestJson(req);
      const required = ["title", "date", "time", "duration"];
      const missing = required.filter((key) => !payload[key]);
      if (missing.length) {
        sendJson(res, 400, { error: `Missing: ${missing.join(", ")}` });
        return;
      }
      const { uid, calendar, syncCapable, weixinReminder } = await createCalendarEvent(payload);
      sendJson(res, 200, { ok: true, uid, calendar, sync_capable: syncCapable, weixin_reminder: weixinReminder });
      return;
    }

    const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(publicDir, requestPath));
    if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(await readFile(filePath));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI calendar board running at http://127.0.0.1:${port}`);
});
