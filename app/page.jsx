"use client";

import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const storagePrefix = "qiyeworkbench:";
const statePage = "app_state";
const pages = [
  { id: "today", name: "今日", icon: "home" },
  { id: "plans", name: "计划", icon: "checklist" },
  { id: "notes", name: "记录", icon: "note" },
  { id: "consultations", name: "咨询", icon: "chat" },
  { id: "market", name: "行情", icon: "trend" },
  { id: "calendar", name: "日历", icon: "calendar" },
  { id: "settings", name: "设置", icon: "settings" },
];
const pageNames = Object.fromEntries(pages.map((page) => [page.id, page.name]));
const noteTypes = [
  { value: "life", label: "生活" },
  { value: "food", label: "饮食" },
  { value: "treehole", label: "树洞" },
  { value: "review", label: "复盘" },
  { value: "idea", label: "灵感" },
];
const consultationStatuses = ["待整理", "处理中", "已归档"];
const defaultAssets = "SGE_AU9999,s_sh000001,s_sz399001,sh600519,sz300750";

function WorkbenchIcon({ name }) {
  const icons = {
    home: (
      <>
        <path d="M3.5 10.8 12 4l8.5 6.8" />
        <path d="M5.5 10.5V20h13v-9.5" />
        <path d="M9.5 20v-6h5v6" />
      </>
    ),
    checklist: (
      <>
        <path d="M9 7h11" />
        <path d="M9 12h11" />
        <path d="M9 17h11" />
        <path d="m4 7 1.2 1.2L7 5.8" />
        <path d="m4 12 1.2 1.2L7 10.8" />
        <path d="m4 17 1.2 1.2L7 15.8" />
      </>
    ),
    note: (
      <>
        <path d="M6 4h9l3 3v13H6z" />
        <path d="M15 4v4h4" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
    chat: (
      <>
        <path d="M5 5h14v10H9l-4 4z" />
        <path d="M9 9h6" />
        <path d="M9 12h4" />
      </>
    ),
    trend: (
      <>
        <path d="M4 18h16" />
        <path d="M6 15l4-5 3 3 5-7" />
        <path d="M15 6h3v3" />
      </>
    ),
    calendar: (
      <>
        <path d="M5 6h14v14H5z" />
        <path d="M8 3v5" />
        <path d="M16 3v5" />
        <path d="M5 10h14" />
        <path d="M8.5 14h2" />
        <path d="M13.5 14h2" />
        <path d="M8.5 17h2" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
        <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.9-1.1L14.2 3h-4.4l-.4 2.9A7 7 0 0 0 7.5 7l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.9 1.1l.4 2.9h4.4l.4-2.9a7 7 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1z" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8z" />
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
      </>
    ),
  };

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] || icons.spark}
    </svg>
  );
}

function key(name) {
  return storagePrefix + name;
}

function userKey(session, name) {
  return `${session.user.id}:${name}`;
}

function nowText(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readStorage(name, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key(name)) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeStorage(name, value) {
  localStorage.setItem(key(name), JSON.stringify(value));
}

function splitTags(value) {
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function noteTypeLabel(type) {
  return noteTypes.find((item) => item.value === type)?.label || "生活";
}

function getItemDate(item) {
  return item?.date || todayKey();
}

function mapItemsById(items, id, updater) {
  return items.map((item) => (item.id === id ? updater(item) : item));
}

function migrateLegacyData() {
  const existingNotes = readStorage("notes", null);
  const existingPlans = readStorage("plans", null);
  const existingConsultations = readStorage("consultations", null);

  if (!Array.isArray(existingNotes)) {
    const legacyMap = [
      ["food", "food"],
      ["review", "review"],
      ["treehole", "treehole"],
    ];
    const notes = legacyMap.flatMap(([page, type]) =>
      readStorage(`records:${page}`, []).map((record) => ({
        id: record.id || crypto.randomUUID(),
        date: todayKey(),
        type,
        title: record.title || "",
        content: record.note || "",
        mood: "",
        tags: splitTags(record.meta || record.group),
        time: record.time || nowText(),
      })),
    );
    writeStorage("notes", notes);
  }

  if (!Array.isArray(existingPlans)) {
    const plans = readStorage("records:todo", []).map((record) => ({
      id: record.id || crypto.randomUUID(),
      date: todayKey(),
      title: record.title || "",
      priority: "中",
      status: "未完成",
      note: record.note || record.meta || "",
      time: record.time || nowText(),
    }));
    writeStorage("plans", plans);
  }

  if (!Array.isArray(existingConsultations)) {
    const consultations = readStorage("records:chat", []).map((record) => ({
      id: record.id || crypto.randomUUID(),
      title: record.title || "",
      question: record.title || "",
      conclusion: record.note || "",
      source: record.meta || "AI chat",
      status: "待整理",
      tags: splitTags(record.group),
      nextAction: "",
      time: record.time || nowText(),
    }));
    writeStorage("consultations", consultations);
  }
}

async function loadCloudItems(session) {
  if (!supabase || !session) return {};
  const { data, error } = await supabase
    .from("workbench_records")
    .select("title,note,created_at")
    .eq("page", statePage)
    .like("title", `${session.user.id}:%`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latest = new Map();
  data.forEach((row) => {
    const name = row.title.replace(`${session.user.id}:`, "");
    if (!latest.has(name)) latest.set(name, row.note);
  });

  return Object.fromEntries(Array.from(latest.entries()).map(([name, value]) => {
    try {
      return [name, JSON.parse(value)];
    } catch {
      return [name, value];
    }
  }));
}

async function saveCloudItem(session, name, value) {
  if (!supabase || !session) return;
  const title = userKey(session, name);
  await supabase.from("workbench_records").delete().eq("page", statePage).eq("title", title);
  const { error } = await supabase.from("workbench_records").insert({
    page: statePage,
    title,
    meta: nowText(),
    note: JSON.stringify(value),
  });
  if (error) throw error;
}

function StatButton({ label, value, onClick }) {
  return (
    <button className="stat-card" type="button" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function QuickAction({ label, onClick }) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function SkillOverview({ open, skills, activePage, stats, session, onClose, onSelect }) {
  if (!open) return null;
  return (
    <section className="overview-drawer" aria-label="技能总览">
      <div className="overview-backdrop" onClick={onClose} />
      <div className="overview-panel">
        <div className="panel-head">
          <div>
            <h2>技能总览</h2>
            <p>从这里快速进入每个小技能</p>
          </div>
          <button className="chip-button" type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="overview-metrics">
          <div>
            <span>当前页</span>
            <strong>{pageNames[activePage]}</strong>
          </div>
          <div>
            <span>待整理</span>
            <strong>{stats.consultations}</strong>
          </div>
          <div>
            <span>模式</span>
            <strong>{session ? "云同步" : "本地"}</strong>
          </div>
        </div>
        <div className="skill-grid">
          {skills.map((skill) => (
            <button
              className={`skill-card ${skill.id === activePage ? "active" : ""}`}
              type="button"
              key={skill.id}
              onClick={() => {
                onSelect(skill.id);
                onClose();
              }}
            >
              <span><WorkbenchIcon name={skill.icon} /></span>
              <strong>{skill.name}</strong>
              <small className="skill-badge">{skill.badge}</small>
              <small>{skill.summary}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SyncPanel({ session, syncStatus, onLogin, onLogout, onSync, onExport }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    await onLogin(email.trim());
    setBusy(false);
  }

  return (
    <section className="panel sync-panel">
      <div className="panel-head">
        <div>
          <h2>数据与账号</h2>
          <p>{syncStatus}</p>
        </div>
        <div className="button-row">
          {session && <button className="chip-button" type="button" onClick={onSync}>同步</button>}
          <button className="chip-button" type="button" onClick={onExport}>导出</button>
        </div>
      </div>
      {!hasSupabaseConfig && <p className="empty">还没有配置 Supabase，先在 `.env.local` 填入地址和 anon key。</p>}
      {hasSupabaseConfig && !session && (
        <form className="stack-form" onSubmit={submit}>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="输入邮箱接收登录链接" required />
          <button type="submit" disabled={busy}>{busy ? "发送中" : "发送登录链接"}</button>
        </form>
      )}
      {session && (
        <div className="account-box">
          <strong>{session.user.email}</strong>
          <button type="button" onClick={onLogout}>退出登录</button>
        </div>
      )}
    </section>
  );
}

function WeatherCard({ compact = false }) {
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState("正在读取天气...");

  async function loadWeather(force = false) {
    const cache = readStorage("weatherCache", null);
    if (!force && cache && Date.now() - cache.savedAt < 30 * 60 * 1000) {
      setWeather(cache);
      setStatus(`天气缓存 · ${nowText(new Date(cache.savedAt))}`);
      return;
    }

    try {
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=31.2304&longitude=121.4737&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=3");
      const data = await response.json();
      const next = {
        savedAt: Date.now(),
        location: "上海",
        max: data.daily?.temperature_2m_max?.[0],
        min: data.daily?.temperature_2m_min?.[0],
        rain: data.daily?.precipitation_probability_max?.[0],
      };
      writeStorage("weatherCache", next);
      setWeather(next);
      setStatus(`天气已更新 · ${nowText()}`);
    } catch {
      setStatus(cache ? `天气更新失败 · ${nowText(new Date(cache.savedAt))}` : "天气暂时不可用");
    }
  }

  useEffect(() => {
    loadWeather();
  }, []);

  return (
    <section className={compact ? "panel weather-panel compact" : "panel weather-panel"}>
      <div className="panel-head">
        <div>
          <h2>天气</h2>
          <p>{status}</p>
        </div>
        <button className="chip-button" type="button" onClick={() => loadWeather(true)}>刷新</button>
      </div>
      <div className="weather-main">
        <strong>{weather ? `${weather.min ?? "--"}° / ${weather.max ?? "--"}°` : "--"}</strong>
        <span>{weather?.location || "默认城市"} · 降水概率 {weather?.rain ?? "--"}%</span>
      </div>
    </section>
  );
}

function MarketBoard({ compact = false }) {
  const [quotes, setQuotes] = useState([]);
  const [status, setStatus] = useState("正在读取行情...");

  async function loadQuotes(force = false) {
    const assets = localStorage.getItem(key("assets")) || defaultAssets;
    const cache = readStorage("marketCache", null);
    if (!force && cache && Date.now() - cache.savedAt < 60000) {
      setQuotes(cache.quotes);
      setStatus(`缓存行情 · ${nowText(new Date(cache.savedAt))}`);
      return;
    }

    setStatus(force ? "正在刷新行情..." : "正在读取行情...");
    try {
      const response = await fetch(`/api/market-quotes?symbols=${encodeURIComponent(assets)}`);
      const data = await response.json();
      const nextQuotes = Array.isArray(data.quotes) ? data.quotes : [];
      setQuotes(nextQuotes);
      writeStorage("marketCache", { savedAt: Date.now(), quotes: nextQuotes });
      setStatus(`${nextQuotes.some((quote) => quote.source === "示例") ? "示例行情" : "行情已更新"} · ${nowText()}`);
    } catch {
      if (cache?.quotes) {
        setQuotes(cache.quotes);
        setStatus(`行情更新失败，显示上次数据 · ${nowText(new Date(cache.savedAt))}`);
      } else {
        setStatus("行情暂时不可用");
      }
    }
  }

  useEffect(() => {
    loadQuotes();
    const timer = setInterval(() => loadQuotes(), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className={compact ? "market-panel compact" : "market-panel"}>
      <div className="panel-head">
        <div>
          <h2>行情速览</h2>
          <p>{status}</p>
        </div>
        <button className="chip-button" type="button" onClick={() => loadQuotes(true)}>刷新</button>
      </div>
      <div className="quote-list">
        {quotes.length === 0 && <p className="empty">还没有行情数据。</p>}
        {quotes.map((quote, index) => {
          const changeClass = quote.changePercent > 0 ? "up" : quote.changePercent < 0 ? "down" : "flat";
          const sign = quote.changePercent > 0 ? "+" : "";
          return (
            <div className={index === 0 ? "quote-row featured" : "quote-row"} key={quote.symbol}>
              <div><strong>{quote.name || quote.symbol}</strong><span>{quote.symbol} · {quote.source || "实时"}</span></div>
              <div className="quote-price"><strong>{quote.currency || ""}{Number(quote.price || 0).toFixed(2)}</strong><span className={changeClass}>{sign}{Number(quote.changePercent || 0).toFixed(2)}%</span></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlanForm({ onSave, editing, onCancel }) {
  const item = editing?.kind === "plan" ? editing.item : null;

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    onSave({
      id: item?.id || crypto.randomUUID(),
      date: String(data.get("date") || todayKey()),
      title,
      priority: String(data.get("priority") || "中"),
      status: String(data.get("status") || "未完成"),
      note: String(data.get("note") || ""),
      time: item?.time || nowText(),
    });
    event.currentTarget.reset();
    onCancel?.();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{item ? "编辑计划" : "添加计划"}</h2>
        {item && <button className="chip-button" type="button" onClick={onCancel}>取消编辑</button>}
      </div>
      <form className="stack-form" onSubmit={submit}>
        <input name="title" defaultValue={item?.title || ""} placeholder="今天要完成什么" required />
        <div className="inline-fields">
          <input name="date" type="date" defaultValue={getItemDate(item)} />
          <select name="priority" defaultValue={item?.priority || "中"}><option>高</option><option>中</option><option>低</option></select>
        </div>
        <select name="status" defaultValue={item?.status || "未完成"}><option>未完成</option><option>已完成</option></select>
        <textarea name="note" rows="3" defaultValue={item?.note || ""} placeholder="补充说明、地点、截止时间" />
        <button type="submit">{item ? "保存修改" : "保存计划"}</button>
      </form>
    </section>
  );
}

function itemMatchesQuery(item, query, fields) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  return fields
    .flatMap((field) => {
      const value = typeof field === "function" ? field(item) : item[field];
      return Array.isArray(value) ? value : [value];
    })
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword));
}

function PlanList({ plans, onToggle, onDelete, onEdit }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredPlans = plans.filter((plan) =>
    (status === "all" || plan.status === status) &&
    itemMatchesQuery(plan, query, ["title", "note", "date", "priority", "status"]),
  );

  return (
    <section className="panel">
      <div className="panel-head"><h2>计划列表</h2><span className="tag">{filteredPlans.length}/{plans.length} 条</span></div>
      <div className="filter-panel">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索计划、备注或日期" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">全部状态</option>
          <option value="未完成">未完成</option>
          <option value="已完成">已完成</option>
        </select>
      </div>
      <div className="record-list">
        {plans.length === 0 && <p className="empty">还没有计划，先添加一条。</p>}
        {plans.length > 0 && filteredPlans.length === 0 && <p className="empty">没有匹配的计划。</p>}
        {filteredPlans.map((plan) => (
          <article className={`record ${plan.status === "已完成" ? "done-record" : ""}`} key={plan.id}>
            <div className="record-head"><strong>{plan.title}</strong><span>{plan.date}</span></div>
            <p className="record-meta">{plan.priority}优先级 · {plan.status}</p>
            {plan.note && <p>{plan.note}</p>}
            <div className="record-actions">
              <button type="button" onClick={() => onEdit(plan)}>编辑</button>
              <button type="button" onClick={() => onToggle(plan.id)}>{plan.status === "已完成" ? "恢复" : "完成"}</button>
              <button type="button" onClick={() => onDelete(plan.id)}>删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NoteForm({ onSave, editing, onCancel }) {
  const item = editing?.kind === "note" ? editing.item : null;

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    onSave({
      id: item?.id || crypto.randomUUID(),
      date: String(data.get("date") || getItemDate(item)),
      type: String(data.get("type") || "life"),
      title,
      content: String(data.get("content") || ""),
      mood: String(data.get("mood") || ""),
      tags: splitTags(data.get("tags")),
      time: item?.time || nowText(),
    });
    event.currentTarget.reset();
    onCancel?.();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{item ? "编辑记录" : "快速记录"}</h2>
        {item && <button className="chip-button" type="button" onClick={onCancel}>取消编辑</button>}
      </div>
      <form className="stack-form" onSubmit={submit}>
        <input name="title" defaultValue={item?.title || ""} placeholder="这条记录的标题" required />
        <div className="inline-fields">
          <input name="date" type="date" defaultValue={getItemDate(item)} />
          <select name="type" defaultValue={item?.type || "life"}>{noteTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
        </div>
        <input name="mood" defaultValue={item?.mood || ""} placeholder="心情，可选" />
        <input name="tags" defaultValue={(item?.tags || []).join(",")} placeholder="标签，用逗号分隔" />
        <textarea name="content" rows="5" defaultValue={item?.content || ""} placeholder="写下生活、饮食、复盘、灵感或树洞内容" />
        <button type="submit">{item ? "保存修改" : "保存记录"}</button>
      </form>
    </section>
  );
}

function NoteList({ notes, onDelete, onEdit }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const filteredNotes = notes.filter((note) =>
    (type === "all" || note.type === type) &&
    itemMatchesQuery(note, query, ["title", "content", "mood", "tags", "date", noteTypeLabel]),
  );

  return (
    <section className="panel">
      <div className="panel-head"><h2>记录列表</h2><span className="tag">{filteredNotes.length}/{notes.length} 条</span></div>
      <div className="filter-panel">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、内容、标签" />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">全部类型</option>
          {noteTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="record-list">
        {notes.length === 0 && <p className="empty">还没有记录，先写一条。</p>}
        {notes.length > 0 && filteredNotes.length === 0 && <p className="empty">没有匹配的记录。</p>}
        {filteredNotes.map((note) => (
          <article className="record" key={note.id}>
            <div className="record-head"><strong>{note.title}</strong><span>{note.date}</span></div>
            <p className="record-meta">{[noteTypeLabel(note.type), note.mood, ...(note.tags || [])].filter(Boolean).join(" · ")}</p>
            {note.content && <p>{note.content}</p>}
            <div className="record-actions">
              <button type="button" onClick={() => onEdit(note)}>编辑</button>
              <button type="button" onClick={() => onDelete(note.id)}>删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConsultationForm({ onSave, editing, onCancel }) {
  const item = editing?.kind === "consultation" ? editing.item : null;

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    onSave({
      id: item?.id || crypto.randomUUID(),
      title,
      question: String(data.get("question") || ""),
      conclusion: String(data.get("conclusion") || ""),
      source: String(data.get("source") || ""),
      status: String(data.get("status") || "待整理"),
      tags: splitTags(data.get("tags")),
      nextAction: String(data.get("nextAction") || ""),
      time: item?.time || nowText(),
    });
    event.currentTarget.reset();
    onCancel?.();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{item ? "编辑咨询" : "新增咨询"}</h2>
        {item && <button className="chip-button" type="button" onClick={onCancel}>取消编辑</button>}
      </div>
      <form className="stack-form" onSubmit={submit}>
        <input name="title" defaultValue={item?.title || ""} placeholder="咨询主题" required />
        <textarea name="question" rows="3" defaultValue={item?.question || ""} placeholder="问题是什么" />
        <textarea name="conclusion" rows="4" defaultValue={item?.conclusion || ""} placeholder="整理后的结论" />
        <div className="inline-fields">
          <input name="source" defaultValue={item?.source || ""} placeholder="来源，可选" />
          <select name="status" defaultValue={item?.status || "待整理"}>{consultationStatuses.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <input name="tags" defaultValue={(item?.tags || []).join(",")} placeholder="标签，用逗号分隔" />
        <input name="nextAction" defaultValue={item?.nextAction || ""} placeholder="后续动作，可选" />
        <button type="submit">{item ? "保存修改" : "保存咨询"}</button>
      </form>
    </section>
  );
}

function ConsultationList({ consultations, onDelete, onEdit }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredConsultations = consultations.filter((item) =>
    (status === "all" || item.status === status) &&
    itemMatchesQuery(item, query, ["title", "question", "conclusion", "source", "tags", "nextAction", "status"]),
  );

  return (
    <section className="panel">
      <div className="panel-head"><h2>咨询整理</h2><span className="tag">{filteredConsultations.length}/{consultations.length} 条</span></div>
      <div className="filter-panel">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、结论、来源" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">全部状态</option>
          {consultationStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="record-list">
        {consultations.length === 0 && <p className="empty">还没有咨询整理，先保存一条问题和结论。</p>}
        {consultations.length > 0 && filteredConsultations.length === 0 && <p className="empty">没有匹配的咨询。</p>}
        {filteredConsultations.map((item) => (
          <article className="record" key={item.id}>
            <div className="record-head"><strong>{item.title}</strong><span>{item.status}</span></div>
            <p className="record-meta">{[item.source, ...(item.tags || [])].filter(Boolean).join(" · ")}</p>
            {item.question && <p><strong>问题：</strong>{item.question}</p>}
            {item.conclusion && <p><strong>结论：</strong>{item.conclusion}</p>}
            {item.nextAction && <p><strong>下一步：</strong>{item.nextAction}</p>}
            <div className="record-actions">
              <button type="button" onClick={() => onEdit(item)}>编辑</button>
              <button type="button" onClick={() => onDelete(item.id)}>删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CheckinPanel({ habits, done, onAdd, onToggle }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>今日签到</h2><span className="tag">{todayKey()}</span></div>
      <div className="check-list">
        {habits.length === 0 && <p className="empty">还没有习惯，添加一个开始坚持。</p>}
        {habits.map((item) => (
          <label className="check-row" key={item.id}>
            <input type="checkbox" checked={Boolean(done[item.id])} onChange={() => onToggle(item.id)} />
            <span>{item.title}</span>
          </label>
        ))}
      </div>
      <form className="quick-form" onSubmit={onAdd}>
        <input name="title" placeholder="例如：复盘、运动、早睡" required />
        <button type="submit">添加</button>
      </form>
    </section>
  );
}

function CalendarView({ plans, notes, habits, done, selectedDay, onSelectDay }) {
  const days = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      day,
      dateKey,
      plans: plans.filter((plan) => plan.date === dateKey).length,
      notes: notes.filter((note) => note.date === dateKey).length,
      checked: dateKey === todayKey() ? Object.values(done).filter(Boolean).length : 0,
    };
  });

  const dayPlans = plans.filter((plan) => plan.date === selectedDay);
  const dayNotes = notes.filter((note) => note.date === selectedDay);
  const selectedDone = Object.entries(done)
    .filter(([, checked]) => checked)
    .length;

  return (
    <section className="panel">
      <div className="panel-head"><h2>本月日历</h2><span className="tag">{habits.length} 个习惯</span></div>
      <div className="calendar-grid">
        {days.map((day) => (
          <button
            type="button"
            className={day.dateKey === selectedDay ? "calendar-day today selected" : day.dateKey === todayKey() ? "calendar-day today" : "calendar-day"}
            key={day.dateKey}
            onClick={() => onSelectDay(day.dateKey)}
          >
            <strong>{day.day}</strong>
            <span>{day.plans ? `${day.plans} 计划` : ""}</span>
            <span>{day.notes ? `${day.notes} 记录` : ""}</span>
            <span>{day.checked ? `${day.checked} 签到` : ""}</span>
          </button>
        ))}
      </div>
      <div className="calendar-detail">
        <div className="panel-head">
          <div>
            <h2>{selectedDay}</h2>
            <p>当天详情</p>
          </div>
        </div>
        <div className="record-list">
          {dayPlans.length === 0 && dayNotes.length === 0 && <p className="empty">这一天还没有计划或记录。</p>}
          {dayPlans.map((plan) => (
            <article className="record" key={plan.id}>
              <div className="record-head"><strong>{plan.title}</strong><span>计划</span></div>
              <p className="record-meta">{plan.priority}优先级 · {plan.status}</p>
              {plan.note && <p>{plan.note}</p>}
            </article>
          ))}
          {dayNotes.map((note) => (
            <article className="record" key={note.id}>
              <div className="record-head"><strong>{note.title}</strong><span>{noteTypeLabel(note.type)}</span></div>
              {note.content && <p>{note.content}</p>}
            </article>
          ))}
          {selectedDay === todayKey() && (
            <article className="record">
              <div className="record-head"><strong>签到</strong><span>{selectedDone}/{habits.length || 0}</span></div>
              <p className="record-meta">今天已完成的习惯</p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Workbench() {
  const [activePage, setActivePage] = useState("today");
  const [clock, setClock] = useState("--:--");
  const [plans, setPlans] = useState([]);
  const [notes, setNotes] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [habits, setHabits] = useState([]);
  const [done, setDone] = useState({});
  const [assetInput, setAssetInput] = useState(defaultAssets);
  const [session, setSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState("本地保存，登录后开启云同步");
  const [backupStatus, setBackupStatus] = useState("尚未导出");
  const [editing, setEditing] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState("mobile");

  function persist(name, value) {
    writeStorage(name, value);
    if (session) {
      saveCloudItem(session, name, value)
        .then(() => setSyncStatus(`已同步 · ${nowText()}`))
        .catch((error) => setSyncStatus(`同步失败：${error.message}`));
    }
  }

  function applyCloud(cloud) {
    if (Array.isArray(cloud.notes)) {
      setNotes(cloud.notes);
      writeStorage("notes", cloud.notes);
    }
    if (Array.isArray(cloud.plans)) {
      setPlans(cloud.plans);
      writeStorage("plans", cloud.plans);
    }
    if (Array.isArray(cloud.consultations)) {
      setConsultations(cloud.consultations);
      writeStorage("consultations", cloud.consultations);
    }
    if (Array.isArray(cloud.habits || cloud.checkins)) {
      const nextHabits = cloud.habits || cloud.checkins;
      setHabits(nextHabits);
      writeStorage("habits", nextHabits);
    }
    if (cloud[`done:${todayKey()}`]) {
      setDone(cloud[`done:${todayKey()}`]);
      writeStorage(`done:${todayKey()}`, cloud[`done:${todayKey()}`]);
    }
    if (typeof cloud.assets === "string") {
      setAssetInput(cloud.assets);
      localStorage.setItem(key("assets"), cloud.assets);
    }
  }

  async function syncFromCloud(nextSession = session) {
    if (!nextSession) return;
    setSyncStatus("正在从云端同步...");
    try {
      applyCloud(await loadCloudItems(nextSession));
      setSyncStatus(`云同步已连接 · ${nowText()}`);
    } catch (error) {
      setSyncStatus(`同步失败：${error.message || "请稍后再试"}`);
    }
  }

  async function syncAll(nextSession = session) {
    if (!nextSession) return;
    setSyncStatus("正在上传本地数据...");
    try {
      await Promise.all([
        saveCloudItem(nextSession, "notes", readStorage("notes", [])),
        saveCloudItem(nextSession, "plans", readStorage("plans", [])),
        saveCloudItem(nextSession, "consultations", readStorage("consultations", [])),
        saveCloudItem(nextSession, "habits", readStorage("habits", [])),
        saveCloudItem(nextSession, `done:${todayKey()}`, readStorage(`done:${todayKey()}`, {})),
        saveCloudItem(nextSession, "assets", localStorage.getItem(key("assets")) || defaultAssets),
      ]);
      setSyncStatus(`同步完成 · ${nowText()}`);
    } catch (error) {
      setSyncStatus(`同步失败：${error.message || "请稍后再试"}`);
    }
  }

  useEffect(() => {
    migrateLegacyData();
    const savedPage = localStorage.getItem(key("activePage"));
    setActivePage(pages.some((page) => page.id === savedPage) ? savedPage : "today");
    setPlans(readStorage("plans", []));
    setNotes(readStorage("notes", []));
    setConsultations(readStorage("consultations", []));
    setHabits(readStorage("habits", readStorage("checkins", [])));
    setDone(readStorage(`done:${todayKey()}`, {}));
    setAssetInput(localStorage.getItem(key("assets")) || defaultAssets);
    setDisplayMode(localStorage.getItem(key("displayMode")) === "desktop" ? "desktop" : "mobile");
    setClock(nowText());
    const timer = setInterval(() => setClock(nowText()), 30000);

    let subscription;
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        if (data.session) syncFromCloud(data.session);
      });
      subscription = supabase.auth.onAuthStateChange((_event, dataSession) => {
        setSession(dataSession);
        if (dataSession) syncFromCloud(dataSession);
        else setSyncStatus("本地保存，登录后开启云同步");
      }).data.subscription;
    }

    return () => {
      clearInterval(timer);
      subscription?.unsubscribe();
    };
  }, []);

  const stats = useMemo(() => {
    const finishedHabits = habits.filter((item) => done[item.id]).length;
    const todayPlans = plans.filter((plan) => plan.date === todayKey());
    const finishedPlans = todayPlans.filter((plan) => plan.status === "已完成").length;
    return {
      checkin: `${finishedHabits}/${habits.length}`,
      plans: `${finishedPlans}/${todayPlans.length}`,
      notes: `${notes.length} 条`,
      consultations: consultations.filter((item) => item.status !== "已归档").length,
    };
  }, [consultations, done, habits, notes, plans]);

  const recent = [
    ...notes.slice(0, 3).map((record) => ({ type: "记录", title: record.title, time: record.time, page: "notes" })),
    ...consultations.slice(0, 3).map((record) => ({ type: "咨询", title: record.title, time: record.time, page: "consultations" })),
  ].slice(0, 5);
  const todayPlans = plans.filter((plan) => plan.date === todayKey() && plan.status !== "已完成").slice(0, 3);

  function switchPage(page) {
    setActivePage(page);
    localStorage.setItem(key("activePage"), page);
  }

  function toggleDisplayMode() {
    const next = displayMode === "desktop" ? "mobile" : "desktop";
    setDisplayMode(next);
    localStorage.setItem(key("displayMode"), next);
  }

  function savePlan(plan) {
    const next = plans.some((item) => item.id === plan.id)
      ? mapItemsById(plans, plan.id, () => plan)
      : [plan, ...plans];
    setPlans(next);
    persist("plans", next);
  }

  function togglePlan(id) {
    const next = plans.map((plan) => plan.id === id ? { ...plan, status: plan.status === "已完成" ? "未完成" : "已完成" } : plan);
    setPlans(next);
    persist("plans", next);
  }

  function deletePlan(id) {
    const next = plans.filter((plan) => plan.id !== id);
    setPlans(next);
    persist("plans", next);
  }

  function editPlan(item) {
    setEditing({ kind: "plan", item });
    switchPage("plans");
  }

  function saveNote(note) {
    const next = notes.some((item) => item.id === note.id)
      ? mapItemsById(notes, note.id, () => note)
      : [note, ...notes];
    setNotes(next);
    persist("notes", next);
  }

  function deleteNote(id) {
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    persist("notes", next);
  }

  function editNote(item) {
    setEditing({ kind: "note", item });
    switchPage("notes");
  }

  function saveConsultation(item) {
    const next = consultations.some((record) => record.id === item.id)
      ? mapItemsById(consultations, item.id, () => item)
      : [item, ...consultations];
    setConsultations(next);
    persist("consultations", next);
  }

  function deleteConsultation(id) {
    const next = consultations.filter((item) => item.id !== id);
    setConsultations(next);
    persist("consultations", next);
  }

  function editConsultation(item) {
    setEditing({ kind: "consultation", item });
    switchPage("consultations");
  }

  function addHabit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const next = [...habits, { id: crypto.randomUUID(), title }];
    setHabits(next);
    persist("habits", next);
    event.currentTarget.reset();
  }

  function toggleHabit(id) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    persist(`done:${todayKey()}`, next);
  }

  function saveAssets(event) {
    event.preventDefault();
    const next = assetInput.trim() || defaultAssets;
    localStorage.setItem(key("assets"), next);
    localStorage.removeItem(key("marketCache"));
    persist("assets", next);
    alert("自选资产已保存，回到行情页会重新读取。");
  }

  function exportMarkdown() {
    const lines = [
      "# 七夜的工作台导出",
      "",
      `导出时间：${new Date().toISOString()}`,
      "",
      "## 计划",
      ...plans.map((plan) => `- [${plan.status === "已完成" ? "x" : " "}] ${plan.date} ${plan.title}（${plan.priority}）${plan.note ? `：${plan.note}` : ""}`),
      "",
      "## 记录",
      ...notes.map((note) => `### ${note.date} ${note.title}\n\n类型：${noteTypeLabel(note.type)}\n\n${note.content || ""}\n`),
      "",
      "## 咨询",
      ...consultations.map((item) => `### ${item.title}\n\n状态：${item.status}\n\n问题：${item.question || ""}\n\n结论：${item.conclusion || ""}\n\n下一步：${item.nextAction || ""}\n`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qiyeworkbench-${todayKey()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      plans,
      notes,
      consultations,
      habits,
      done,
      assets: assetInput,
      weatherCache: readStorage("weatherCache", null),
      marketCache: readStorage("marketCache", null),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qiyeworkbench-backup-${todayKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupStatus(`已导出 · ${nowText()}`);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (Array.isArray(payload.plans)) {
        setPlans(payload.plans);
        persist("plans", payload.plans);
      }
      if (Array.isArray(payload.notes)) {
        setNotes(payload.notes);
        persist("notes", payload.notes);
      }
      if (Array.isArray(payload.consultations)) {
        setConsultations(payload.consultations);
        persist("consultations", payload.consultations);
      }
      if (Array.isArray(payload.habits)) {
        setHabits(payload.habits);
        persist("habits", payload.habits);
      }
      if (payload.done && typeof payload.done === "object") {
        setDone(payload.done);
        persist(`done:${todayKey()}`, payload.done);
      }
      if (typeof payload.assets === "string") {
        setAssetInput(payload.assets);
        localStorage.setItem(key("assets"), payload.assets);
        persist("assets", payload.assets);
      }
      if (payload.weatherCache) writeStorage("weatherCache", payload.weatherCache);
      if (payload.marketCache) writeStorage("marketCache", payload.marketCache);
      setBackupStatus(`已恢复 · ${nowText()}`);
    } catch (error) {
      setBackupStatus(`恢复失败：${error.message || "文件格式不正确"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function login(email) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSyncStatus(error ? `登录邮件发送失败：${error.message}` : "登录链接已发送，请在手机邮箱里打开");
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setSyncStatus("已退出登录，本机继续本地保存");
  }

  function cancelEditing() {
    setEditing(null);
  }

  const sortedRecent = [...recent].sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
  const skillSummaries = [
    { id: "today", name: "今日总览", icon: "home", badge: "首页", summary: `计划 ${stats.plans} · 签到 ${stats.checkin}` },
    { id: "plans", name: "每日计划", icon: "checklist", badge: "待办", summary: `${todayPlans.length} 条待办` },
    { id: "notes", name: "生活记录", icon: "note", badge: "记录", summary: `${notes.length} 条记录` },
    { id: "consultations", name: "咨询整理", icon: "chat", badge: "待整理", summary: `${stats.consultations} 条` },
    { id: "market", name: "行情观察", icon: "trend", badge: "行情", summary: "金价、指数、自选股" },
    { id: "calendar", name: "签到日历", icon: "calendar", badge: "习惯", summary: `${habits.length} 个习惯` },
    { id: "settings", name: "数据设置", icon: "settings", badge: "备份", summary: session ? "云同步在线" : "本地模式" },
  ];

  return (
    <main className={`phone-shell ${displayMode === "desktop" ? "desktop-shell" : "mobile-shell"} page-${activePage}`}>
      <header className="topbar">
        <div className="status"><strong>{clock}</strong><span>{session ? "云同步在线" : "本地模式"}</span></div>
        <div className="navline">
          <button className="icon-button" type="button" aria-label="打开技能总览" onClick={() => setOverviewOpen(true)}><WorkbenchIcon name="home" /></button>
          <h1>七夜的工作台</h1>
          <button className="pill-button mode-button" type="button" onClick={toggleDisplayMode}>{displayMode === "desktop" ? "手机端" : "网页端"}</button>
          <button className="pill-button" type="button" onClick={() => switchPage("settings")}>设置</button>
        </div>
        <div className="workspace-title"><span><WorkbenchIcon name="spark" /></span><strong>{pageNames[activePage]}</strong></div>
      </header>

      <section className="app-body">
        <section className="content">
          {activePage === "today" && (
            <>
              <section className="hero-card"><span><WorkbenchIcon name="spark" /></span><div><h2>今天先看状态</h2><p>天气、计划、签到、行情和最近整理，集中在这一屏。</p></div></section>
              <section className="dashboard-strip" aria-label="今日概览">
                <div className="dashboard-tile dashboard-tile-primary">
                  <span>今日计划</span>
                  <strong>{stats.plans}</strong>
                  <small>完成 / 总数</small>
                </div>
                <div className="dashboard-tile">
                  <span>待整理</span>
                  <strong>{stats.consultations}</strong>
                  <small>咨询与线索</small>
                </div>
                <div className="dashboard-tile">
                  <span>记录数</span>
                  <strong>{stats.notes}</strong>
                  <small>生活与灵感</small>
                </div>
              </section>
              <section className="panel quick-panel">
                <div className="panel-head"><h2>快速入口</h2><span className="tag">一步到位</span></div>
                <div className="quick-grid">
                  <QuickAction label="新建计划" onClick={() => switchPage("plans")} />
                  <QuickAction label="快速记录" onClick={() => switchPage("notes")} />
                  <QuickAction label="整理咨询" onClick={() => switchPage("consultations")} />
                  <QuickAction label="查看日历" onClick={() => switchPage("calendar")} />
                </div>
              </section>
              <section className="stats-grid">
                <StatButton label="今日计划" value={stats.plans} onClick={() => switchPage("plans")} />
                <StatButton label="今日签到" value={stats.checkin} onClick={() => switchPage("calendar")} />
                <StatButton label="记录总数" value={stats.notes} onClick={() => switchPage("notes")} />
                <StatButton label="待处理咨询" value={`${stats.consultations} 条`} onClick={() => switchPage("consultations")} />
              </section>
              <WeatherCard compact />
              <section className="panel">
                <div className="panel-head"><h2>今日计划</h2><span className="tag">{todayKey()}</span></div>
                <div className="record-list">
                  {todayPlans.length === 0 && <p className="empty">今天没有未完成计划。</p>}
                  {todayPlans.map((plan) => (
                    <button className="timeline-row" type="button" key={plan.id} onClick={() => switchPage("plans")}>
                      <span>{plan.priority}</span><strong>{plan.title}</strong><small>{plan.status}</small>
                    </button>
                  ))}
                </div>
              </section>
              <MarketBoard compact />
              <section className="panel">
                <div className="panel-head"><h2>最近整理</h2><span className="tag">最新</span></div>
                <div className="timeline">
                  {sortedRecent.length === 0 && <p className="empty">还没有动态，先添加一条记录或咨询。</p>}
                  {sortedRecent.map((record) => (
                    <button className="timeline-row" type="button" key={`${record.type}-${record.title}-${record.time}`} onClick={() => switchPage(record.page)}>
                      <span>{record.type}</span><strong>{record.title}</strong><small>{record.time}</small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {activePage === "plans" && (
            <>
              <PlanForm onSave={savePlan} editing={editing} onCancel={cancelEditing} />
              <PlanList plans={plans} onToggle={togglePlan} onDelete={deletePlan} onEdit={editPlan} />
            </>
          )}

          {activePage === "notes" && (
            <>
              <NoteForm onSave={saveNote} editing={editing} onCancel={cancelEditing} />
              <NoteList notes={notes} onDelete={deleteNote} onEdit={editNote} />
            </>
          )}

          {activePage === "consultations" && (
            <>
              <ConsultationForm onSave={saveConsultation} editing={editing} onCancel={cancelEditing} />
              <ConsultationList consultations={consultations} onDelete={deleteConsultation} onEdit={editConsultation} />
            </>
          )}

          {activePage === "market" && <MarketBoard />}

          {activePage === "calendar" && (
            <>
              <CheckinPanel habits={habits} done={done} onAdd={addHabit} onToggle={toggleHabit} />
              <CalendarView plans={plans} notes={notes} habits={habits} done={done} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
            </>
          )}

          {activePage === "settings" && (
            <>
              <SyncPanel session={session} syncStatus={syncStatus} onLogin={login} onLogout={logout} onSync={() => syncAll()} onExport={exportMarkdown} />
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>备份与恢复</h2>
                    <p>{backupStatus}</p>
                  </div>
                  <button className="chip-button" type="button" onClick={exportBackup}>导出备份</button>
                </div>
                <div className="stack-form">
                  <label className="file-row">
                    <span>导入 JSON 备份</span>
                    <input type="file" accept="application/json" onChange={importBackup} />
                  </label>
                </div>
              </section>
              <section className="panel">
                <h2>自选资产</h2>
                <form className="stack-form" onSubmit={saveAssets}>
                  <input value={assetInput} onChange={(event) => setAssetInput(event.target.value)} placeholder="SGE_AU9999,s_sh000001,s_sz399001,sh600519,sz300750" />
                  <button type="submit">保存自选</button>
                </form>
              </section>
              <section className="panel">
                <h2>手机登录</h2>
                <p className="empty">手机打开同一个网址，进入“设置”，输入邮箱，点邮件里的登录链接。登录后点“同步”，电脑和手机就会使用同一份云端数据。</p>
              </section>
            </>
          )}
        </section>

        <nav className="bottom-nav" aria-label="工作台导航">
          {pages.map((page) => (
            <button className={`nav-item ${activePage === page.id ? "active" : ""}`} type="button" key={page.id} onClick={() => switchPage(page.id)}>
              <span><WorkbenchIcon name={page.icon} /></span><small>{page.name}</small>
            </button>
          ))}
        </nav>
      </section>
      <SkillOverview
        open={overviewOpen}
        skills={skillSummaries}
        activePage={activePage}
        stats={stats}
        session={session}
        onClose={() => setOverviewOpen(false)}
        onSelect={switchPage}
      />
    </main>
  );
}
