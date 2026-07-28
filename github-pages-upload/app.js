const storagePrefix = "mobile-workbench:";
const pageNames = {
  checkin: "每日打卡",
  food: "饮食记录",
  news: "每日新闻",
  review: "每日复盘",
  chat: "AI chat",
  money: "记账日记",
};
const recordPages = ["checkin", "food", "news", "review", "chat", "money"];

function key(name) {
  return storagePrefix + name;
}

function nowText() {
  const date = new Date();
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function updateClock() {
  const date = new Date();
  document.querySelector("#clock").textContent = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function loadRecords(page) {
  return JSON.parse(localStorage.getItem(key("records:" + page)) || "[]");
}

function saveRecords(page, records) {
  localStorage.setItem(key("records:" + page), JSON.stringify(records));
}

function recordText(record) {
  return [record.group, record.title, record.meta, record.note].filter(Boolean).join("\n");
}

function renderRecords(page) {
  const list = document.querySelector(`[data-list="${page}"]`);
  if (!list) return;
  const records = loadRecords(page);
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
    item.querySelector(".delete-record").addEventListener("click", () => {
      records.splice(index, 1);
      saveRecords(page, records);
      renderRecords(page);
    });
    list.append(item);
  });
  updateMoneyTotal();
}

function updateMoneyTotal() {
  const target = document.querySelector("#moneyTotal");
  if (!target) return;
  const total = loadRecords("money").reduce((sum, item) => {
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
  form.addEventListener("submit", (event) => {
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
    const records = loadRecords(page);
    records.unshift(record);
    saveRecords(page, records);
    form.reset();
    renderRecords(page);
  });
});

document.querySelector("#clearPage").addEventListener("click", () => {
  const page = localStorage.getItem(key("activePage")) || "checkin";
  if (!confirm(`清空「${pageNames[page]}」的记录？`)) return;
  saveRecords(page, []);
  renderRecords(page);
});

document.querySelector("#exportData").addEventListener("click", async () => {
  const data = Object.fromEntries(recordPages.map((page) => [pageNames[page], loadRecords(page)]));
  const text = JSON.stringify(data, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert("已复制全部记录，可粘贴保存。 ");
  } catch {
    prompt("复制下面的记录内容", text);
  }
});

updateClock();
setInterval(updateClock, 30000);
recordPages.forEach(renderRecords);
switchPage(localStorage.getItem(key("activePage")) || "checkin");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
