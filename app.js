const storagePrefix = "mobile-workbench:";
const supabaseUrl = "https://sfdcugcuxcxljiqyxlym.supabase.co";
const supabaseKey = "sb_publishable_jJ3S5L8F9Dv5-wAYUO-mJg_govCK7pk";
const tableUrl = `${supabaseUrl}/rest/v1/workbench_records`;
const pageNames = {
  checkin: "习惯打卡",
  media: "影视推荐",
  chat: "AI chat",
  food: "饮食记录",
  todo: "待办清单",
  sleep: "作息提醒",
  treehole: "七夜树洞",
  review: "每日复盘",
  settings: "设置",
};
const recordPages = ["media", "chat", "food", "todo", "sleep", "treehole", "review"];
let cloudEnabled = true;

function key(name) {
  return storagePrefix + name;
}

function nowText(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function headers(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function updateClock() {
  const date = new Date();
  document.querySelector("#clock").textContent = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function setCloudStatus(text, type = "online") {
  const status = document.querySelector("#cloudStatus");
  if (!status) return;
  status.textContent = text;
  status.className = `cloud-status ${type === "online" ? "" : type}`.trim();
}

function readLocalRecords(page) {
  return JSON.parse(localStorage.getItem(key("records:" + page)) || "[]");
}

function writeLocalRecords(page, records) {
  localStorage.setItem(key("records:" + page), JSON.stringify(records));
}

function toAppRecord(row) {
  return {
    id: row.id,
    title: row.title,
    group: row.record_group || "",
    meta: row.meta || "",
    note: row.note || "",
    time: nowText(new Date(row.created_at)),
  };
}

function toDbRecord(page, record) {
  return {
    page,
    title: record.title,
    record_group: record.group || null,
    meta: record.meta || null,
    note: record.note || null,
  };
}

async function loadRecords(page) {
  if (!cloudEnabled) return readLocalRecords(page);
  const url = `${tableUrl}?page=eq.${encodeURIComponent(page)}&select=*&order=created_at.desc`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  const records = rows.map(toAppRecord);
  writeLocalRecords(page, records);
  return records;
}

async function addRecord(page, record) {
  if (!cloudEnabled) {
    const records = readLocalRecords(page);
    records.unshift(record);
    writeLocalRecords(page, records);
    return;
  }
  const response = await fetch(tableUrl, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(toDbRecord(page, record)),
  });
  if (!response.ok) throw new Error(await response.text());
}

async function deleteRecord(page, record, index) {
  if (!cloudEnabled || !record.id) {
    const records = readLocalRecords(page);
    records.splice(index, 1);
    writeLocalRecords(page, records);
    return;
  }
  const response = await fetch(`${tableUrl}?id=eq.${record.id}`, { method: "DELETE", headers: headers() });
  if (!response.ok) throw new Error(await response.text());
}

async function clearRecords(page) {
  if (!cloudEnabled) {
    writeLocalRecords(page, []);
    return;
  }
  const response = await fetch(`${tableUrl}?page=eq.${encodeURIComponent(page)}`, { method: "DELETE", headers: headers() });
  if (!response.ok) throw new Error(await response.text());
}

async function renderRecords(page) {
  const list = document.querySelector(`[data-list="${page}"]`);
  if (!list) return;
  list.innerHTML = '<p class="empty">正在读取记录...</p>';
  let records = [];
  try {
    records = await loadRecords(page);
    setCloudStatus("云端同步已连接", "online");
  } catch (error) {
    cloudEnabled = false;
    records = readLocalRecords(page);
    setCloudStatus("云端未连接，暂用本地缓存", "error");
  }
  list.innerHTML = "";
  if (!records.length) {
    list.innerHTML = '<p class="empty">还没有记录，先添加一条。</p>';
    return;
  }
  records.forEach((record, index) => {
    const item = document.createElement("div");
    item.className = "record";
    item.innerHTML = `
      <div class="record-head"><div class="record-title"></div><div class="record-time"></div></div>
      <div class="record-meta"></div>
      <div class="record-note"></div>
      <div class="record-actions"><button class="delete-record" type="button">删除</button></div>
    `;
    item.querySelector(".record-title").textContent = record.title;
    item.querySelector(".record-time").textContent = record.time;
    item.querySelector(".record-meta").textContent = [record.group, record.meta].filter(Boolean).join(" · ");
    item.querySelector(".record-note").textContent = record.note || "";
    item.querySelector(".delete-record").addEventListener("click", async () => {
      await deleteRecord(page, record, index);
      await renderRecords(page);
    });
    list.append(item);
  });
}

function loadCheckinTasks() {
  return JSON.parse(localStorage.getItem(key("checkinTasks")) || "[]");
}

function saveCheckinTasks(tasks) {
  localStorage.setItem(key("checkinTasks"), JSON.stringify(tasks));
}

function loadCheckinDone() {
  return JSON.parse(localStorage.getItem(key("checkinDone:" + todayKey())) || "{}");
}

function saveCheckinDone(done) {
  localStorage.setItem(key("checkinDone:" + todayKey()), JSON.stringify(done));
}

function renderCheckinTasks() {
  const list = document.querySelector("#checkinTaskList");
  if (!list) return;
  const label = document.querySelector("#checkinToday");
  if (label) label.textContent = todayKey();
  const tasks = loadCheckinTasks();
  const done = loadCheckinDone();
  list.innerHTML = "";
  if (!tasks.length) {
    list.innerHTML = '<p class="empty">还没有习惯，添加一个开始坚持吧。</p>';
    return;
  }
  tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "checkin-task";
    row.innerHTML = `
      <label class="check-row"><input type="checkbox"><span></span></label>
      <div class="task-actions"><button type="button" data-action="edit">修改</button><button type="button" data-action="delete">删除</button></div>
    `;
    const box = row.querySelector("input");
    box.checked = Boolean(done[task.id]);
    row.querySelector("span").textContent = task.title;
    box.addEventListener("change", () => {
      const nextDone = loadCheckinDone();
      nextDone[task.id] = box.checked;
      saveCheckinDone(nextDone);
      renderCheckinTasks();
    });
    row.querySelector('[data-action="edit"]').addEventListener("click", () => {
      const nextTitle = prompt("修改习惯", task.title);
      if (!nextTitle || !nextTitle.trim()) return;
      const nextTasks = loadCheckinTasks().map((item) => item.id === task.id ? { ...item, title: nextTitle.trim() } : item);
      saveCheckinTasks(nextTasks);
      renderCheckinTasks();
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (!confirm(`删除「${task.title}」？`)) return;
      saveCheckinTasks(loadCheckinTasks().filter((item) => item.id !== task.id));
      const nextDone = loadCheckinDone();
      delete nextDone[task.id];
      saveCheckinDone(nextDone);
      renderCheckinTasks();
    });
    list.append(row);
  });
}

function setupCheckinTasks() {
  const form = document.querySelector("#checkinTaskForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#checkinTaskInput");
    const title = input.value.trim();
    if (!title) return;
    const tasks = loadCheckinTasks();
    tasks.push({ id: String(Date.now()), title });
    saveCheckinTasks(tasks);
    input.value = "";
    renderCheckinTasks();
  });
}

function applyTheme(theme, soft) {
  document.documentElement.style.setProperty("--blue", theme);
  document.documentElement.style.setProperty("--blue-soft", soft);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", theme);
  localStorage.setItem(key("theme"), JSON.stringify({ theme, soft }));
  document.querySelectorAll("#themeGrid button").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === theme);
  });
}

function setupTheme() {
  const saved = JSON.parse(localStorage.getItem(key("theme")) || "{}");
  applyTheme(saved.theme || "#3987ed", saved.soft || "#dcebff");
  document.querySelectorAll("#themeGrid button").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.theme, button.dataset.soft));
  });
}

function loadSleepSettings() {
  return JSON.parse(localStorage.getItem(key("sleepSettings")) || "{}");
}

function setupSleepSettings() {
  const settings = loadSleepSettings();
  if (settings.sleepTime) document.querySelector("#sleepTime").value = settings.sleepTime;
  if (settings.wakeTime) document.querySelector("#wakeTime").value = settings.wakeTime;
  document.querySelector("#sleepToggle").checked = Boolean(settings.enabled);
  document.querySelector("#saveSleepSettings").addEventListener("click", async () => {
    const next = {
      sleepTime: document.querySelector("#sleepTime").value,
      wakeTime: document.querySelector("#wakeTime").value,
      enabled: document.querySelector("#sleepToggle").checked,
    };
    localStorage.setItem(key("sleepSettings"), JSON.stringify(next));
    await addRecord("sleep", {
      title: next.enabled ? "已启用作息提醒" : "已关闭作息提醒",
      meta: `${next.sleepTime} 睡 / ${next.wakeTime} 起`,
      note: "浏览器网页无法真正弹系统闹钟，这里先保存提醒设置。",
      time: nowText(),
    });
    await renderRecords("sleep");
  });
}

function switchPage(page) {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
  document.querySelectorAll(".page").forEach((view) => view.classList.toggle("active", view.dataset.view === page));
  document.querySelector("#sectionTitle").textContent = pageNames[page];
  document.querySelector("#pageTitle").textContent = page === "settings" ? "七夜的工作台" : pageNames[page];
  localStorage.setItem(key("activePage"), page);
  if (page === "checkin") renderCheckinTasks();
  else if (page !== "settings") renderRecords(page);
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => switchPage(item.dataset.page));
});

document.querySelectorAll("[data-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const page = form.dataset.form;
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const record = {
      title,
      group: String(data.get("meal") || "").trim(),
      meta: String(data.get("meta") || "").trim(),
      note: String(data.get("note") || "").trim(),
      time: nowText(),
    };
    try {
      await addRecord(page, record);
      if (!cloudEnabled) setCloudStatus("云端未连接，已保存到本地缓存", "offline");
      form.reset();
      await renderRecords(page);
    } catch (error) {
      cloudEnabled = false;
      const records = readLocalRecords(page);
      records.unshift(record);
      writeLocalRecords(page, records);
      setCloudStatus("云端保存失败，已保存到本地缓存", "error");
      form.reset();
      await renderRecords(page);
    }
  });
});

document.querySelector("#clearPage").addEventListener("click", async () => {
  const page = localStorage.getItem(key("activePage")) || "checkin";
  if (page === "settings") return;
  if (page === "checkin") {
    if (!confirm("清空今天的打卡完成状态？习惯本身会保留。")) return;
    localStorage.removeItem(key("checkinDone:" + todayKey()));
    renderCheckinTasks();
    return;
  }
  if (!confirm(`清空「${pageNames[page]}」的记录？`)) return;
  await clearRecords(page);
  await renderRecords(page);
});

document.querySelector("#exportData").addEventListener("click", async () => {
  const data = Object.fromEntries(recordPages.map((page) => [pageNames[page], readLocalRecords(page)]));
  data[pageNames.checkin] = { tasks: loadCheckinTasks(), todayDone: loadCheckinDone() };
  data["主题"] = JSON.parse(localStorage.getItem(key("theme")) || "{}");
  const text = JSON.stringify(data, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert("已复制本地缓存记录，可粘贴保存。 ");
  } catch {
    prompt("复制下面的记录内容", text);
  }
});

setupTheme();
setupCheckinTasks();
setupSleepSettings();
updateClock();
setInterval(updateClock, 30000);
switchPage(localStorage.getItem(key("activePage")) || "checkin");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
