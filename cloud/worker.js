const TZ = "Asia/Shanghai";

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>花黛思云端提醒</title>
    <style>
      :root { color-scheme: light; font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; background: #f6f7f9; color: #1f2933; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #f6f7f9; }
      main { width: min(980px, 100%); margin: 0 auto; padding: 22px; }
      header { display: flex; justify-content: space-between; align-items: end; gap: 16px; padding: 8px 0 18px; }
      h1, h2, p { margin: 0; }
      h1 { font-size: 28px; line-height: 1.2; }
      .muted { color: #687385; font-size: 14px; }
      .status { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .pill { border: 1px solid #d8dee8; border-radius: 999px; padding: 6px 10px; background: #fff; font-size: 13px; }
      section { background: #fff; border: 1px solid #dfe4ec; border-radius: 8px; padding: 16px; margin-bottom: 14px; }
      form { display: grid; gap: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 180px; gap: 12px; }
      label { display: grid; gap: 6px; color: #344054; font-weight: 700; font-size: 13px; }
      input, textarea, button { min-height: 42px; border: 1px solid #d0d7e2; border-radius: 8px; font: inherit; }
      input, textarea { padding: 10px 12px; }
      textarea { resize: vertical; }
      button { padding: 0 14px; background: #176b5c; color: #fff; font-weight: 800; cursor: pointer; }
      button.secondary { background: #fff; color: #176b5c; }
      .tasks { display: grid; gap: 10px; }
      .task { display: grid; gap: 6px; padding: 12px; border: 1px solid #e1e7ef; border-left: 4px solid #176b5c; border-radius: 8px; }
      .task strong { font-size: 15px; }
      .task .line { display: flex; justify-content: space-between; gap: 12px; color: #687385; font-size: 13px; flex-wrap: wrap; }
      .failed { border-left-color: #b42318; }
      .sent { border-left-color: #477b52; }
      #toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); background: #1f2933; color: #fff; padding: 10px 14px; border-radius: 8px; opacity: 0; transition: opacity .2s; pointer-events: none; }
      #toast.show { opacity: 1; }
      @media (max-width: 720px) { main { padding: 16px; } header, .grid { grid-template-columns: 1fr; display: grid; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>花黛思云端提醒</h1>
          <p class="muted">电脑关机也能保存任务；提醒由云端 Cron 执行。</p>
          <div class="status">
            <span class="pill" id="clock">读取时间中</span>
            <span class="pill" id="channel">检查提醒通道中</span>
          </div>
        </div>
        <button class="secondary" id="refresh" type="button">刷新</button>
      </header>

      <section>
        <form id="taskForm">
          <div class="grid">
            <label>提醒事项<input id="title" required placeholder="例如：明天 11 点检查 SOP 流程"></label>
            <label>提醒时间<input id="remindAt" required type="datetime-local"></label>
          </div>
          <label>备注<textarea id="notes" rows="3" placeholder="补充说明，可不填"></textarea></label>
          <button type="submit">创建云端微信提醒</button>
        </form>
      </section>

      <section>
        <h2>提醒列表</h2>
        <div class="tasks" id="tasks"></div>
      </section>
    </main>
    <div id="toast" role="status"></div>
    <script>
      const toast = document.getElementById("toast");
      const tasksEl = document.getElementById("tasks");
      const form = document.getElementById("taskForm");
      const channel = document.getElementById("channel");
      const clock = document.getElementById("clock");

      function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2400);
      }

      function fmt(value) {
        return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
      }

      async function api(path, options) {
        const response = await fetch(path, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "请求失败");
        return data;
      }

      async function load() {
        const data = await api("/api/tasks");
        clock.textContent = "云端时间 " + fmt(data.now);
        channel.textContent = data.reminder_configured ? "提醒通道已配置" : "提醒通道未配置";
        tasksEl.innerHTML = "";
        if (!data.tasks.length) {
          tasksEl.innerHTML = '<p class="muted">暂无提醒。</p>';
          return;
        }
        for (const task of data.tasks) {
          const item = document.createElement("article");
          item.className = "task " + task.status;
          item.innerHTML = '<strong>' + task.title + '</strong><div class="line"><span>' + fmt(task.remind_at) + '</span><span>' + task.status + ' · ' + task.channel + '</span></div><p class="muted">' + (task.notes || "无备注") + '</p>' + (task.last_error ? '<p class="muted">错误：' + task.last_error + '</p>' : '');
          tasksEl.appendChild(item);
        }
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const remindAt = document.getElementById("remindAt").value;
        try {
          await api("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: document.getElementById("title").value,
              notes: document.getElementById("notes").value,
              remind_at: new Date(remindAt).toISOString()
            })
          });
          form.reset();
          showToast("已创建，默认微信提醒");
          await load();
        } catch (error) {
          showToast(error.message);
        }
      });

      document.getElementById("refresh").addEventListener("click", load);
      load().catch((error) => showToast(error.message));
    </script>
  </body>
</html>`;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

async function ensureSchema(env) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      remind_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      channel TEXT NOT NULL DEFAULT 'weixin',
      reminder_required INTEGER NOT NULL DEFAULT 1,
      reminder_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_remind_at ON tasks(remind_at)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    `CREATE TABLE IF NOT EXISTS reminder_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      ok INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`
  ];

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
}

async function sendReminder(env, task) {
  if (!env.WEIXIN_WEBHOOK_URL) {
    return { ok: false, message: "WEIXIN_WEBHOOK_URL is not configured" };
  }

  const content = `日程提醒：${task.title}${task.notes ? "\\n" + task.notes : ""}`;
  const response = await fetch(env.WEIXIN_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ msgtype: "text", text: { content } })
  });
  const text = await response.text();
  return { ok: response.ok, message: text || response.statusText };
}

async function runDueReminders(env) {
  await ensureSchema(env);
  const due = await env.DB.prepare(`
    SELECT * FROM tasks
    WHERE status = 'pending' AND remind_at <= ?
    ORDER BY remind_at ASC
    LIMIT 20
  `).bind(nowIso()).all();

  for (const task of due.results || []) {
    const result = await sendReminder(env, task);
    await env.DB.prepare(`
      INSERT INTO reminder_logs (id, task_id, channel, ok, message)
      VALUES (?, ?, ?, ?, ?)
    `).bind(uuid(), task.id, task.channel, result.ok ? 1 : 0, result.message).run();

    await env.DB.prepare(`
      UPDATE tasks
      SET status = ?, reminder_attempts = reminder_attempts + 1, last_error = ?, updated_at = ?
      WHERE id = ?
    `).bind(result.ok ? "sent" : "failed", result.ok ? null : result.message, nowIso(), task.id).run();
  }
}

async function handleRequest(request, env) {
  await ensureSchema(env);
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, now: nowIso(), timezone: TZ, reminder_configured: Boolean(env.WEIXIN_WEBHOOK_URL) });
  }

  if (request.method === "GET" && url.pathname === "/api/tasks") {
    const rows = await env.DB.prepare("SELECT * FROM tasks ORDER BY remind_at DESC LIMIT 100").all();
    return json({ ok: true, now: nowIso(), reminder_configured: Boolean(env.WEIXIN_WEBHOOK_URL), tasks: rows.results || [] });
  }

  if (request.method === "POST" && url.pathname === "/api/tasks") {
    const body = await request.json();
    if (!body.title || !body.remind_at) {
      return json({ ok: false, error: "Missing title/remind_at" }, 400);
    }
    const id = uuid();
    await env.DB.prepare(`
      INSERT INTO tasks (id, title, notes, remind_at, status, channel, reminder_required)
      VALUES (?, ?, ?, ?, 'pending', 'weixin', 1)
    `).bind(id, String(body.title), String(body.notes || ""), new Date(body.remind_at).toISOString()).run();
    return json({ ok: true, id, channel: "weixin", reminder_required: true });
  }

  if (request.method === "POST" && url.pathname === "/api/run-due") {
    await runDueReminders(env);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Not found" }, 404);
}

export default {
  fetch: handleRequest,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDueReminders(env));
  }
};
