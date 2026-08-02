"use client";

import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const storagePrefix = "qiyeworkbench:";
const statePage = "app_state";
const pages = [
  { id: "today", name: "今日速看", icon: "home" },
  { id: "plans", name: "每日安排", icon: "checklist" },
  { id: "notes", name: "灵感记录", icon: "note" },
  { id: "market", name: "股市行情", icon: "trend" },
  { id: "calendar", name: "日历行程", icon: "calendar" },
  { id: "consultations", name: "观影记录", icon: "chat" },
  { id: "settings", name: "设置", icon: "settings" },
];
const pageNames = Object.fromEntries(pages.map((page) => [page.id, page.name]));
const pageDescriptions = {
  today: "时间、天气、计划和行情集中整理",
  plans: "每日安排、待办事项、复盘跟进",
  notes: "生活记录、灵感、饮食与树洞",
  market: "金价、指数、自选资产观察",
  calendar: "签到、习惯和每日完成情况",
  consultations: "观影清单、想法和资料整理",
  settings: "账号同步、备份恢复和自选配置",
};
const ponyThemes = [
  { id: "rmb", name: "赤焰", note: "100元红金", primary: "#b4232c", accent: "#c98a2c" },
  { id: "gold", name: "鎏金", note: "金色暖调", primary: "#a45f16", accent: "#d6a23a" },
  { id: "ink", name: "墨红", note: "沉稳深色", primary: "#3a2024", accent: "#b7791f" },
  { id: "jade", name: "青玉", note: "低饱和青绿", primary: "#16645a", accent: "#c99a3a" },
  { id: "blue", name: "霜蓝", note: "冷静蓝灰", primary: "#285980", accent: "#b88a37" },
  { id: "pine", name: "松绿", note: "自然深绿", primary: "#255f3e", accent: "#c98a2c" },
];
const noteTypes = [
  { value: "life", label: "生活" },
  { value: "food", label: "饮食" },
  { value: "treehole", label: "树洞" },
  { value: "review", label: "复盘" },
  { value: "idea", label: "灵感" },
];
const consultationStatuses = ["想看的剧", "正在看", "看过的剧", "暂停/弃剧"];
const defaultAssets = "SGE_AU9999,s_sh000001,s_sz399001,sh600519,sz300750";
const fixedSession = { user: { id: "personal-workbench", email: "固定访问码已解锁" } };

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

function SolidNavIcon({ name }) {
  const icons = {
    home: (
      <>
        <path d="M4 11.2 12 4l8 7.2v8.4a1.4 1.4 0 0 1-1.4 1.4h-4.1v-5.8h-5V21H5.4A1.4 1.4 0 0 1 4 19.6z" />
        <path d="M2.8 11.3a1 1 0 0 0 1.4.1L12 4.5l7.8 6.9a1 1 0 1 0 1.4-1.5l-8.6-7.6a1 1 0 0 0-1.3 0L2.7 9.9a1 1 0 0 0 .1 1.4z" />
      </>
    ),
    checklist: (
      <>
        <rect x="6" y="3" width="14" height="18" rx="2.2" />
        <rect x="4" y="6" width="4" height="2" rx="1" />
        <rect x="4" y="11" width="4" height="2" rx="1" />
        <rect x="4" y="16" width="4" height="2" rx="1" />
        <path d="M10 7.1h7v1.8h-7zM10 12.1h7v1.8h-7zM10 17.1h5v1.8h-5z" fill="#fff" opacity=".82" />
      </>
    ),
    note: (
      <>
        <path d="M6 3h8.7L19 7.3V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M14 3.3V8h4.7" fill="#fff" opacity=".72" />
        <path d="M8 12h8v1.8H8zM8 16h6v1.8H8z" fill="#fff" opacity=".82" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-5.2 4.4c-.7.6-1.8.1-1.8-.8V5.5z" />
        <path d="M8 7.4h8v1.7H8zM8 11h5.8v1.7H8z" fill="#fff" opacity=".82" />
      </>
    ),
    trend: (
      <>
        <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18h13a1.5 1.5 0 0 1 0 3h-13A1.5 1.5 0 0 1 4 19.5z" />
        <path d="M5.2 14.7a1.4 1.4 0 0 1 .2-2l4-3.5a1.4 1.4 0 0 1 1.8 0l2.3 2 4.7-6a1.4 1.4 0 1 1 2.2 1.7l-5.6 7.2a1.4 1.4 0 0 1-2 .2l-2.4-2.1-3.4 3a1.4 1.4 0 0 1-1.8-.5z" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="2.4" />
        <path d="M4 9h16v2H4zM8 3h2v4H8zM14 3h2v4h-2z" fill="#fff" opacity=".75" />
        <path d="M8 13h3v3H8zM13 13h3v3h-3z" fill="#fff" opacity=".85" />
      </>
    ),
    settings: (
      <>
        <path d="M10.6 2h2.8l.6 2.4c.6.2 1.1.4 1.6.7l2.2-1.2 2 2.4-1.5 2c.2.5.3 1.1.4 1.7l2.2 1v3l-2.3.9c-.1.6-.3 1.1-.6 1.6l1.2 2.2-2.4 2-2-1.5c-.5.2-1 .4-1.6.4L12.3 22H9.5L9 19.6c-.6-.2-1.1-.4-1.6-.7l-2.2 1.2-2-2.4 1.5-2c-.2-.5-.3-1.1-.4-1.7l-2.2-1v-3l2.3-.9c.1-.6.3-1.1.6-1.6L3.8 5.3l2.4-2 2 1.5c.5-.2 1-.4 1.6-.4z" />
        <circle cx="12" cy="12" r="3.2" fill="#fff" opacity=".86" />
      </>
    ),
  };

  return (
    <svg className="solid-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] || icons.home}
    </svg>
  );
}

function AnimeNavIcon({ name }) {
  const icons = {
    home: (
      <>
        <path className="anime-shadow" d="M8 22h10c2 0 3-1 3-3v-7l-9-8-9 8v7c0 2 1 3 3 3z" />
        <path className="anime-main" d="M5 11.5 12 5l7 6.5V20H5z" />
        <path className="anime-light" d="M9 20v-5h6v5zM7.5 11.5 12 7.3l4.5 4.2z" />
        <circle className="anime-dot" cx="17.5" cy="7" r="2" />
      </>
    ),
    checklist: (
      <>
        <path className="anime-shadow" d="M8 3h10c1.7 0 3 1.3 3 3v13c0 1.7-1.3 3-3 3H8c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3z" />
        <path className="anime-main" d="M7 5h12v15H7z" />
        <path className="anime-light" d="M9 8h8v2H9zM9 12h8v2H9zM9 16h5v2H9z" />
        <path className="anime-accent" d="M10 2h6v4h-6z" />
      </>
    ),
    note: (
      <>
        <path className="anime-shadow" d="M6 4h10l4 4v12c0 1.2-.8 2-2 2H6c-1.2 0-2-.8-2-2V6c0-1.2.8-2 2-2z" />
        <path className="anime-main" d="M7 5h8.2L19 8.8V20H7z" />
        <path className="anime-light" d="M15 5v5h4M9 12h7v1.8H9zM9 16h5v1.8H9z" />
        <path className="anime-ribbon" d="M6 7c2-2 4-2 6 0-2 2-4 2-6 0zm7 0c2-2 4-2 6 0-2 2-4 2-6 0z" />
      </>
    ),
    chat: (
      <>
        <path className="anime-shadow" d="M5 5h14c1.4 0 2.5 1.1 2.5 2.5v7c0 1.4-1.1 2.5-2.5 2.5h-7l-5.5 4v-4H5c-1.4 0-2.5-1.1-2.5-2.5v-7C2.5 6.1 3.6 5 5 5z" />
        <path className="anime-main" d="M5 6.5h14v9H9.5L6 18v-2.5H5z" />
        <circle className="anime-light" cx="8" cy="11" r="1.5" />
        <circle className="anime-light" cx="12" cy="11" r="1.5" />
        <circle className="anime-light" cx="16" cy="11" r="1.5" />
      </>
    ),
    trend: (
      <>
        <path className="anime-shadow" d="M4 20h16v2H4z" />
        <rect className="anime-main" x="5" y="12" width="3" height="7" rx="1" />
        <rect className="anime-accent" x="10.5" y="8" width="3" height="11" rx="1" />
        <rect className="anime-light" x="16" y="5" width="3" height="14" rx="1" />
        <path className="anime-ribbon" d="M4.5 10.5 9 7l4 2.6L19 4l1.4 1.5-7.1 6.7L9.1 9.5 5.8 12z" />
      </>
    ),
    calendar: (
      <>
        <path className="anime-shadow" d="M6 4h12c1.7 0 3 1.3 3 3v12c0 1.7-1.3 3-3 3H6c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3z" />
        <path className="anime-main" d="M5 8h14v12H5z" />
        <path className="anime-accent" d="M5 7c0-1 .8-2 2-2h10c1.2 0 2 1 2 2v3H5z" />
        <path className="anime-light" d="M8 12h3v3H8zM13 12h3v3h-3zM8 16h3v2H8z" />
      </>
    ),
    settings: (
      <>
        <circle className="anime-shadow" cx="12" cy="12" r="9" />
        <path className="anime-main" d="M12 3.5 14 8l4.8-.5-2.8 4 2.8 4-4.8-.5-2 4.5-2-4.5-4.8.5 2.8-4-2.8-4L10 8z" />
        <circle className="anime-light" cx="12" cy="12" r="3.2" />
        <circle className="anime-dot" cx="17.5" cy="6.5" r="1.8" />
      </>
    ),
  };

  return (
    <svg className="anime-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] || icons.home}
    </svg>
  );
}

function PonyMark({ theme = "rmb", compact = false }) {
  return (
    <svg className={compact ? "pony-mark compact" : "pony-mark"} viewBox="0 0 64 64" aria-hidden="true">
      <path className="pony-mane" d="M16 22c2-9 10-15 21-15 7 0 13 2 18 7-5 0-8 2-10 5 6 2 9 8 8 15-1 12-12 22-26 22-8 0-15-3-19-8 8 1 14-1 17-5-7-2-11-7-11-14 0-3 1-5 2-7z" />
      <path className="pony-body" d="M15 35c0-11 8-20 20-20 11 0 19 8 19 19 0 12-9 22-22 22-11 0-17-6-17-21z" />
      <path className="pony-neck" d="M17 37c-5 4-7 10-6 17h8c0-5 2-9 5-12z" />
      <path className="pony-ear" d="M31 14 36 4l5 11z" />
      <path className="pony-face" d="M38 24c6 0 12 5 12 12 0 8-6 14-14 14-7 0-13-5-13-13 0-7 6-13 15-13z" />
      <circle className="pony-eye" cx="42" cy="34" r="2.4" />
      <path className="pony-nose" d="M47 41c-2 2-5 2-7 0" />
      <path className="pony-shine" d="M24 22c3-5 8-8 14-8" />
    </svg>
  );
}

function CultivationAvatar() {
  return (
    <img className="cultivation-avatar" src="/avatar-cultivation.png" alt="" />
  );
}

function PonyThemePanel({ value, onChange }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>主题小马</h2>
          <p>选择一匹小马，切换工作台主色</p>
        </div>
        <span className="tag">{ponyThemes.find((item) => item.id === value)?.name || "赤焰"}</span>
      </div>
      <div className="pony-theme-grid">
        {ponyThemes.map((theme) => (
          <button
            className={`pony-theme-card theme-${theme.id} ${value === theme.id ? "active" : ""}`}
            type="button"
            key={theme.id}
            onClick={() => onChange(theme.id)}
          >
            <PonyMark theme={theme.id} compact />
            <strong>{theme.name}</strong>
            <small>{theme.note}</small>
            <span>
              <i style={{ background: theme.primary }} />
              <i style={{ background: theme.accent }} />
            </span>
          </button>
        ))}
      </div>
    </section>
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

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekdayText(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function monthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function mapItemsById(items, id, updater) {
  return items.map((item) => (item.id === id ? updater(item) : item));
}

function mergeById(localItems, cloudItems) {
  const merged = new Map();
  if (Array.isArray(cloudItems)) {
    cloudItems.forEach((item) => merged.set(item.id || crypto.randomUUID(), item));
  }
  if (Array.isArray(localItems)) {
    localItems.forEach((item) => {
      const id = item.id || crypto.randomUUID();
      if (!merged.has(id)) merged.set(id, { ...item, id });
    });
  }
  return Array.from(merged.values());
}

function mergeCloudWithLocal(cloud) {
  return {
    notes: mergeById(readStorage("notes", []), cloud.notes),
    plans: mergeById(readStorage("plans", []), cloud.plans),
    consultations: mergeById(readStorage("consultations", []), cloud.consultations),
    habits: mergeById(readStorage("habits", readStorage("checkins", [])), cloud.habits || cloud.checkins),
    [`done:${todayKey()}`]: {
      ...readStorage(`done:${todayKey()}`, {}),
      ...(cloud[`done:${todayKey()}`] || {}),
    },
    assets: typeof cloud.assets === "string" ? cloud.assets : localStorage.getItem(key("assets")) || defaultAssets,
  };
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
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!accessCode.trim()) return;
    setBusy(true);
    await onLogin(accessCode.trim());
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
          <input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="输入固定访问码" required />
          <button type="submit" disabled={busy}>{busy ? "验证中" : "解锁云同步"}</button>
        </form>
      )}
      {session && (
        <div className="account-box">
          <strong>{session.user.email}</strong>
          <button type="button" onClick={onLogout}>锁定</button>
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

function WatchSchedule({ items = [], tmdbResults = [], tmdbStatus, tmdbSections = [], tmdbRecommendationStatus, onSearchTmdb, onImportTmdb, onLoadRecommendations }) {
  const today = new Date();
  const [expanded, setExpanded] = useState(false);
  const [tmdbQuery, setTmdbQuery] = useState("");
  const allItems = Array.isArray(items) ? items : [];
  const searchResults = Array.isArray(tmdbResults) ? tmdbResults : [];
  const recommendationSections = Array.isArray(tmdbSections) ? tmdbSections : [];
  function itemsForDate(dateKey) {
    return allItems.filter((item) => item.nextAirDate === dateKey);
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      items: allItems.filter((item) => item.nextAirDate === dateKey || item.watchedDate === dateKey),
      updates: itemsForDate(dateKey),
    };
  });
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthGridStart = new Date(monthStart);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  monthGridStart.setDate(monthStart.getDate() - mondayOffset);
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(monthGridStart);
    date.setDate(monthGridStart.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      inMonth: date.getMonth() === today.getMonth(),
      items: allItems.filter((item) => item.nextAirDate === dateKey || item.watchedDate === dateKey),
      updates: itemsForDate(dateKey),
    };
  });
  const calendarDays = expanded ? monthDays : week;
  const [selectedDate, setSelectedDate] = useState(week[0].dateKey);
  const selected = monthDays.find((day) => day.dateKey === selectedDate) || week[0];
  const activeWatchItems = allItems
    .filter((item) => item.status !== "看过的剧" && item.status !== "暂停/弃剧")
    .slice(0, 6);
  const timeline = selected.items
    .filter((item) => item.status !== "看过的剧" && item.status !== "暂停/弃剧")
    .sort((a, b) => String(a.airTime || "23:59").localeCompare(String(b.airTime || "23:59")));

  return (
    <section className="watch-shell">
      <section className="watch-calendar">
        <div className="panel-head">
          <h2>{monthTitle(selected.date)}</h2>
          <button className="calendar-toggle" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "⌃" : "⌄"}</button>
        </div>
        <div className={expanded ? "week-grid month-grid" : "week-grid"}>
          {calendarDays.map((day) => (
            <button className={`${day.dateKey === selectedDate ? "week-day active" : "week-day"} ${day.inMonth === false ? "outside-month" : ""}`} type="button" key={day.dateKey} onClick={() => setSelectedDate(day.dateKey)}>
              <span>{weekdayText(day.date)}</span>
              <strong>{day.date.getDate()}</strong>
              <i className={day.updates.length ? "has-update" : ""} />
              {day.updates.length > 0 && (
                <small className="day-updates">
                  {expanded ? `${day.updates.length} 部更新` : day.updates.slice(0, 1).map((item) => item.title).join("")}
                  {!expanded && day.updates.length > 1 ? ` +${day.updates.length - 1}` : ""}
                </small>
              )}
            </button>
          ))}
        </div>
      </section>
      <section className="watch-list">
        <div className="panel-head">
          <h2>正在追的剧</h2>
          <span className="tag">{activeWatchItems.length} 部</span>
        </div>
        <div className="watch-list-grid">
          {activeWatchItems.length === 0 && <p className="empty">还没有正在追的剧。可以从下面搜索影视，点击结果加入观影列表。</p>}
          {activeWatchItems.map((item) => (
            <article className="watch-list-card" key={item.id}>
              <div className="poster-box">
                {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
              </div>
              <div>
                <strong>{item.title}</strong>
                <p>{[item.status || "想看的剧", item.platform || item.source, item.nextAirDate ? `下次 ${item.nextAirDate}` : "", item.currentEpisode ? `第 ${item.currentEpisode} 集` : ""].filter(Boolean).join(" · ")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="watch-timeline">
        {timeline.length === 0 && <p className="empty">这一天还没有追剧更新。给剧集填写“下次更新日期”和“更新时间”后，会显示在这里。</p>}
        {timeline.map((item) => {
          const current = Number(item.currentEpisode || 0);
          const total = Number(item.totalEpisodes || 0);
          const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
          return (
            <article className="watch-item" key={item.id}>
              <div className="timeline-dot" />
              <div className="watch-time">{weekdayText(selected.date)} {selected.dateKey.slice(5).replace("-", "/")} {item.airTime || "--:--"}</div>
              <div className="watch-card">
                <div className="poster-box">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
                </div>
                <div className="watch-info">
                  <div className="watch-title-row">
                    <strong>{item.title}</strong>
                    <small>{item.platform || "本地"}</small>
                  </div>
                  <p>{[item.year, item.type || "剧集", ...(item.tags || [])].filter(Boolean).join(" · ")}</p>
                  <div className="episode-line">
                    <span>第 {item.season || 1} 季</span>
                    <strong>{current || "--"} 集</strong>
                    {total > 0 && <span>共 {total} 集</span>}
                  </div>
                  {total > 0 && <div className="watch-progress"><i style={{ width: `${progress}%` }} /></div>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <section className="tmdb-recommendations">
        <div className="panel-head">
          <div>
            <h2>影视资源推荐</h2>
            <p>{tmdbRecommendationStatus}</p>
          </div>
          <button className="chip-button" type="button" onClick={onLoadRecommendations}>刷新推荐</button>
        </div>
        {recommendationSections.map((section) => (
          <div className="tmdb-section" key={section.id}>
            <h3>{section.title}</h3>
            <div className="tmdb-poster-row">
              {(Array.isArray(section.items) ? section.items : []).map((item) => (
                <button className="tmdb-poster-card" type="button" key={`${section.id}-${item.tmdbId}`} onClick={() => onImportTmdb(item)}>
                  <div className="tmdb-poster">
                    {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
                  </div>
                  <strong>{item.title}</strong>
                  <small>{item.year || "暂无年份"}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="tmdb-panel">
        <div>
          <strong>搜索影视并加入观影列表</strong>
          <p>{tmdbStatus}</p>
        </div>
        <form className="tmdb-search" onSubmit={(event) => {
          event.preventDefault();
          onSearchTmdb(tmdbQuery);
        }}>
          <input value={tmdbQuery} onChange={(event) => setTmdbQuery(event.target.value)} placeholder="搜索剧名" />
          <button className="chip-button" type="submit">搜索</button>
        </form>
        <div className="tmdb-results">
          {searchResults.map((item) => (
            <button className="tmdb-result" type="button" key={`${item.type}-${item.tmdbId}`} onClick={() => onImportTmdb(item)}>
              {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
              <strong>{item.title}</strong>
              <small>{[item.year, item.type].filter(Boolean).join(" · ")}</small>
            </button>
          ))}
        </div>
      </section>
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
      type: String(data.get("type") || "剧集"),
      status: String(data.get("status") || "想看的剧"),
      rating: String(data.get("rating") || ""),
      platform: String(data.get("platform") || ""),
      year: String(data.get("year") || ""),
      nextAirDate: String(data.get("nextAirDate") || ""),
      airTime: String(data.get("airTime") || ""),
      season: String(data.get("season") || "1"),
      currentEpisode: String(data.get("currentEpisode") || ""),
      totalEpisodes: String(data.get("totalEpisodes") || ""),
      posterUrl: String(data.get("posterUrl") || ""),
      watchedDate: String(data.get("watchedDate") || ""),
      review: String(data.get("review") || ""),
      tags: splitTags(data.get("tags")),
      note: String(data.get("note") || ""),
      time: item?.time || nowText(),
    });
    event.currentTarget.reset();
    onCancel?.();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{item ? "编辑观影" : "新增观影"}</h2>
        {item && <button className="chip-button" type="button" onClick={onCancel}>取消编辑</button>}
      </div>
      <form className="stack-form" onSubmit={submit}>
        <input name="title" defaultValue={item?.title || ""} placeholder="剧名 / 电影名 / 动漫名" required />
        <div className="inline-fields">
          <select name="status" defaultValue={item?.status || "想看的剧"}>{consultationStatuses.map((item) => <option key={item}>{item}</option>)}</select>
          <select name="type" defaultValue={item?.type || "剧集"}><option>剧集</option><option>电影</option><option>动漫</option><option>纪录片</option><option>综艺</option></select>
        </div>
        <div className="inline-fields">
          <input name="year" defaultValue={item?.year || ""} placeholder="年份，例如 2026" />
          <input name="platform" defaultValue={item?.platform || item?.source || ""} placeholder="平台 / 来源" />
        </div>
        <div className="inline-fields">
          <input name="nextAirDate" type="date" defaultValue={item?.nextAirDate || ""} />
          <input name="airTime" type="time" defaultValue={item?.airTime || ""} />
        </div>
        <div className="inline-fields">
          <input name="season" defaultValue={item?.season || "1"} placeholder="第几季" />
          <input name="currentEpisode" defaultValue={item?.currentEpisode || ""} placeholder="当前集数" />
        </div>
        <div className="inline-fields">
          <select name="rating" defaultValue={item?.rating || ""}>
            <option value="">暂不评分</option>
            <option value="10">10 分</option>
            <option value="9">9 分</option>
            <option value="8">8 分</option>
            <option value="7">7 分</option>
            <option value="6">6 分</option>
            <option value="5">5 分</option>
            <option value="4">4 分及以下</option>
          </select>
          <input name="watchedDate" type="date" defaultValue={item?.watchedDate || ""} />
        </div>
        <div className="inline-fields">
          <input name="totalEpisodes" defaultValue={item?.totalEpisodes || ""} placeholder="总集数" />
          <input name="posterUrl" defaultValue={item?.posterUrl || ""} placeholder="海报图片链接，可选" />
        </div>
        <input name="tags" defaultValue={(item?.tags || []).join(",")} placeholder="类型标签，例如 修仙,悬疑,科幻" />
        <textarea name="review" rows="4" defaultValue={item?.review || item?.conclusion || ""} placeholder="评价、打分理由、推荐点或避雷点" />
        <input name="note" defaultValue={item?.note || item?.nextAction || ""} placeholder="下一步，例如 看第 3 集 / 等第二季 / 补原著" />
        <button type="submit">{item ? "保存修改" : "保存观影"}</button>
      </form>
    </section>
  );
}

function ConsultationList({ consultations, onDelete, onEdit }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredConsultations = consultations.filter((item) =>
    (status === "all" || item.status === status) &&
    itemMatchesQuery(item, query, ["title", "type", "status", "rating", "platform", "tags", "review", "note", "source", "conclusion"]),
  );

  return (
    <section className="panel">
      <div className="panel-head"><h2>观影记录</h2><span className="tag">{filteredConsultations.length}/{consultations.length} 部</span></div>
      <div className="filter-panel">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索剧名、评价、平台、标签" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">全部分类</option>
          {consultationStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="record-list">
        {consultations.length === 0 && <p className="empty">还没有观影记录，先添加一部想看的剧。</p>}
        {consultations.length > 0 && filteredConsultations.length === 0 && <p className="empty">没有匹配的观影记录。</p>}
        {filteredConsultations.map((item) => (
          <article className="record" key={item.id}>
            <div className="record-head"><strong>{item.title}</strong><span>{item.status || "想看的剧"}</span></div>
            <p className="record-meta">{[item.year, item.type || "剧集", item.rating ? `${item.rating} 分` : "", item.platform || item.source, item.nextAirDate ? `更新 ${item.nextAirDate} ${item.airTime || ""}` : "", item.currentEpisode ? `第 ${item.currentEpisode} 集` : "", item.totalEpisodes ? `共 ${item.totalEpisodes} 集` : "", item.watchedDate, ...(item.tags || [])].filter(Boolean).join(" · ")}</p>
            {(item.review || item.conclusion) && <p><strong>评价：</strong>{item.review || item.conclusion}</p>}
            {(item.note || item.nextAction) && <p><strong>后续：</strong>{item.note || item.nextAction}</p>}
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
  const [ponyTheme, setPonyTheme] = useState("rmb");
  const [tmdbResults, setTmdbResults] = useState([]);
  const [tmdbStatus, setTmdbStatus] = useState("输入剧名搜索，点击结果即可加入观影列表");
  const [tmdbSections, setTmdbSections] = useState([]);
  const [tmdbRecommendationStatus, setTmdbRecommendationStatus] = useState("正在准备热门影视推荐");

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
      const merged = mergeCloudWithLocal(await loadCloudItems(nextSession));
      applyCloud(merged);
      await Promise.all([
        saveCloudItem(nextSession, "notes", merged.notes),
        saveCloudItem(nextSession, "plans", merged.plans),
        saveCloudItem(nextSession, "consultations", merged.consultations),
        saveCloudItem(nextSession, "habits", merged.habits),
        saveCloudItem(nextSession, `done:${todayKey()}`, merged[`done:${todayKey()}`]),
        saveCloudItem(nextSession, "assets", merged.assets),
      ]);
      setSyncStatus(`云同步已连接 · ${nowText()}`);
      loadTmdbRecommendations();
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
    setPonyTheme(ponyThemes.some((theme) => theme.id === localStorage.getItem(key("ponyTheme"))) ? localStorage.getItem(key("ponyTheme")) : "rmb");
    setClock(nowText());
    loadTmdbRecommendations();
    const timer = setInterval(() => setClock(nowText()), 30000);

    if (supabase && localStorage.getItem(key("accessUnlocked")) === "true") {
      setSession(fixedSession);
      syncFromCloud(fixedSession);
    }

    return () => {
      clearInterval(timer);
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

  function changePonyTheme(theme) {
    setPonyTheme(theme);
    localStorage.setItem(key("ponyTheme"), theme);
  }

  async function loadTmdbRecommendations() {
    setTmdbRecommendationStatus("正在加载热门影视...");
    try {
      const response = await fetch("/api/tmdb/recommendations");
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || "推荐加载失败");
      setTmdbSections(Array.isArray(data.sections) ? data.sections : []);
      setTmdbRecommendationStatus("来自 TMDB 的每日热门推荐");
    } catch (error) {
      setTmdbRecommendationStatus(error.message || "推荐暂时不可用，请点刷新推荐重试");
    }
  }

  async function searchTmdb(query) {
    const keyword = query.trim();
    if (!keyword) return;
    setTmdbStatus("正在搜索 TMDB...");
    try {
      const response = await fetch(`/api/tmdb/search?query=${encodeURIComponent(keyword)}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || data.status_message || "搜索失败");
      setTmdbResults(Array.isArray(data.results) ? data.results : []);
      setTmdbStatus(`找到 ${data.results?.length || 0} 条结果，点击卡片即可加入观影列表`);
    } catch (error) {
      setTmdbStatus(`TMDB 搜索暂时失败：${error.message || "请稍后重试"}`);
    }
  }

  function importTmdb(item) {
    const nextItem = {
      id: crypto.randomUUID(),
      ...item,
      status: "想看的剧",
      rating: "",
      watchedDate: "",
      season: "1",
      currentEpisode: "",
      totalEpisodes: "",
      time: nowText(),
    };
    const next = [nextItem, ...consultations];
    setConsultations(next);
    persist("consultations", next);
    setTmdbStatus(`已加入：${item.title}`);
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
      "## 观影记录",
      ...consultations.map((item) => `### ${item.title}\n\n分类：${item.status || "想看的剧"}\n\n类型：${item.type || "剧集"}\n\n评分：${item.rating || "未评分"}\n\n平台：${item.platform || item.source || ""}\n\n评价：${item.review || item.conclusion || ""}\n\n后续：${item.note || item.nextAction || ""}\n`),
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

  async function login(accessCode) {
    if (!supabase) return;
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "访问码验证失败");
      localStorage.setItem(key("accessUnlocked"), "true");
      setSession(fixedSession);
      await syncFromCloud(fixedSession);
    } catch (error) {
      setSyncStatus(error.message || "访问码验证失败");
    }
  }

  async function logout() {
    localStorage.removeItem(key("accessUnlocked"));
    setSession(null);
    setSyncStatus("已锁定，本机继续本地保存");
  }

  function cancelEditing() {
    setEditing(null);
  }

  const sortedRecent = [...recent].sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
  const skillSummaries = [
    { id: "today", name: "今日速看", icon: "home", badge: "首页", summary: `计划 ${stats.plans} · 签到 ${stats.checkin}` },
    { id: "plans", name: "每日安排", icon: "checklist", badge: "待办", summary: `${todayPlans.length} 条待办` },
    { id: "notes", name: "灵感记录", icon: "note", badge: "记录", summary: `${notes.length} 条记录` },
    { id: "market", name: "股市行情", icon: "trend", badge: "行情", summary: "金价、指数、自选股" },
    { id: "calendar", name: "日历行程", icon: "calendar", badge: "习惯", summary: `${habits.length} 个习惯` },
    { id: "consultations", name: "观影记录", icon: "chat", badge: "观影", summary: `${stats.consultations} 条` },
    { id: "settings", name: "数据设置", icon: "settings", badge: "备份", summary: session ? "云同步在线" : "本地模式" },
  ];

  return (
    <main className={`phone-shell ${displayMode === "desktop" ? "desktop-shell" : "mobile-shell"} page-${activePage} pony-theme-${ponyTheme}`}>
      <div className="phone-status">
        <strong>{clock}</strong>
        <span>{session ? "云同步在线" : "本地模式"}</span>
      </div>
      <section className="app-body">
        <nav className="side-nav" aria-label="工作台导航">
          <button className="profile-button" type="button" onClick={() => setOverviewOpen(true)} aria-label="打开技能总览">
            <span className="avatar-mark"><CultivationAvatar /></span>
            <strong>七夜工作台</strong>
          </button>
          <div className="side-nav-list">
            {pages.filter((page) => page.id !== "settings").map((page) => (
              <button className={`nav-item ${activePage === page.id ? "active" : ""}`} type="button" key={page.id} onClick={() => switchPage(page.id)}>
                <span className="nav-symbol"><AnimeNavIcon name={page.icon} /></span>
                <small>{page.name}</small>
              </button>
            ))}
          </div>
          <div className="side-nav-bottom">
            <button className={`nav-item settings-nav-item ${activePage === "settings" ? "active" : ""}`} type="button" onClick={() => switchPage("settings")}>
              <span className="nav-symbol"><AnimeNavIcon name="settings" /></span>
              <small>设置</small>
            </button>
            <button className="more-button" type="button" onClick={() => setOverviewOpen(true)} aria-label="更多技能">...</button>
          </div>
        </nav>

        <section className="work-area">
          <div className="day-line"><span>📅</span><strong>{todayKey()}（今天）</strong></div>

          <header className="module-head">
            <div className="module-title-row">
              <span className="module-icon"><WorkbenchIcon name={pages.find((page) => page.id === activePage)?.icon || "spark"} /></span>
              <div>
                <h1>{pageNames[activePage]}</h1>
                <p>{pageDescriptions[activePage]}</p>
              </div>
              <button className="date-pill" type="button" onClick={toggleDisplayMode}>{displayMode === "desktop" ? "手机端" : "网页端"}</button>
            </div>
            <div className="module-tabs" aria-label="内容切换">
              <button className="active" type="button">今日内容</button>
              <button type="button">历史记录</button>
            </div>
          </header>

        <section className="content">
          {activePage === "today" && (
            <>
              <section className="hero-card">
                <span><WorkbenchIcon name="spark" /></span>
                <div>
                  <small>今日工作台</small>
                  <h2>先抓住今天最重要的几件事</h2>
                  <p>天气、计划、签到、行情和最近整理，集中在这一屏。</p>
                  <div className="hero-actions">
                    <button type="button" onClick={() => switchPage("plans")}>写计划</button>
                    <button type="button" onClick={() => switchPage("notes")}>记一笔</button>
                  </div>
                </div>
              </section>
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
                  <QuickAction label="观影记录" onClick={() => switchPage("consultations")} />
                  <QuickAction label="查看日历" onClick={() => switchPage("calendar")} />
                </div>
              </section>
              <section className="stats-grid">
                <StatButton label="今日计划" value={stats.plans} onClick={() => switchPage("plans")} />
                <StatButton label="今日签到" value={stats.checkin} onClick={() => switchPage("calendar")} />
                <StatButton label="记录总数" value={stats.notes} onClick={() => switchPage("notes")} />
                <StatButton label="追剧清单" value={`${stats.consultations} 部`} onClick={() => switchPage("consultations")} />
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
              <WatchSchedule
                items={consultations}
                tmdbResults={tmdbResults}
                tmdbStatus={tmdbStatus}
                tmdbSections={tmdbSections}
                tmdbRecommendationStatus={tmdbRecommendationStatus}
                onSearchTmdb={searchTmdb}
                onImportTmdb={importTmdb}
                onLoadRecommendations={loadTmdbRecommendations}
              />
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
              <PonyThemePanel value={ponyTheme} onChange={changePonyTheme} />
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
                <h2>手机同步</h2>
                <p className="empty">手机打开同一个网址，进入“设置”，输入固定访问码解锁云同步。解锁后点“同步”，电脑和手机就会使用同一份云端数据。</p>
              </section>
            </>
          )}
        </section>

        </section>
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
