const hours = ["09:00", "10:30", "13:30", "15:00", "16:30", "20:00"];
const today = new Date();
const start = new Date(today);
start.setDate(today.getDate() - ((today.getDay() + 6) % 7));

const tasks = [
  {
    id: crypto.randomUUID(),
    title: "整理本周内容选题",
    notes: "把抖音、视频号、小红书选题统一排进内容节奏。",
    duration: 60,
    type: "创作"
  },
  {
    id: crypto.randomUUID(),
    title: "门店核销数据复盘",
    notes: "检查到店、核销、成交三个口径是否一致。",
    duration: 90,
    type: "运营"
  },
  {
    id: crypto.randomUUID(),
    title: "客户跟进清单",
    notes: "把需要二次沟通的人拆成今天能执行的小块。",
    duration: 30,
    type: "沟通"
  }
];

const scheduled = new Map();
const taskList = document.getElementById("taskList");
const calendarGrid = document.getElementById("calendarGrid");
const taskCount = document.getElementById("taskCount");
const calendarSelect = document.getElementById("calendarSelect");
const syncButton = document.getElementById("syncButton");
const addTaskButton = document.getElementById("addTaskButton");
const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");
const toast = document.getElementById("toast");

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function labelDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function weekDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderTask(task) {
  const item = document.createElement("article");
  item.className = `task tone-${task.type}`;
  item.draggable = true;
  item.dataset.id = task.id;
  item.innerHTML = `
    <div>
      <strong>${task.title}</strong>
      <span>${task.type} · ${task.duration} 分钟</span>
    </div>
    <p>${task.notes || "无说明"}</p>
  `;
  item.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", task.id);
  });
  return item;
}

function renderInbox() {
  taskList.innerHTML = "";
  const openTasks = tasks.filter((task) => !scheduled.has(task.id));
  taskCount.textContent = openTasks.length;
  openTasks.forEach((task) => taskList.appendChild(renderTask(task)));
}

function renderGrid() {
  calendarGrid.innerHTML = "";
  const days = weekDays();

  const corner = document.createElement("div");
  corner.className = "grid-corner";
  calendarGrid.appendChild(corner);

  days.forEach((day) => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `<strong>${["一", "二", "三", "四", "五", "六", "日"][day.getDay() === 0 ? 6 : day.getDay() - 1]}</strong><span>${labelDate(day)}</span>`;
    calendarGrid.appendChild(header);
  });

  hours.forEach((time) => {
    const timeLabel = document.createElement("div");
    timeLabel.className = "time-label";
    timeLabel.textContent = time;
    calendarGrid.appendChild(timeLabel);

    days.forEach((day) => {
      const date = isoDate(day);
      const slot = document.createElement("button");
      slot.className = "slot";
      slot.type = "button";
      slot.dataset.date = date;
      slot.dataset.time = time;
      const entry = [...scheduled.entries()].find(([, value]) => value.date === date && value.time === time);
      if (entry) {
        const [taskId] = entry;
        const task = tasks.find((item) => item.id === taskId);
        slot.classList.add("filled", `tone-${task.type}`);
        slot.innerHTML = `<strong>${task.title}</strong><span>${task.duration} 分钟</span>`;
        slot.addEventListener("click", () => {
          scheduled.delete(task.id);
          render();
        });
      } else {
        slot.textContent = "拖到这里";
      }
      slot.addEventListener("dragover", (event) => event.preventDefault());
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain");
        scheduled.set(id, { date, time });
        render();
      });
      calendarGrid.appendChild(slot);
    });
  });
}

function render() {
  renderInbox();
  renderGrid();
}

async function loadCalendars() {
  calendarSelect.innerHTML = `<option>读取日历中...</option>`;
  try {
    const response = await fetch("/api/calendars");
    const data = await response.json();
    calendarSelect.innerHTML = "";
    data.calendars.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      calendarSelect.appendChild(option);
    });
  } catch (error) {
    calendarSelect.innerHTML = `<option>日历不可用</option>`;
    showToast(error.message);
  }
}

async function syncToCalendar() {
  const items = [...scheduled.entries()];
  if (!items.length) {
    showToast("先把任务拖到时间格里");
    return;
  }

  syncButton.disabled = true;
  syncButton.textContent = "写入中...";
  try {
    for (const [taskId, timeBox] of items) {
      const task = tasks.find((item) => item.id === taskId);
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar: calendarSelect.value,
          title: task.title,
          notes: task.notes,
          date: timeBox.date,
          time: timeBox.time,
          duration: task.duration
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "写入失败");
      }
    }
    showToast(`已写入 ${items.length} 个日历事件`);
  } catch (error) {
    showToast(error.message);
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = "写入日历";
  }
}

addTaskButton.addEventListener("click", () => taskDialog.showModal());
document.getElementById("cancelDialogButton").addEventListener("click", () => taskDialog.close());
taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  tasks.push({
    id: crypto.randomUUID(),
    title: document.getElementById("taskTitle").value,
    notes: document.getElementById("taskNotes").value,
    duration: Number(document.getElementById("taskDuration").value),
    type: document.getElementById("taskType").value
  });
  taskForm.reset();
  taskDialog.close();
  render();
});
syncButton.addEventListener("click", syncToCalendar);

render();
loadCalendars();
