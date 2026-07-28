const storagePrefix = "mobile-workbench:";
const supabaseUrl = "https://sfdcugcuxcxljiqyxlym.supabase.co";
const supabaseKey = "sb_publishable_jJ3S5L8F9Dv5-wAYUO-mJg_govCK7pk";
const tableUrl = `${supabaseUrl}/rest/v1/workbench_records`;
const pageNames = {
  checkin: "每日打卡",
  food: "饮食记录",
  news: "每日新闻",
  review: "每日复盘",
  chat: "AI chat",
  money: "记账日记",
  stats: "统计",
};
const recordPages = ["checkin", "food", "news", "review", "chat", "money"];
let cloudEnabled = true;

function key(name) {
  return storagePrefix + name;
}

function nowText(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
    createdAt: row.created_at,
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
    setCloudStatus("云端未连接，暂用本地缓存。请确认 Supabase 表和 RLS 策略已创建。", "error");
  }
  list.innerHTML = "";
  if (!records.length) {
    list.innerHTML = '<p class="empty">还没有记录，先添加一条。</p>';
    updateMoneyTotal();
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
  updateMoneyTotal();
}

function updateMoneyTotal() {
  const target = document.querySelector("#moneyTotal");
  if (!target) return;
  const total = readLocalRecords("money").reduce((sum, item) => {
    const amount = Number(item.meta || 0);
    return item.group === "收入" ? sum + amount : sum - amount;
  }, 0);
  target.textContent = `合计：${total.toFixed(2)}`;
}

function switchPage(page) {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
  document.querySelectorAll(".page").forEach((view) => view.classList.toggle("active", view.dataset.view === page));
  document.querySelector("#sectionTitle").textContent = pageNames[page];
  document.querySelector("#pageTitle").textContent = pageNames[page];
  localStorage.setItem(key("activePage"), page);
  if (page === "stats") {
    renderStats();
  } else {
    renderRecords(page);
  }
}

document.querySelectorAll("[data-save]").forEach((box) => {
  const boxKey = key(box.dataset.save);
  box.checked = localStorage.getItem(boxKey) === "1";
  box.addEventListener("change", () => localStorage.setItem(boxKey, box.checked ? "1" : "0"));
});

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
    createdAt: new Date().toISOString(),
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
  if (!confirm(`清空「${pageNames[page]}」的记录？`)) return;
  await clearRecords(page);
  await renderRecords(page);
});

document.querySelector("#exportData").addEventListener("click", async () => {
  const data = Object.fromEntries(recordPages.map((page) => [pageNames[page], readLocalRecords(page)]));
  const text = JSON.stringify(data, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert("已复制本地缓存记录，可粘贴保存。 ");
  } catch {
    prompt("复制下面的记录内容", text);
  }
});

const moneyCategories = {
  消费: [
    ["三餐", "🍴"], ["零食", "🥡"], ["衣服", "👕"], ["交通", "🚌"],
    ["旅行", "🏝️"], ["孩子", "🧒"], ["宠物", "🐾"], ["话费网费", "☎️"],
    ["烟酒", "🍺"], ["学习", "📖"], ["日用品", "🧻"], ["住房", "🏠"],
    ["美妆", "💄"], ["医疗", "➕"], ["发红包", "🧧"], ["汽车/加油", "⛽"],
    ["娱乐", "🎮"], ["请客送礼", "🎂"], ["电器数码", "📷"], ["运动", "🏃"], ["其它", "▦"]
  ],
  收入: [
    ["工资", "💰"], ["生活费", "💳"], ["收红包", "🧧"], ["外快", "👤"], ["股票基金", "📈"], ["其它", "▦"]
  ]
};
let moneyKind = "消费";
let moneyCategory = "三餐";
let moneyAmountText = "";

function formatMoneyAmount() {
  return moneyAmountText || "0.0";
}

function renderMoneyAmount() {
  const amount = document.querySelector("#moneyAmount");
  if (amount) amount.textContent = formatMoneyAmount();
}

function renderMoneyCategories() {
  const grid = document.querySelector("#moneyCategoryGrid");
  if (!grid) return;
  grid.innerHTML = "";
  moneyCategories[moneyKind].forEach(([name, icon]) => {
    const button = document.createElement("button");
    button.className = `money-category ${name === moneyCategory ? "active" : ""}`.trim();
    button.type = "button";
    button.innerHTML = '<span class="money-icon"></span><span class="money-label"></span>';
    button.querySelector(".money-icon").textContent = icon;
    button.querySelector(".money-label").textContent = name;
    button.addEventListener("click", () => {
      moneyCategory = name;
      renderMoneyCategories();
    });
    grid.append(button);
  });
}

function setMoneyKind(kind) {
  moneyKind = kind;
  moneyCategory = moneyCategories[kind][0][0];
  document.querySelectorAll(".money-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.moneyKind === kind));
  const panel = document.querySelector(".money-panel");
  if (panel) panel.classList.toggle("income", kind === "收入");
  renderMoneyAmount();
  renderMoneyCategories();
}

function pressMoneyKey(value) {
  if (/^\d$/.test(value)) {
    if (moneyAmountText === "0") moneyAmountText = value;
    else moneyAmountText += value;
  } else if (value === "." && !moneyAmountText.includes(".")) {
    moneyAmountText = moneyAmountText ? moneyAmountText + "." : "0.";
  } else if (value === "back") {
    moneyAmountText = moneyAmountText.slice(0, -1);
  } else if (value === "again") {
    moneyAmountText = "";
    const note = document.querySelector("#moneyNote");
    if (note) note.value = "";
  } else if (value === "minus" && moneyAmountText) {
    moneyAmountText = moneyAmountText.startsWith("-") ? moneyAmountText.slice(1) : "-" + moneyAmountText;
  }
  if (moneyAmountText.length > 10) moneyAmountText = moneyAmountText.slice(0, 10);
  renderMoneyAmount();
}

async function saveMoneyEntry() {
  const amount = Math.abs(Number(moneyAmountText));
  if (!amount) {
    alert("请输入金额");
    return;
  }
  const note = document.querySelector("#moneyNote");
  const record = {
    title: moneyCategory,
    group: moneyKind,
    meta: amount.toFixed(2),
    note: note ? note.value.trim() : "",
    time: nowText(),
    createdAt: new Date().toISOString(),
  };
  try {
    await addRecord("money", record);
    moneyAmountText = "";
    if (note) note.value = "";
    renderMoneyAmount();
    await renderRecords("money");
  } catch (error) {
    cloudEnabled = false;
    const records = readLocalRecords("money");
    records.unshift(record);
    writeLocalRecords("money", records);
    setCloudStatus("云端保存失败，已保存到本地缓存", "error");
    moneyAmountText = "";
    if (note) note.value = "";
    renderMoneyAmount();
    await renderRecords("money");
  }
}

function setupMoneyBook() {
  document.querySelectorAll(".money-tab").forEach((tab) => {
    tab.addEventListener("click", () => setMoneyKind(tab.dataset.moneyKind));
  });
  document.querySelectorAll("#moneyKeypad [data-key]").forEach((button) => {
    button.addEventListener("click", () => pressMoneyKey(button.dataset.key));
  });
  const save = document.querySelector("#moneySave");
  if (save) save.addEventListener("click", saveMoneyEntry);
  setMoneyKind("消费");
}

function moneyDate(record) {
  if (record.createdAt) return new Date(record.createdAt);
  const fallback = new Date();
  if (record.time && record.time.includes("/")) {
    const datePart = record.time.split(" ")[0];
    const [month, day] = datePart.split("/").map(Number);
    if (month && day) return new Date(fallback.getFullYear(), month - 1, day);
  }
  return fallback;
}

function isExpenseRecord(record) {
  return record.group === "消费" || record.group === "支出";
}

function isIncomeRecord(record) {
  return record.group === "收入";
}

function moneyAmount(record) {
  return Number(record.meta || 0) || 0;
}

function sameMonth(date, baseDate) {
  return date.getFullYear() === baseDate.getFullYear() && date.getMonth() === baseDate.getMonth();
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function weekdayName(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

async function renderStats() {
  let records = [];
  try {
    records = await loadRecords("money");
    setCloudStatus("云端同步已连接", "online");
  } catch (error) {
    cloudEnabled = false;
    records = readLocalRecords("money");
    setCloudStatus("云端未连接，统计使用本地缓存", "error");
  }

  const now = new Date();
  const monthRecords = records.filter((record) => sameMonth(moneyDate(record), now));
  const monthExpense = monthRecords.filter(isExpenseRecord).reduce((sum, item) => sum + moneyAmount(item), 0);
  const monthIncome = monthRecords.filter(isIncomeRecord).reduce((sum, item) => sum + moneyAmount(item), 0);
  const balance = monthIncome - monthExpense;

  document.querySelector("#statsMonth").textContent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  document.querySelector("#statsExpense").textContent = monthExpense.toFixed(2);
  document.querySelector("#statsIncome").textContent = monthIncome.toFixed(2);
  document.querySelector("#statsBalance").textContent = balance.toFixed(2);

  renderStatsBars(records, now);
  renderStatsDays(records);
}

function renderStatsBars(records, now) {
  const chart = document.querySelector("#statsBarChart");
  if (!chart) return;
  const days = Array.from({ length: 15 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - 14 + index);
    return date;
  });
  const values = days.map((day) => records.filter((record) => isExpenseRecord(record) && dateKey(moneyDate(record)) === dateKey(day)).reduce((sum, item) => sum + moneyAmount(item), 0));
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  document.querySelector("#stats15Total").textContent = `总计：${total.toFixed(2)}`;
  chart.innerHTML = "";
  days.forEach((day, index) => {
    const bar = document.createElement("div");
    bar.className = "bar-item";
    bar.innerHTML = '<div class="bar-track"><span></span></div><small></small>';
    bar.querySelector("span").style.height = `${Math.max(4, Math.round((values[index] / max) * 84))}px`;
    bar.querySelector("small").textContent = String(day.getDate());
    chart.append(bar);
  });
}

function renderStatsDays(records) {
  const list = document.querySelector("#statsDayList");
  if (!list) return;
  const recentExpenses = records
    .filter(isExpenseRecord)
    .map((record) => ({ ...record, date: moneyDate(record) }))
    .sort((a, b) => b.date - a.date)
    .slice(0, 30);
  const groups = new Map();
  recentExpenses.forEach((record) => {
    const key = dateKey(record.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  list.innerHTML = "";
  if (!groups.size) {
    list.innerHTML = '<article class="stats-day-card"><p class="empty">还没有消费记录。</p></article>';
    return;
  }
  [...groups.values()].forEach((items) => {
    const date = items[0].date;
    const total = items.reduce((sum, item) => sum + moneyAmount(item), 0);
    const card = document.createElement("article");
    card.className = "stats-day-card";
    card.innerHTML = `
      <div class="stats-day-head"><strong></strong><span></span></div>
      <div class="stats-day-items"></div>
    `;
    card.querySelector("strong").textContent = `${shortDate(date)} ${weekdayName(date)}`;
    card.querySelector("span").textContent = `消:¥${total.toFixed(2)}`;
    const wrap = card.querySelector(".stats-day-items");
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "stats-day-row";
      row.innerHTML = '<span></span><b></b>';
      row.querySelector("span").textContent = item.title;
      row.querySelector("b").textContent = `-${moneyAmount(item).toFixed(2)}`;
      wrap.append(row);
    });
    list.append(card);
  });
}
setupMoneyBook();
updateClock();
setInterval(updateClock, 30000);
switchPage(localStorage.getItem(key("activePage")) || "checkin");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}



