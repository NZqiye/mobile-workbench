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
  renderRecords(page);
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

updateClock();
setInterval(updateClock, 30000);
switchPage(localStorage.getItem(key("activePage")) || "checkin");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
