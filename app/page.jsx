"use client";

import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const storagePrefix = "qiyeworkbench:";
const statePage = "app_state";
const pages = [
  { id: "today", name: "今日速看", icon: "home" },
  { id: "consultations", name: "观影记录", icon: "chat" },
  { id: "market", name: "股市行情", icon: "trend" },
  { id: "diet", name: "饮食记录", icon: "food" },
  { id: "news", name: "热榜时讯", icon: "news" },
  { id: "plans", name: "每日安排", icon: "checklist" },
  { id: "settings", name: "设置", icon: "settings" },
];
const pageNames = Object.fromEntries(pages.map((page) => [page.id, page.name]));
const pageDescriptions = {
  today: "时间、天气、计划和行情集中整理",
  plans: "习惯打卡、任务安排和纪念日倒数",
  market: "金价、指数、自选资产观察",
  diet: "每日喝水、饮食热量和最近趋势",
  news: "微博、B站、抖音等热榜集中查看",
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
const anniversaryTypes = [
  { id: "countdown", label: "倒数日", note: "未来值得期待的日子" },
  { id: "memory", label: "纪念日", note: "过去值得纪念的日子" },
  { id: "birthday", label: "生日", note: "重要的人的生日" },
  { id: "festival", label: "节日", note: "仪式感的节日" },
];
const defaultChineseHolidays2026 = [
  { id: "holiday-2026-new-year", title: "2026 元旦假期（1/1-1/3）", date: "2026-01-01", type: "festival", calendarType: "solar" },
  { id: "holiday-2026-spring-festival", title: "2026 春节假期（2/15-2/23）", date: "2026-02-15", type: "festival", calendarType: "solar" },
  { id: "holiday-2026-qingming", title: "2026 清明节假期（4/4-4/6）", date: "2026-04-04", type: "festival", calendarType: "solar" },
  { id: "holiday-2026-labor-day", title: "2026 劳动节假期（5/1-5/5）", date: "2026-05-01", type: "festival", calendarType: "solar" },
  { id: "holiday-2026-dragon-boat", title: "2026 端午节假期（6/19-6/21）", date: "2026-06-19", type: "festival", calendarType: "solar" },
  { id: "holiday-2026-mid-autumn", title: "2026 中秋节假期（9/25-9/27）", date: "2026-09-25", type: "festival", calendarType: "solar" },
  { id: "holiday-2026-national-day", title: "2026 国庆节假期（10/1-10/7）", date: "2026-10-01", type: "festival", calendarType: "solar" },
];
const legacyDefaultAssets = "SGE_AU9999,s_sh000001,s_sz399001,sh600519,sz300750";
const stockDefaultAssets = "sh600584,sh603629,sh688507";
const defaultAssets = "hf_GC,sh603629,sh688507";
const marketSymbolNames = {
  hf_GC: "COMEX黄金",
  sh600584: "长电科技",
  sh603629: "利通电子",
  sh688507: "索辰科技",
};
const fixedSession = { user: { id: "personal-workbench", email: "固定访问码已解锁" } };
const defaultChineseHolidaysSeedKey = "defaultChineseHolidays2026Seeded";
const marketCacheVersion = 3;
const defaultWaterTarget = 2000;
const cupSize = 250;
const foodCalories = [
  ["鸡蛋", 70],
  ["牛奶", 150],
  ["豆浆", 120],
  ["酸奶", 120],
  ["米饭", 230],
  ["粥", 120],
  ["面条", 350],
  ["馒头", 220],
  ["包子", 220],
  ["面包", 180],
  ["吐司", 90],
  ["油条", 250],
  ["饺子", 420],
  ["鸡胸肉", 180],
  ["牛肉", 250],
  ["猪肉", 300],
  ["鱼", 180],
  ["虾", 120],
  ["豆腐", 120],
  ["青菜", 60],
  ["西兰花", 70],
  ["土豆", 160],
  ["玉米", 180],
  ["香蕉", 100],
  ["苹果", 80],
  ["橙子", 70],
  ["咖啡", 20],
  ["奶茶", 350],
];

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
    food: (
      <>
        <path d="M6 3v7" />
        <path d="M9 3v7" />
        <path d="M4.5 10h6" />
        <path d="M7.5 10v11" />
        <path d="M16 3c2 1.7 3 4.1 3 7.2V21" />
        <path d="M16 3v18" />
      </>
    ),
    wear: (
      <>
        <path d="M9 4l3 2 3-2 4 3-2.2 3.2V20H7.2V10.2L5 7z" />
        <path d="M10 5.2c.5 1 1.2 1.5 2 1.5s1.5-.5 2-1.5" />
        <path d="M7.2 10.2 9 11.5" />
        <path d="M16.8 10.2 15 11.5" />
      </>
    ),
    news: (
      <>
        <path d="M5 5h11v14H5z" />
        <path d="M16 8h3v10a1 1 0 0 1-1 1h-2z" />
        <path d="M8 9h5" />
        <path d="M8 12h5" />
        <path d="M8 15h3" />
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
    food: (
      <>
        <path className="anime-shadow" d="M6 4h5v7c0 1.8-1.1 3.2-2.5 3.6V22h-2v-7.4C5.1 14.2 4 12.8 4 11V4h2v6h1V4h2v6h1V4z" />
        <path className="anime-main" d="M6 4h4v7c0 1.4-.9 2.4-2 2.4S6 12.4 6 11z" />
        <path className="anime-accent" d="M16 3c2.2 1.8 3.4 4.6 3.4 8.1 0 2.1-.8 3.4-2.1 4V22h-2.2V3z" />
        <path className="anime-light" d="M17 6.5c.7 1.1 1 2.5 1 4.1 0 1.2-.2 2-.7 2.4z" />
      </>
    ),
    wear: (
      <>
        <path className="anime-shadow" d="M8 4 12 7l4-3 4 3.2-2.3 4V21H6.3v-9.8L4 7.2z" />
        <path className="anime-main" d="M8.2 5.2 12 8l3.8-2.8 2.4 2-1.8 3.3V19H7.6v-8.5L5.8 7.2z" />
        <path className="anime-light" d="M10 6.6c.5 1 1.2 1.6 2 1.6s1.5-.6 2-1.6v4.2h-4z" />
        <path className="anime-accent" d="M7.6 11.2 9.4 13l-1.8 1.2zm8.8 0L14.6 13l1.8 1.2z" />
      </>
    ),
    news: (
      <>
        <path className="anime-shadow" d="M5 4h12c1.3 0 2.2.9 2.2 2.2V20H6.8A2.8 2.8 0 0 1 4 17.2V5c0-.6.4-1 1-1z" />
        <path className="anime-main" d="M6 5.5h10.5V19H6z" />
        <path className="anime-accent" d="M8 8h6.5v3H8z" />
        <path className="anime-light" d="M8 13h7v1.5H8zM8 16h5v1.5H8z" />
        <circle className="anime-dot" cx="18" cy="6" r="2" />
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

function clockText(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayDisplay(date = new Date()) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}`;
}

function daysUntil(dateKey) {
  const today = new Date(todayKey());
  const target = new Date(dateKey);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}

function anniversaryMeta(item) {
  const original = new Date(item.date);
  const today = new Date(todayKey());
  if (Number.isNaN(original.getTime())) return { elapsed: null, nextDays: null, nextDate: "" };
  const elapsed = Math.floor((today - original) / (24 * 60 * 60 * 1000));
  let next = new Date(today.getFullYear(), original.getMonth(), original.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, original.getMonth(), original.getDate());
  return {
    elapsed,
    nextDays: Math.ceil((next - today) / (24 * 60 * 60 * 1000)),
    nextDate: todayKey(next),
  };
}

function parseFoodCount(value) {
  if (!value) return 1;
  const normalized = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }[value];
  return normalized || Number(value) || 1;
}

function estimateMealCalories(title) {
  const text = title.trim();
  if (!text) return { calories: 0, matched: [] };
  const matched = foodCalories
    .filter(([name]) => text.includes(name))
    .map(([name, calories]) => {
      const countMatch = text.match(new RegExp(`([一两二三四五六七八九十\\d]+)\\s*(个|颗|杯|碗|份|根|片)?\\s*${name}|${name}\\s*([一两二三四五六七八九十\\d]+)\\s*(个|颗|杯|碗|份|根|片)?`));
      const count = parseFoodCount(countMatch?.[1] || countMatch?.[3]);
      return { name, count, calories: calories * count };
    });
  return {
    calories: matched.reduce((sum, item) => sum + item.calories, 0),
    matched,
  };
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

function weatherLabel(code) {
  if (code === 0) return "晴";
  if ([1, 2, 3].includes(code)) return "多云";
  if ([45, 48].includes(code)) return "有雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "小雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "降雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "降雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "天气";
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
  return `${["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"][date.getMonth()]} ${date.getFullYear()}`;
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

function withDefaultChineseHolidays(items) {
  const existingIds = new Set(items.map((item) => item.id));
  const missing = defaultChineseHolidays2026.filter((item) => !existingIds.has(item.id));
  return missing.length ? [...missing, ...items] : items;
}

function mergeCloudWithLocal(cloud) {
  const localAssets = localStorage.getItem(key("assets"));
  return {
    notes: mergeById(readStorage("notes", []), cloud.notes),
    plans: mergeById(readStorage("plans", []), cloud.plans),
    consultations: dedupeConsultations(mergeById(readStorage("consultations", []), cloud.consultations)),
    dietRecords: mergeById(readStorage("dietRecords", []), cloud.dietRecords),
    anniversaries: mergeById(readStorage("anniversaries", []), cloud.anniversaries),
    waterTarget: Number(cloud.waterTarget || readStorage("waterTarget", defaultWaterTarget)) || defaultWaterTarget,
    habits: mergeById(readStorage("habits", readStorage("checkins", [])), cloud.habits || cloud.checkins),
    [`done:${todayKey()}`]: {
      ...readStorage(`done:${todayKey()}`, {}),
      ...(cloud[`done:${todayKey()}`] || {}),
    },
    assets: typeof cloud.assets === "string" ? cloud.assets : normalizeSavedAssets(localAssets),
  };
}

function normalizeSavedAssets(assets) {
  return !assets || assets === legacyDefaultAssets || assets === stockDefaultAssets ? defaultAssets : assets;
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

function QuickAction({ label, icon, onClick }) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span className="quick-action-icon"><AnimeNavIcon name={icon} /></span>
      <span>{label}</span>
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

function WeatherCard({ compact = false, clock = "--:--" }) {
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
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=31.4912&longitude=120.3119&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=5");
      const data = await response.json();
      const forecast = (data.daily?.time || []).map((date, index) => ({
        date,
        code: data.daily?.weather_code?.[index],
        max: data.daily?.temperature_2m_max?.[index],
        min: data.daily?.temperature_2m_min?.[index],
        rain: data.daily?.precipitation_probability_max?.[index],
      }));
      const next = {
        savedAt: Date.now(),
        location: "无锡",
        current: data.current?.temperature_2m,
        code: data.current?.weather_code,
        wind: data.current?.wind_speed_10m,
        max: forecast[0]?.max,
        min: forecast[0]?.min,
        rain: forecast[0]?.rain,
        forecast,
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
        <div>
          <span>{weather?.location || "无锡"} · {todayKey()} · {clock}</span>
          <strong>{weather ? `${weather.current ?? "--"}°` : "--"}</strong>
          <small>{weather ? `${weatherLabel(weather.code)} · ${weather.min ?? "--"}° / ${weather.max ?? "--"}° · 降水 ${weather.rain ?? "--"}%` : "正在读取无锡天气"}</small>
        </div>
        <b className="weather-badge">
          <span>{weatherIcon(weather?.code)}</span>
          <small>{weather ? weatherLabel(weather.code) : "天气"}</small>
        </b>
      </div>
      <div className="weather-forecast">
        {(weather?.forecast || []).slice(0, 5).map((day) => (
          <div key={day.date}>
            <span>{day.date.slice(5).replace("-", "/")}</span>
            <strong>{weatherLabel(day.code)}</strong>
            <small>{day.min ?? "--"}°/{day.max ?? "--"}°</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function weatherIcon(code) {
  if ([0, 1].includes(Number(code))) return "☀️";
  if ([2, 3].includes(Number(code))) return "☁️";
  if ([45, 48].includes(Number(code))) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(code))) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(Number(code))) return "❄️";
  if ([95, 96, 99].includes(Number(code))) return "⛈️";
  return "🌤️";
}

function outfitAdvice(day) {
  const max = Number(day?.max ?? 0);
  const min = Number(day?.min ?? 0);
  const rain = Number(day?.rain ?? 0);
  const label = weatherLabel(day?.code);
  const items = [];
  let title = "轻便通勤";

  if (max >= 32) {
    title = "清爽防晒";
    items.push("速干短袖", "轻薄短裤或工装长裤", "遮阳帽或防晒衣");
  } else if (max >= 26) {
    title = "夏季舒适";
    items.push("短袖 T 恤", "薄款休闲裤", "透气运动鞋");
  } else if (max >= 20) {
    title = "薄外套搭配";
    items.push("长袖 T 恤或衬衫", "轻薄夹克", "直筒休闲裤");
  } else if (max >= 12) {
    title = "保暖层次";
    items.push("卫衣或毛衣", "夹克或风衣", "牛仔裤/工装裤");
  } else {
    title = "冬季保暖";
    items.push("保暖内搭", "羽绒服或厚外套", "长裤和围巾");
  }

  if (min <= 18 && max - min >= 7) items.push("早晚加一件外套");
  if (rain >= 45 || label.includes("雨")) items.push("带伞，鞋子选防滑");

  return {
    title,
    items,
    note: `无锡今日 ${label}，${min ?? "--"}° / ${max ?? "--"}°，降水概率 ${rain || 0}%。`,
  };
}

function ClothingAssistant() {
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState("正在读取无锡天气...");

  async function loadWearWeather(force = false) {
    const cache = readStorage("wearWeatherCache", null);
    if (!force && cache && Date.now() - cache.savedAt < 30 * 60 * 1000) {
      setWeather(cache);
      setStatus(`天气缓存 · ${nowText(new Date(cache.savedAt))}`);
      return;
    }

    try {
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=31.4912&longitude=120.3119&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=5");
      const data = await response.json();
      const forecast = (data.daily?.time || []).map((date, index) => ({
        date,
        code: data.daily?.weather_code?.[index],
        max: data.daily?.temperature_2m_max?.[index],
        min: data.daily?.temperature_2m_min?.[index],
        rain: data.daily?.precipitation_probability_max?.[index],
      }));
      const next = {
        savedAt: Date.now(),
        current: data.current?.temperature_2m,
        code: data.current?.weather_code,
        wind: data.current?.wind_speed_10m,
        forecast,
      };
      writeStorage("wearWeatherCache", next);
      setWeather(next);
      setStatus(`江苏无锡 · 已更新 ${nowText()}`);
    } catch {
      setStatus(cache ? `天气更新失败 · ${nowText(new Date(cache.savedAt))}` : "天气暂时不可用");
    }
  }

  useEffect(() => {
    loadWearWeather();
  }, []);

  const today = weather?.forecast?.[0];
  const advice = outfitAdvice(today);

  return (
    <section className="wear-shell">
      <div className="wear-title">
        <span>👕</span>
        <div>
          <h2>穿衣助手</h2>
          <p>定位：江苏无锡 · 最近五天天气 / 今日穿搭</p>
        </div>
      </div>

      <section className="wear-weather-card">
        <div>
          <span>{weatherIcon(weather?.code)}</span>
          <strong>{weather?.current ?? today?.max ?? "--"}°C</strong>
          <small>江苏无锡</small>
        </div>
        <div>
          <h2>{weatherLabel(weather?.code || today?.code)}</h2>
          <p>当前风速 {weather?.wind ?? "--"} km/h</p>
          <button className="chip-button" type="button" onClick={() => loadWearWeather(true)}>刷新</button>
        </div>
      </section>

      <section className="wear-card">
        <div className="panel-head">
          <div>
            <h2>最近五天天气</h2>
            <p>{status}</p>
          </div>
        </div>
        <div className="wear-forecast">
          {(weather?.forecast || []).map((day, index) => (
            <div key={day.date}>
              <span>{index === 0 ? "今天" : day.date.slice(5).replace("-", "/")}</span>
              <b>{weatherIcon(day.code)}</b>
              <strong>{day.min ?? "--"}°/{day.max ?? "--"}°</strong>
              <small>{weatherLabel(day.code)} · {day.rain ?? 0}%</small>
            </div>
          ))}
        </div>
      </section>

      <section className="wear-card outfit-card">
        <div className="panel-head">
          <div>
            <h2>今日穿搭 · {todayKey()}</h2>
            <p>{advice.note}</p>
          </div>
        </div>
        <div className="outfit-main">
          <span>👕</span>
          <div>
            <strong>{advice.title}</strong>
            <p>{advice.items.join(" / ")}</p>
          </div>
        </div>
        <div className="outfit-tags">
          {advice.items.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
    </section>
  );
}

const newsTabs = [
  { id: "weibo", label: "微博热搜", icon: "🔥" },
  { id: "bilibili", label: "B站热搜", icon: "📺" },
  { id: "douyin", label: "抖音热搜", icon: "🎵" },
  { id: "sina", label: "新浪热榜", icon: "📰" },
  { id: "weread", label: "微信读书", icon: "📚" },
  { id: "history", label: "历史上的今天", icon: "📜" },
];

function NewsBoard() {
  const [category, setCategory] = useState("weibo");
  const [news, setNews] = useState([]);
  const [status, setStatus] = useState("正在读取新闻...");
  const [error, setError] = useState("");

  async function loadNews(nextCategory = category, force = false) {
    const cacheKey = `newsCache:${nextCategory}`;
    const cache = readStorage(cacheKey, null);
    if (!force && cache && Date.now() - cache.savedAt < 10 * 60 * 1000) {
      setNews(cache.news || []);
      setStatus(`缓存新闻 · ${nowText(new Date(cache.savedAt))}`);
      return;
    }

    setStatus("正在更新新闻...");
    try {
      const response = await fetch(`/api/news?category=${encodeURIComponent(nextCategory)}`);
      const data = await response.json();
      const nextNews = Array.isArray(data.news) ? data.news : [];
      setError(data.error || "");
      setNews(nextNews);
      if (nextNews.length) writeStorage(cacheKey, { savedAt: Date.now(), news: nextNews });
      setStatus(`${data.source || "免费新闻源"} · ${nowText()}`);
    } catch {
      if (cache?.news) {
        setError("");
        setNews(cache.news);
        setStatus(`新闻更新失败，显示缓存 · ${nowText(new Date(cache.savedAt))}`);
      } else {
        setError("新闻接口暂时不可用，请稍后刷新。");
        setNews([]);
        setStatus("新闻暂时不可用");
      }
    }
  }

  useEffect(() => {
    loadNews(category);
  }, [category]);

  const activeTab = newsTabs.find((item) => item.id === category) || newsTabs[0];

  return (
    <section className="news-shell">
      <div className="news-title">
        <span>📰</span>
        <div>
          <h2>热榜时讯</h2>
          <p>微博 · B站 · 抖音 · 新浪 · 微信读书 · 历史上的今天</p>
        </div>
      </div>
      <div className="news-tabs">
        {newsTabs.map((item) => (
          <button className={category === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setCategory(item.id)}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>
      <section className="news-card">
        <div className="panel-head">
          <div>
            <h2>{activeTab.icon} {activeTab.label}</h2>
            <p>{status}</p>
          </div>
          <button className="chip-button" type="button" onClick={() => loadNews(category, true)}>刷新</button>
        </div>
        <div className="news-list">
          {error && <p className="news-error">{error}</p>}
          {news.length === 0 && <p className="empty">还没有新闻数据，请稍后刷新。</p>}
          {news.map((item, index) => (
            <a className="news-row" href={item.url || "#"} target="_blank" rel="noreferrer" key={`${item.title}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{[item.source, item.publishedAt ? item.publishedAt.slice(0, 16) : ""].filter(Boolean).join(" · ")}</small>
              </div>
            </a>
          ))}
        </div>
      </section>
    </section>
  );
}

function TodayTimePanel({ clock = "--:--:--" }) {
  return (
    <section className="today-time-panel" aria-label="今日时间">
      <strong>{clock}</strong>
      <span>{todayDisplay()}</span>
      <small>七夜online · 今日速递</small>
    </section>
  );
}

function DailyQuoteCard() {
  const fallbackQuote = {
    text: "人生没有白走的路，每一步都算数。",
    from: "本地备用",
    author: "",
  };
  const [quote, setQuote] = useState(fallbackQuote);
  const [status, setStatus] = useState("每日更新");

  useEffect(() => {
    const cacheKey = `dailyQuote:${todayKey()}`;
    const cache = readStorage(cacheKey, null);
    if (cache?.text) {
      setQuote(cache);
      setStatus("今日已更新");
      return;
    }

    fetch("/api/daily-quote")
      .then((response) => response.json())
      .then((data) => {
        const nextQuote = {
          text: data.text || fallbackQuote.text,
          from: data.from || fallbackQuote.from,
          author: data.author || "",
        };
        setQuote(nextQuote);
        writeStorage(cacheKey, nextQuote);
        setStatus("今日已更新");
      })
      .catch(() => {
        setStatus("使用本地备用");
      });
  }, []);

  const source = [quote.author, quote.from].filter(Boolean).join(" · ");

  return (
    <section className="daily-quote-card">
      <div className="panel-head">
        <h2>今日金句</h2>
        <span className="tag">{status}</span>
      </div>
      <strong>{quote.text}</strong>
      <p>{source || "每天给自己一句提醒"}</p>
    </section>
  );
}

function normalizeMarketQuote(quote) {
  const mappedName = marketSymbolNames[quote.symbol];
  const name = String(quote.name || "");
  const brokenName = !name || name.includes("�") || /^[\d.]+$/.test(name);
  return { ...quote, name: mappedName || (brokenName ? quote.symbol : name) };
}

function consultationKey(item) {
  if (item.tmdbId) return `tmdb:${item.tmdbId}`;
  return `title:${String(item.title || "").trim().toLowerCase()}`;
}

function dedupeConsultations(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = consultationKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeTmdbFields(item, fresh) {
  return {
    ...item,
    title: fresh.title || item.title,
    year: fresh.year || item.year,
    type: fresh.type || item.type,
    platform: fresh.platform || item.platform,
    tmdbId: fresh.tmdbId || item.tmdbId,
    tmdbMediaType: fresh.tmdbMediaType || item.tmdbMediaType,
    posterUrl: fresh.posterUrl || item.posterUrl,
    review: fresh.review || item.review,
    season: fresh.season || item.season || "1",
    currentEpisode: fresh.currentEpisode || item.currentEpisode || "",
    nextAirDate: fresh.nextAirDate || item.nextAirDate || "",
    updateEpisodes: fresh.updateEpisodes || item.updateEpisodes || "",
    episodeSchedule: Array.isArray(fresh.episodeSchedule) ? fresh.episodeSchedule : item.episodeSchedule || [],
    totalEpisodes: fresh.totalEpisodes || item.totalEpisodes || "",
    tags: fresh.tags?.length ? fresh.tags : item.tags,
    time: nowText(),
  };
}

function MarketBoard({ compact = false }) {
  const [quotes, setQuotes] = useState([]);
  const [status, setStatus] = useState("正在读取行情...");
  const [stockInput, setStockInput] = useState("");

  async function loadQuotes(force = false) {
    const savedAssets = localStorage.getItem(key("assets"));
    const assets = normalizeSavedAssets(savedAssets);
    if (savedAssets !== assets) {
      localStorage.setItem(key("assets"), assets);
      localStorage.removeItem(key("marketCache"));
    }
    const cache = readStorage("marketCache", null);
    if (!force && cache?.version === marketCacheVersion && Date.now() - cache.savedAt < 60000) {
      setQuotes((cache.quotes || []).map(normalizeMarketQuote));
      setStatus(`缓存行情 · ${nowText(new Date(cache.savedAt))}`);
      return;
    }

    setStatus(force ? "正在刷新行情..." : "正在读取行情...");
    try {
      const response = await fetch(`/api/market-quotes?symbols=${encodeURIComponent(assets)}`);
      const data = await response.json();
      const nextQuotes = Array.isArray(data.quotes) ? data.quotes.map(normalizeMarketQuote) : [];
      setQuotes(nextQuotes);
      writeStorage("marketCache", { version: marketCacheVersion, savedAt: Date.now(), quotes: nextQuotes });
      setStatus(`${nextQuotes.some((quote) => quote.source === "示例") ? "示例行情" : "行情已更新"} · ${nowText()}`);
    } catch {
      if (cache?.quotes) {
        setQuotes(cache.quotes.map(normalizeMarketQuote));
        setStatus(`行情更新失败，显示上次数据 · ${nowText(new Date(cache.savedAt))}`);
      } else {
        setStatus("行情暂时不可用");
      }
    }
  }

  function addStock(event) {
    event.preventDefault();
    const nextStock = stockInput.trim();
    if (!nextStock) return;

    const current = normalizeSavedAssets(localStorage.getItem(key("assets")))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === nextStock.toLowerCase())) {
      const next = [...current, nextStock].join(",");
      localStorage.setItem(key("assets"), next);
      localStorage.removeItem(key("marketCache"));
      setStockInput("");
      loadQuotes(true);
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
      {!compact && (
        <form className="market-add-form" onSubmit={addStock}>
          <input value={stockInput} onChange={(event) => setStockInput(event.target.value)} placeholder="添加股票代码，例如 600584" />
          <button className="chip-button" type="submit">添加</button>
        </form>
      )}
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

function DailyArrangement({ habits, done, tasks, anniversaries, onAddHabit, onToggleHabit, onDeleteHabit, onAddTask, onToggleTask, onDeleteTask, onAddAnniversary, onDeleteAnniversary }) {
  const unfinishedTasks = tasks.filter((task) => task.status !== "已完成").slice(0, 8);
  const sortedAnniversaries = [...anniversaries].sort((a, b) => (anniversaryMeta(a).nextDays ?? 99999) - (anniversaryMeta(b).nextDays ?? 99999));
  const isElapsedThisYear = (item) => {
    const meta = anniversaryMeta(item);
    return meta.nextDate ? new Date(meta.nextDate).getFullYear() > new Date().getFullYear() : false;
  };
  const sortByNextDays = (items) => [...items].sort((a, b) => (anniversaryMeta(a).nextDays ?? 99999) - (anniversaryMeta(b).nextDays ?? 99999));
  const renderAnniversaryCards = (items, type) => (
    <div className="anniversary-grid">
      {items.map((item) => {
        const meta = anniversaryMeta(item);
        const calendarLabel = item.calendarType === "lunar" ? "农历" : "公历";
        const highlightElapsed = type.id === "memory";
        return (
          <div className={`anniversary-card ${type.id}`} key={item.id}>
            <span>{item.date} · {calendarLabel}</span>
            <strong>{item.title}</strong>
            <div className="anniversary-days">
              <b>{highlightElapsed ? "已过" : "还有"} {highlightElapsed ? (meta.elapsed === null ? "--" : Math.max(0, meta.elapsed)) : (meta.nextDays === null ? "--" : meta.nextDays)} 天</b>
              <small>{highlightElapsed ? "下次还有" : "已过"} {highlightElapsed ? (meta.nextDays === null ? "--" : meta.nextDays) : (meta.elapsed === null ? "--" : Math.max(0, meta.elapsed))} 天</small>
            </div>
            <button type="button" onClick={() => onDeleteAnniversary(item.id)}>删除</button>
          </div>
        );
      })}
    </div>
  );
  const renderAnniversaryGroup = (items, type, emptyText) => {
    const activeItems = sortByNextDays(items.filter((item) => !isElapsedThisYear(item)));
    const elapsedItems = sortByNextDays(items.filter(isElapsedThisYear));
    return (
      <>
        {activeItems.length === 0 ? <p className="anniversary-empty">{emptyText}</p> : renderAnniversaryCards(activeItems, type)}
        {elapsedItems.length > 0 && (
          <details className="anniversary-archive">
            <summary>已过日期 {elapsedItems.length} 个</summary>
            {renderAnniversaryCards(elapsedItems, type)}
          </details>
        )}
      </>
    );
  };

  return (
    <section className="arrange-shell">
      <section className="arrange-card">
        <div className="panel-head">
          <div>
            <h2>习惯打卡</h2>
            <p>{todayKey()} · {Object.values(done).filter(Boolean).length}/{habits.length} 已完成</p>
          </div>
        </div>
        <form className="quick-form" onSubmit={onAddHabit}>
          <input name="title" placeholder="新增打卡项目，例如 早睡、运动、复盘" required />
          <button type="submit">添加</button>
        </form>
        <div className="arrange-list">
          {habits.length === 0 && <p className="empty">还没有习惯，先加一个每天想坚持的小事。</p>}
          {habits.map((habit) => (
            <div className="habit-row" key={habit.id}>
              <label>
                <input type="checkbox" checked={Boolean(done[habit.id])} onChange={() => onToggleHabit(habit.id)} />
                <span>{habit.title}</span>
              </label>
              <button type="button" onClick={() => onDeleteHabit(habit.id)}>删除</button>
            </div>
          ))}
        </div>
      </section>

      <section className="arrange-card">
        <div className="panel-head">
          <div>
            <h2>任务安排</h2>
            <p>记录近期工作，完成后勾掉即可。</p>
          </div>
        </div>
        <form className="task-form" onSubmit={onAddTask}>
          <input name="title" placeholder="近期要处理的工作" required />
          <input name="note" placeholder="备注，可选" />
          <button type="submit">添加任务</button>
        </form>
        <div className="arrange-list">
          {unfinishedTasks.length === 0 && <p className="empty">暂无未完成任务。</p>}
          {unfinishedTasks.map((task) => (
            <div className="task-row" key={task.id}>
              <label>
                <input type="checkbox" checked={task.status === "已完成"} onChange={() => onToggleTask(task.id)} />
                <span>{task.title}<small>{[task.note, task.date].filter(Boolean).join(" · ")}</small></span>
              </label>
              <button type="button" onClick={() => onDeleteTask(task.id)}>删除</button>
            </div>
          ))}
        </div>
      </section>

      <section className="arrange-card">
        <div className="panel-head">
          <div>
            <h2>纪念日</h2>
            <p>倒数重要日子还有多久到。</p>
          </div>
        </div>
        <form className="anniversary-form" onSubmit={onAddAnniversary}>
          <input name="title" placeholder="纪念日名称，例如 生日、考试、旅行" required />
          <div className="anniversary-fields">
            <input name="date" type="date" required />
            <select name="type" defaultValue="countdown">
              {anniversaryTypes.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}
            </select>
            <select name="calendarType" defaultValue="solar">
              <option value="solar">公历</option>
              <option value="lunar">农历</option>
            </select>
          </div>
          <button type="submit">添加纪念日</button>
        </form>
        <div className="anniversary-sections">
          {sortedAnniversaries.length === 0 && <p className="empty">还没有纪念日。</p>}
          {anniversaryTypes.map((type) => {
            const items = sortedAnniversaries.filter((item) => (item.type || "memory") === type.id);
            return (
              <section className="anniversary-section" key={type.id}>
                <div className="anniversary-section-head">
                  <div>
                    <strong>{type.label}</strong>
                    <span>{type.note}</span>
                  </div>
                  <b>{items.length}</b>
                </div>
                {items.length === 0 ? (
                  <p className="anniversary-empty">暂无{type.label}</p>
                ) : type.id === "birthday" ? (
                  <div className="birthday-groups">
                    {[
                      { id: "solar", label: "公历生日" },
                      { id: "lunar", label: "农历生日" },
                    ].map((group) => {
                      const birthdayItems = items.filter((item) => (item.calendarType || "solar") === group.id);
                      return (
                        <section className="birthday-group" key={group.id}>
                          <div className="birthday-group-head">
                            <strong>{group.label}</strong>
                            <span>{birthdayItems.length}</span>
                          </div>
                          {birthdayItems.length === 0 ? <p className="anniversary-empty">暂无{group.label}</p> : renderAnniversaryGroup(birthdayItems, type, `暂无未到的${group.label}`)}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  renderAnniversaryGroup(items, type, `暂无未到的${type.label}`)
                )}
              </section>
            );
          })}
        </div>
      </section>
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

function parseEpisodeList(value, fallbackEpisode) {
  const text = String(value || "").trim();
  if (!text) return fallbackEpisode ? [fallbackEpisode] : [];
  const range = text.match(/^(\d+)\s*[-~至到]\s*(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }
  return text
    .split(/[,，、\s]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function watchEntriesForDate(items, dateKey) {
  return items.flatMap((item) => {
    if (Array.isArray(item.episodeSchedule) && item.episodeSchedule.length) {
      return item.episodeSchedule
        .filter((episode) => episode.date === dateKey)
        .map((episode) => ({
          ...item,
          nextAirDate: episode.date,
          updateEpisode: episode.episode,
          episodeTitle: episode.title || "",
          season: episode.season || item.season,
        }));
    }

    if (item.nextAirDate !== dateKey) return [];
    const current = Number(item.currentEpisode || 0);
    const episodes = parseEpisodeList(item.updateEpisodes, current > 0 ? current + 1 : 0);
    return (episodes.length ? episodes : [0]).map((episode) => ({ ...item, updateEpisode: episode }));
  });
}

function dayUpdateLabel(updates, expanded) {
  const groups = updates.reduce((acc, item) => {
    const title = item.title || "";
    if (!title) return acc;
    acc.set(title, (acc.get(title) || 0) + 1);
    return acc;
  }, new Map());
  const grouped = Array.from(groups, ([title, count]) => ({ title, count }));
  if (expanded) return `${grouped.length || updates.length} 部更新`;
  const first = grouped[0];
  if (!first) return "";
  return `${first.title}${first.count > 1 ? ` ${first.count}集` : ""}${grouped.length > 1 ? ` +${grouped.length - 1}` : ""}`;
}

function mediaAirText(item) {
  if (!item?.airDate) return "播出日期待定";
  const [, month, day] = String(item.airDate).split("-");
  if (!month || !day) return item.airDate;
  return `${Number(month)}月${Number(day)}日 ${item.type === "电影" ? "上映" : "播出"}`;
}

function WatchSchedule({ items = [], activeView = "today", tmdbResults = [], tmdbStatus, tmdbSections = [], tmdbRecommendationStatus, onSearchTmdb, onImportTmdb, onLoadRecommendations, onSyncTmdbWatchlist, onRefreshTmdbTracked, onDeleteItem }) {
  const today = new Date();
  const [expanded, setExpanded] = useState(false);
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [movieSectionId, setMovieSectionId] = useState("movieNowPlaying");
  const [tvSectionId, setTvSectionId] = useState("tvPopular");
  const [recommendationMenuOpen, setRecommendationMenuOpen] = useState(false);
  const allItems = Array.isArray(items) ? items : [];
  const managedWatchItems = allItems.filter((item) => item.status !== "已归档");
  const searchResults = Array.isArray(tmdbResults) ? tmdbResults : [];
  const recommendationSections = Array.isArray(tmdbSections) ? tmdbSections : [];
  const visibleRecommendationSections = recommendationSections.length ? recommendationSections : [
    { id: "movieNowPlaying", title: "正在上映", items: [] },
    { id: "movieUpcoming", title: "即将上映", items: [] },
    { id: "tvPopular", title: "热门影视", items: [] },
    { id: "tvAiringToday", title: "今日播出", items: [] },
  ];
  const recommendationGroups = {
    movies: ["movieNowPlaying", "movieUpcoming"],
    tv: ["tvPopular", "tvAiringToday"],
  };
  const activeRecommendationOptions = (recommendationGroups[activeView] || [])
    .map((id) => visibleRecommendationSections.find((section) => section.id === id))
    .filter(Boolean);
  const selectedRecommendationId = activeView === "movies" ? movieSectionId : activeView === "tv" ? tvSectionId : "";
  const selectedRecommendationSection = activeRecommendationOptions.find((section) => section.id === selectedRecommendationId) || activeRecommendationOptions[0];
  const selectedRecommendationCount = Array.isArray(selectedRecommendationSection?.items) ? selectedRecommendationSection.items.length : 0;
  function selectRecommendationSection(id) {
    if (activeView === "movies") setMovieSectionId(id);
    if (activeView === "tv") setTvSectionId(id);
    setRecommendationMenuOpen(false);
  }
  function removeWatchItem(item) {
    if (!onDeleteItem) return;
    if (window.confirm(`确定把《${item.title}》移出片单吗？`)) onDeleteItem(item.id);
  }
  function itemsForDate(dateKey) {
    return watchEntriesForDate(allItems, dateKey);
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      items: [...itemsForDate(dateKey), ...allItems.filter((item) => item.watchedDate === dateKey)],
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
      items: [...itemsForDate(dateKey), ...allItems.filter((item) => item.watchedDate === dateKey)],
      updates: itemsForDate(dateKey),
    };
  });
  const calendarDays = expanded ? monthDays : week;
  const [selectedDate, setSelectedDate] = useState(week[0].dateKey);
  const selected = monthDays.find((day) => day.dateKey === selectedDate) || week[0];
  const timeline = selected.items
    .filter((item) => item.status !== "看过的剧" && item.status !== "暂停/弃剧")
    .flatMap((item) => {
      if (item.updateEpisode) return [item];
      const current = Number(item.currentEpisode || 0);
      const episodes = parseEpisodeList(item.updateEpisodes, current > 0 ? current + 1 : 0);
      return (episodes.length ? episodes : [0]).map((episode) => ({ ...item, updateEpisode: episode }));
    })
    .sort((a, b) => String(a.airTime || "23:59").localeCompare(String(b.airTime || "23:59")));

  return (
    <section className="watch-shell">
      {activeView === "today" && (
        <>
          <section className="tmdb-panel">
            <div>
              <strong>搜索影视</strong>
              <p>{tmdbStatus}</p>
            </div>
            <button className="tmdb-sync-button" type="button" onClick={onSyncTmdbWatchlist}>同步 TMDB 片单</button>
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
          <section className="watch-calendar">
            <div className="panel-head">
              <h2>{monthTitle(selected.date)}</h2>
              <div className="calendar-actions">
                <button className="chip-button" type="button" onClick={onRefreshTmdbTracked}>刷新更新</button>
                <button className="calendar-toggle" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "⌃" : "⌄"}</button>
              </div>
            </div>
            <div className={expanded ? "week-grid month-grid" : "week-grid"}>
              {calendarDays.map((day) => (
                <button className={`${day.dateKey === selectedDate ? "week-day active" : "week-day"} ${day.inMonth === false ? "outside-month" : ""}`} type="button" key={day.dateKey} onClick={() => setSelectedDate(day.dateKey)}>
                  <span>{weekdayText(day.date)}</span>
                  <strong>{day.date.getDate()}</strong>
                  <i className={day.updates.length ? "has-update" : ""} />
                  {day.updates.length > 0 && (
                    <small className="day-updates">
                      {dayUpdateLabel(day.updates, expanded)}
                    </small>
                  )}
                </button>
              ))}
            </div>
          </section>
          <div className="watch-timeline">
            {timeline.length === 0 && <p className="empty">这一天还没有追剧更新。给剧集填写“下次更新日期”和“更新时间”后，会显示在这里。</p>}
            {timeline.map((item) => {
              const updateEpisode = Number(item.updateEpisode || 0);
              const total = Number(item.totalEpisodes || 0);
              const progress = total > 0 && updateEpisode > 0 ? Math.min(100, Math.round((updateEpisode / total) * 100)) : 0;
              return (
                <article className="watch-item" key={`${item.id}-${updateEpisode || "next"}`}>
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
                        <strong>{updateEpisode ? `${updateEpisode} 集` : "-- 集"}</strong>
                        {total > 0 && <span>共 {total} 集</span>}
                      </div>
                      {total > 0 && <div className="watch-progress"><i style={{ width: `${progress}%` }} /></div>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <section className="watch-list-panel">
            <div className="panel-head">
              <div>
                <h2>我的片单</h2>
                <p>已加入 {managedWatchItems.length} 部，点移除可从待看片单删掉</p>
              </div>
            </div>
            <div className="watch-list">
              {managedWatchItems.length === 0 && <p className="empty">还没有加入影视，先搜索或从电影/电视剧里添加。</p>}
              {managedWatchItems.map((item) => (
                <article className="watch-list-row" key={item.id}>
                  <div className="watch-list-poster">
                    {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{[item.status, item.year, item.type || "剧集"].filter(Boolean).join(" · ")}</small>
                  </div>
                  <button type="button" onClick={() => removeWatchItem(item)}>移除</button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {selectedRecommendationSection && (
        <section className="tmdb-recommendations">
          <div className="panel-head">
            <div>
              <h2>{selectedRecommendationSection.title}</h2>
              <p>{tmdbRecommendationStatus}</p>
            </div>
            <div className="recommendation-actions">
              <div className={`recommendation-menu ${recommendationMenuOpen ? "open" : ""}`}>
                <button className="recommendation-menu-trigger" type="button" onClick={() => setRecommendationMenuOpen(!recommendationMenuOpen)} aria-expanded={recommendationMenuOpen}>
                  <span>{selectedRecommendationSection.title}</span>
                  <i aria-hidden="true">⌄</i>
                </button>
                {recommendationMenuOpen && (
                  <div className="recommendation-menu-list">
                    {activeRecommendationOptions.map((section) => (
                      <button className={section.id === selectedRecommendationSection.id ? "active" : ""} type="button" key={section.id} onClick={() => selectRecommendationSection(section.id)}>
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="recommendation-count">{selectedRecommendationCount} 条</span>
              <button className="chip-button" type="button" onClick={onLoadRecommendations}>刷新片单</button>
            </div>
          </div>
          <div className="tmdb-section">
            <div className="tmdb-feed">
              {(Array.isArray(selectedRecommendationSection.items) ? selectedRecommendationSection.items : []).length === 0 && <p className="empty">暂无片单，稍后点刷新片单重试。</p>}
              {(Array.isArray(selectedRecommendationSection.items) ? selectedRecommendationSection.items : []).map((item) => (
                <button className="media-feed-card" type="button" key={`${selectedRecommendationSection.id}-${item.tmdbId}`} onClick={() => onImportTmdb(item)}>
                  <div className="media-gallery">
                    <div className="media-still">
                      {item.backdropUrl ? <img src={item.backdropUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
                    </div>
                    <div className="media-poster-thumb">
                      {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <span>{item.title.slice(0, 1)}</span>}
                    </div>
                  </div>
                  <strong className="media-feed-title">{item.title}</strong>
                  <span className="media-air">{mediaAirText(item)}</span>
                  <small className="media-meta">{[item.year, item.type || "剧集", item.platform || "TMDB"].filter(Boolean).join(" / ")}</small>
                  <p className="media-summary">{item.summary || item.review || "暂无简介。"}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
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
      updateEpisodes: String(data.get("updateEpisodes") || ""),
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
        <input name="updateEpisodes" defaultValue={item?.updateEpisodes || ""} placeholder="本次更新集数，例如 9,10 或 9-10" />
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
            <p className="record-meta">{[item.year, item.type || "剧集", item.rating ? `${item.rating} 分` : "", item.platform || item.source, item.nextAirDate ? `更新 ${item.nextAirDate} ${item.airTime || ""}` : "", item.updateEpisodes ? `更新第 ${item.updateEpisodes} 集` : "", item.currentEpisode ? `当前第 ${item.currentEpisode} 集` : "", item.totalEpisodes ? `共 ${item.totalEpisodes} 集` : "", item.watchedDate, ...(item.tags || [])].filter(Boolean).join(" · ")}</p>
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

function DietTracker({ records, waterTarget, onAddWater, onAddMeal, onDelete, onSaveTarget }) {
  const [meal, setMeal] = useState("早餐");
  const [foodInput, setFoodInput] = useState("");
  const target = Number(waterTarget) || defaultWaterTarget;
  const todayRecords = records.filter((item) => item.date === todayKey());
  const waterRecords = todayRecords.filter((item) => item.type === "water");
  const mealRecords = todayRecords.filter((item) => item.type === "meal");
  const waterTotal = waterRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const calorieTotal = mealRecords.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const percent = Math.min(100, Math.round((waterTotal / target) * 100));
  const remaining = Math.max(0, target - waterTotal);
  const targetCups = Math.ceil(target / cupSize);
  const finishedCups = waterRecords.reduce((sum, item) => sum + Number(item.cups || Number(item.amount || 0) / cupSize), 0);
  const remainingCups = Math.max(0, targetCups - finishedCups);
  const estimate = estimateMealCalories(foodInput);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = todayKey(date);
    const total = records
      .filter((item) => item.type === "water" && item.date === dateKey)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { dateKey, label: index === 6 ? "今天" : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`, total };
  });

  function addCustomCups() {
    const value = Number(window.prompt("输入喝水杯数", "1"));
    if (Number.isFinite(value) && value > 0) onAddWater(value);
  }

  function saveTarget(event) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("target"));
    if (Number.isFinite(value) && value >= cupSize) onSaveTarget(value);
  }

  function submitMeal(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const titleInput = String(data.get("title") || "").trim();
    const manualCalories = Number(data.get("calories") || 0);
    const estimated = estimateMealCalories(titleInput);
    const calories = manualCalories || estimated.calories;
    const title = titleInput || `${meal}热量`;
    if (!Number.isFinite(calories) || calories <= 0) return;
    onAddMeal({ meal, title, calories, matchedFoods: estimated.matched.map((item) => item.name) });
    setFoodInput("");
    event.currentTarget.reset();
  }

  return (
    <section className="diet-shell">
      <div className="diet-title">
        <span>🍱</span>
        <div>
          <h2>每日饮食喝水</h2>
          <p>{todayDisplay()} · 今天也要好好照顾自己</p>
        </div>
      </div>

      <section className="diet-card water-card">
        <div className="panel-head">
          <h2>喝水打卡</h2>
          <span className="tag">目标 {targetCups} 杯</span>
        </div>
        <form className="water-target-form" onSubmit={saveTarget}>
          <label>
            <span>每日目标</span>
            <input name="target" type="number" min={cupSize} step={cupSize} defaultValue={target} />
          </label>
          <button type="submit">保存目标</button>
        </form>
        <div className="water-summary">
          <div className="water-ring" style={{ "--water-percent": `${percent}%` }}>
            <strong>{percent}%</strong>
            <span>{finishedCups} / {targetCups} 杯</span>
          </div>
          <div className="water-copy">
            <p>已喝 <strong>{finishedCups}</strong> / {targetCups} 杯</p>
            <p>还需喝 <strong>{remainingCups}</strong> 杯</p>
            <small>一杯 {cupSize} ml · 已喝 {waterTotal} ml，还需 {remaining} ml</small>
          </div>
        </div>
        <div className="water-actions">
          {[1, 2, 3].map((cups) => (
            <button type="button" key={cups} onClick={() => onAddWater(cups)}>
              <span>{cups === 1 ? "🥛" : cups === 2 ? "🍶" : "💧"}</span>
              <strong>{cups}杯</strong>
            </button>
          ))}
          <button type="button" onClick={addCustomCups}>
            <span>✏️</span>
            <strong>自定义</strong>
          </button>
        </div>
        <div className="diet-log-list">
          {waterRecords.length === 0 && <p className="empty">还没有喝水记录。</p>}
          {waterRecords.slice(0, 3).map((item) => (
            <div className="diet-log-row" key={item.id}>
              <span>💧 {item.cups || Number(item.amount || 0) / cupSize} 杯 <small>{item.amount} ml · {item.time}</small></span>
              <button type="button" onClick={() => onDelete(item.id)}>删除</button>
            </div>
          ))}
        </div>
        <div className="water-trend">
          <p>最近7天趋势</p>
          <div>
            {days.map((day) => (
              <span key={day.dateKey}>
                <i style={{ height: `${Math.max(4, Math.min(74, (day.total / target) * 74))}px` }} />
                <small>{day.label}</small>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="diet-card meal-card">
        <div className="panel-head">
          <h2>饮食热量记录</h2>
          <span className="tag">今日 {calorieTotal} kcal</span>
        </div>
        <div className="meal-tabs">
          {["早餐", "午餐", "晚餐", "加餐"].map((item) => (
            <button className={meal === item ? "active" : ""} type="button" key={item} onClick={() => setMeal(item)}>{item}</button>
          ))}
        </div>
        <form className="meal-form" onSubmit={submitMeal}>
          <input name="title" value={foodInput} onChange={(event) => setFoodInput(event.target.value)} placeholder="食物名称，可不填" />
          <input name="calories" type="number" min="1" inputMode="numeric" placeholder={`${meal} kcal`} />
          <small>{estimate.calories ? `已估算 ${estimate.calories} kcal · ${estimate.matched.map((item) => item.name).join("、")}；也可以直接改右侧热量` : `直接输入 ${meal} 热量即可，食物名称可选`}</small>
          <button type="submit">添加{meal}热量</button>
        </form>
        <div className="diet-log-list">
          {mealRecords.length === 0 && <p className="empty">今天还没有饮食记录。</p>}
          {mealRecords.map((item) => (
            <div className="diet-log-row" key={item.id}>
              <span>{item.meal} · {item.title} <small>{item.calories} kcal · {item.matchedFoods?.length ? `已识别 ${item.matchedFoods.join("、")} · ` : ""}{item.time}</small></span>
              <button type="button" onClick={() => onDelete(item.id)}>删除</button>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

export default function Workbench() {
  const [activePage, setActivePage] = useState("today");
  const [clock, setClock] = useState("--:--:--");
  const [plans, setPlans] = useState([]);
  const [notes, setNotes] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [dietRecords, setDietRecords] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [waterTarget, setWaterTarget] = useState(defaultWaterTarget);
  const [habits, setHabits] = useState([]);
  const [done, setDone] = useState({});
  const [assetInput, setAssetInput] = useState(defaultAssets);
  const [session, setSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState("本地保存，登录后开启云同步");
  const [backupStatus, setBackupStatus] = useState("尚未导出");
  const [editing, setEditing] = useState(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState("mobile");
  const [ponyTheme, setPonyTheme] = useState("rmb");
  const [tmdbResults, setTmdbResults] = useState([]);
  const [tmdbStatus, setTmdbStatus] = useState("输入剧名搜索，点击结果即可加入观影列表");
  const [tmdbSections, setTmdbSections] = useState([]);
  const [tmdbRecommendationStatus, setTmdbRecommendationStatus] = useState("正在准备电影和电视剧片单");
  const [consultationView, setConsultationView] = useState("today");

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
      const nextConsultations = dedupeConsultations(cloud.consultations);
      setConsultations(nextConsultations);
      writeStorage("consultations", nextConsultations);
    }
    if (Array.isArray(cloud.dietRecords)) {
      setDietRecords(cloud.dietRecords);
      writeStorage("dietRecords", cloud.dietRecords);
    }
    if (Array.isArray(cloud.anniversaries)) {
      setAnniversaries(cloud.anniversaries);
      writeStorage("anniversaries", cloud.anniversaries);
    }
    if (Number(cloud.waterTarget)) {
      setWaterTarget(Number(cloud.waterTarget));
      writeStorage("waterTarget", Number(cloud.waterTarget));
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
      const nextAssets = normalizeSavedAssets(cloud.assets);
      setAssetInput(nextAssets);
      localStorage.setItem(key("assets"), nextAssets);
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
        saveCloudItem(nextSession, "dietRecords", merged.dietRecords),
        saveCloudItem(nextSession, "anniversaries", merged.anniversaries),
        saveCloudItem(nextSession, "waterTarget", merged.waterTarget),
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
        saveCloudItem(nextSession, "dietRecords", readStorage("dietRecords", [])),
        saveCloudItem(nextSession, "anniversaries", readStorage("anniversaries", [])),
        saveCloudItem(nextSession, "waterTarget", readStorage("waterTarget", defaultWaterTarget)),
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
    const nextConsultations = dedupeConsultations(readStorage("consultations", []));
    setConsultations(nextConsultations);
    writeStorage("consultations", nextConsultations);
    setDietRecords(readStorage("dietRecords", []));
    let nextAnniversaries = readStorage("anniversaries", []);
    if (localStorage.getItem(key(defaultChineseHolidaysSeedKey)) !== "true") {
      nextAnniversaries = withDefaultChineseHolidays(nextAnniversaries);
      writeStorage("anniversaries", nextAnniversaries);
      localStorage.setItem(key(defaultChineseHolidaysSeedKey), "true");
    }
    setAnniversaries(nextAnniversaries);
    setWaterTarget(readStorage("waterTarget", defaultWaterTarget));
    setHabits(readStorage("habits", readStorage("checkins", [])));
    setDone(readStorage(`done:${todayKey()}`, {}));
    setAssetInput(normalizeSavedAssets(localStorage.getItem(key("assets"))));
    setDisplayMode(localStorage.getItem(key("displayMode")) === "desktop" ? "desktop" : "mobile");
    setPonyTheme(ponyThemes.some((theme) => theme.id === localStorage.getItem(key("ponyTheme"))) ? localStorage.getItem(key("ponyTheme")) : "rmb");
    setClock(clockText());
    loadTmdbRecommendations();
    const timer = setInterval(() => setClock(clockText()), 1000);

    if (supabase && localStorage.getItem(key("accessUnlocked")) === "true") {
      setSession(fixedSession);
      syncFromCloud(fixedSession);
    }

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (activePage !== "consultations") return;
    if (!consultations.some((item) => item.tmdbId && (item.tmdbMediaType || "tv") !== "movie")) return;

    const refreshKey = key("tmdbTrackedRefreshDate:v2");
    if (localStorage.getItem(refreshKey) === todayKey()) return;
    localStorage.setItem(refreshKey, todayKey());
    refreshTmdbTrackedItems({ automatic: true });
  }, [activePage, consultations.length]);

  const stats = useMemo(() => {
    const finishedHabits = habits.filter((item) => done[item.id]).length;
    const todayPlans = plans.filter((plan) => plan.date === todayKey());
    const finishedPlans = todayPlans.filter((plan) => plan.status === "已完成").length;
    return {
      checkin: `${finishedHabits}/${habits.length}`,
      plans: `${finishedPlans}/${todayPlans.length}`,
      notes: `${notes.length} 条`,
      dietToday: dietRecords.filter((item) => item.date === todayKey()).length,
      consultations: consultations.filter((item) => item.status !== "已归档").length,
    };
  }, [consultations, dietRecords, done, habits, notes, plans]);

  const recent = [
    ...consultations.slice(0, 3).map((record) => ({ type: "咨询", title: record.title, time: record.time, page: "consultations" })),
  ].slice(0, 5);
  const todayPlans = plans.filter((plan) => plan.date === todayKey() && plan.status !== "已完成").slice(0, 3);

  function switchPage(page) {
    setActivePage(page);
    localStorage.setItem(key("activePage"), page);
    setMenuOpen(false);
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
    setTmdbRecommendationStatus("正在加载电影和电视剧片单...");
    try {
      const response = await fetch("/api/tmdb/recommendations");
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || "推荐加载失败");
      setTmdbSections(Array.isArray(data.sections) ? data.sections : []);
      setTmdbRecommendationStatus("来自 TMDB 的电影与电视剧片单");
    } catch (error) {
      setTmdbRecommendationStatus(error.message || "片单暂时不可用，请点刷新片单重试");
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

  async function importTmdb(item) {
    setTmdbStatus(`正在读取《${item.title}》的 TMDB 详情...`);
    let details = {};
    let watchlistStatus = "";
    const mediaType = item.tmdbMediaType || (item.type === "电影" ? "movie" : "tv");
    try {
      const response = await fetch(`/api/tmdb/details?id=${encodeURIComponent(item.tmdbId)}&type=${encodeURIComponent(mediaType)}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || "详情读取失败");
      details = data;
    } catch (error) {
      setTmdbStatus(`详情读取失败，已按搜索结果加入：${error.message || "请稍后重试"}`);
    }
    if (item.tmdbId) {
      try {
        const response = await fetch("/api/tmdb/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: item.tmdbId, mediaType }),
        });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(data.error || "写入 TMDB 片单失败");
        watchlistStatus = " · 已同步 TMDB 片单";
      } catch (error) {
        watchlistStatus = ` · TMDB 片单未同步：${error.message || "请稍后重试"}`;
      }
    }
    const mergedItem = { ...item, ...details };
    const nextItem = {
      id: crypto.randomUUID(),
      ...mergedItem,
      status: "想看的剧",
      rating: "",
      watchedDate: "",
      season: mergedItem.season || "1",
      currentEpisode: mergedItem.currentEpisode || "",
      updateEpisodes: mergedItem.updateEpisodes || "",
      totalEpisodes: mergedItem.totalEpisodes || "",
      time: nowText(),
    };
    const next = dedupeConsultations([nextItem, ...consultations]);
    setConsultations(next);
    persist("consultations", next);
    setTmdbStatus(`已加入：${mergedItem.title || item.title}${nextItem.nextAirDate ? ` · 下次 ${nextItem.nextAirDate} 更新第 ${nextItem.updateEpisodes || "--"} 集` : ""}${watchlistStatus}`);
  }

  async function syncTmdbWatchlist() {
    setTmdbStatus("正在同步 TMDB 待看片单...");
    try {
      const response = await fetch("/api/tmdb/watchlist");
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || "TMDB 片单同步失败");
      const incoming = Array.isArray(data.items) ? data.items : [];
      const incomingByKey = new Map(incoming.map((item) => [consultationKey(item), item]));
      const existingKeys = new Set(consultations.map(consultationKey));
      const refreshedItems = consultations.map((item) => {
        const fresh = incomingByKey.get(consultationKey(item));
        return fresh ? mergeTmdbFields(item, fresh) : item;
      });
      const nextItems = incoming
        .filter((item) => !existingKeys.has(consultationKey(item)))
        .map((item) => ({
          id: crypto.randomUUID(),
          ...item,
          status: "想看的剧",
          rating: "",
          watchedDate: "",
          season: item.season || "1",
          currentEpisode: item.currentEpisode || "",
          updateEpisodes: item.updateEpisodes || "",
          totalEpisodes: item.totalEpisodes || "",
          time: nowText(),
        }));
      const refreshedCount = incoming.length - nextItems.length;
      const next = dedupeConsultations([...nextItems, ...refreshedItems]);
      setConsultations(next);
      persist("consultations", next);
      setTmdbStatus(`TMDB 片单同步完成：新增 ${nextItems.length} 部，刷新 ${refreshedCount} 部`);
    } catch (error) {
      setTmdbStatus(`TMDB 片单同步失败：${error.message || "请稍后重试"}`);
    }
  }

  async function refreshTmdbTrackedItems(options = {}) {
    const automatic = options.automatic === true;
    const tracked = consultations.filter((item) => item.tmdbId && (item.tmdbMediaType || "tv") !== "movie");
    if (automatic && !tracked.length) return;
    if (!tracked.length) {
      setTmdbStatus("当前没有可刷新的 TMDB 剧集。");
      return;
    }
    setTmdbStatus(`正在刷新 ${tracked.length} 部剧集更新...`);
    try {
      const settled = await Promise.allSettled(tracked.map(async (item) => {
        const response = await fetch(`/api/tmdb/details?id=${encodeURIComponent(item.tmdbId)}&type=${encodeURIComponent(item.tmdbMediaType || "tv")}`);
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(data.error || `${item.title} 更新失败`);
        return { key: consultationKey(item), item: { ...item, ...data } };
      }));
      const freshByKey = new Map(settled
        .filter((result) => result.status === "fulfilled")
        .map((result) => [result.value.key, result.value.item]));
      if (!freshByKey.size) throw settled.find((result) => result.status === "rejected")?.reason || new Error("没有刷新到剧集更新");
      const next = consultations.map((item) => {
        const fresh = freshByKey.get(consultationKey(item));
        return fresh ? mergeTmdbFields(item, fresh) : item;
      });
      setConsultations(next);
      persist("consultations", next);
      setTmdbStatus(`剧集更新已刷新：${freshByKey.size}/${tracked.length} 部`);
    } catch (error) {
      setTmdbStatus(`剧集更新刷新失败：${error.message || "请稍后重试"}`);
    }
  }

  function saveDietRecords(next) {
    setDietRecords(next);
    persist("dietRecords", next);
  }

  function addWater(cups) {
    const amount = cups * cupSize;
    const next = [{
      id: crypto.randomUUID(),
      type: "water",
      cups,
      amount,
      date: todayKey(),
      time: clock.slice(0, 5),
    }, ...dietRecords];
    saveDietRecords(next);
  }

  function saveWaterTarget(value) {
    setWaterTarget(value);
    persist("waterTarget", value);
  }

  function addMeal(item) {
    const next = [{
      id: crypto.randomUUID(),
      type: "meal",
      date: todayKey(),
      time: clock.slice(0, 5),
      ...item,
    }, ...dietRecords];
    saveDietRecords(next);
  }

  function deleteDietRecord(id) {
    saveDietRecords(dietRecords.filter((item) => item.id !== id));
  }

  function addHabit(event) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") || "").trim();
    if (!title) return;
    const next = [{ id: crypto.randomUUID(), title }, ...habits];
    setHabits(next);
    persist("habits", next);
    event.currentTarget.reset();
  }

  function toggleHabit(id) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    persist(`done:${todayKey()}`, next);
  }

  function deleteHabit(id) {
    const nextHabits = habits.filter((item) => item.id !== id);
    const nextDone = { ...done };
    delete nextDone[id];
    setHabits(nextHabits);
    setDone(nextDone);
    persist("habits", nextHabits);
    persist(`done:${todayKey()}`, nextDone);
  }

  function addTask(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const next = [{
      id: crypto.randomUUID(),
      date: todayKey(),
      title,
      priority: "中",
      status: "未完成",
      note: String(data.get("note") || ""),
      time: nowText(),
    }, ...plans];
    setPlans(next);
    persist("plans", next);
    event.currentTarget.reset();
  }

  function addAnniversary(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const date = String(data.get("date") || "");
    const type = String(data.get("type") || "countdown");
    const calendarType = String(data.get("calendarType") || "solar");
    if (!title || !date) return;
    const next = [{ id: crypto.randomUUID(), title, date, type, calendarType }, ...anniversaries];
    setAnniversaries(next);
    persist("anniversaries", next);
    event.currentTarget.reset();
  }

  function deleteAnniversary(id) {
    const next = anniversaries.filter((item) => item.id !== id);
    setAnniversaries(next);
    persist("anniversaries", next);
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
    const next = dedupeConsultations(consultations.some((record) => record.id === item.id)
      ? mapItemsById(consultations, item.id, () => item)
      : [item, ...consultations]);
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
      "# 七夜online导出",
      "",
      `导出时间：${new Date().toISOString()}`,
      "",
      "## 任务安排",
      ...plans.map((plan) => `- [${plan.status === "已完成" ? "x" : " "}] ${plan.date} ${plan.title}${plan.note ? `：${plan.note}` : ""}`),
      "",
      "## 纪念日",
      ...anniversaries.map((item) => {
        const meta = anniversaryMeta(item);
        const typeLabel = anniversaryTypes.find((type) => type.id === (item.type || "memory"))?.label || "纪念日";
        return `- [${typeLabel}] ${item.date} ${item.calendarType === "lunar" ? "阴历" : "阳历"} ${item.title}：已过 ${meta.elapsed ?? "--"} 天，下次还有 ${meta.nextDays ?? "--"} 天`;
      }),
      "",
      "## 记录",
      ...notes.map((note) => `### ${note.date} ${note.title}\n\n类型：${noteTypeLabel(note.type)}\n\n${note.content || ""}\n`),
      "",
      "## 观影记录",
      ...consultations.map((item) => `### ${item.title}\n\n分类：${item.status || "想看的剧"}\n\n类型：${item.type || "剧集"}\n\n评分：${item.rating || "未评分"}\n\n平台：${item.platform || item.source || ""}\n\n评价：${item.review || item.conclusion || ""}\n\n后续：${item.note || item.nextAction || ""}\n`),
      "",
      "## 饮食记录",
      ...dietRecords.map((item) => item.type === "water" ? `- ${item.date} ${item.time} 喝水 ${item.cups || Number(item.amount || 0) / cupSize} 杯（${item.amount} ml）` : `- ${item.date} ${item.time} ${item.meal} ${item.title} ${item.calories} kcal`),
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
      dietRecords,
      anniversaries,
      waterTarget,
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
        const nextConsultations = dedupeConsultations(payload.consultations);
        setConsultations(nextConsultations);
        persist("consultations", nextConsultations);
      }
      if (Array.isArray(payload.dietRecords)) {
        setDietRecords(payload.dietRecords);
        persist("dietRecords", payload.dietRecords);
      }
      if (Array.isArray(payload.anniversaries)) {
        setAnniversaries(payload.anniversaries);
        persist("anniversaries", payload.anniversaries);
      }
      if (Number(payload.waterTarget)) {
        setWaterTarget(Number(payload.waterTarget));
        persist("waterTarget", Number(payload.waterTarget));
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
    { id: "today", name: "今日速看", icon: "home", badge: "首页", summary: `任务 ${stats.plans} · 签到 ${stats.checkin}` },
    { id: "consultations", name: "观影记录", icon: "chat", badge: "观影", summary: `${stats.consultations} 条` },
    { id: "market", name: "股市行情", icon: "trend", badge: "行情", summary: "金价、指数、自选股" },
    { id: "diet", name: "饮食记录", icon: "food", badge: "饮食", summary: `${dietRecords.filter((item) => item.date === todayKey()).length} 条` },
    { id: "news", name: "热榜时讯", icon: "news", badge: "热榜", summary: "微博B站抖音" },
    { id: "plans", name: "每日安排", icon: "checklist", badge: "安排", summary: `${todayPlans.length} 条任务` },
    { id: "settings", name: "数据设置", icon: "settings", badge: "备份", summary: session ? "云同步在线" : "本地模式" },
  ];

  return (
    <main className={`phone-shell ${displayMode === "desktop" ? "desktop-shell" : "mobile-shell"} ${menuOpen ? "menu-open" : ""} page-${activePage} pony-theme-${ponyTheme}`}>
      <div className="phone-status">
        <button className="menu-toggle" type="button" aria-label="打开菜单" onClick={() => setMenuOpen(true)}>☰</button>
        <strong>{clock}</strong>
        <span>{session ? "云同步在线" : "本地模式"}</span>
      </div>
      <section className="app-body">
        <button className="menu-backdrop" type="button" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} />
        <nav className="side-nav" aria-label="工作台导航">
          <button className="profile-button" type="button" onClick={() => { setMenuOpen(false); setOverviewOpen(true); }} aria-label="打开技能总览">
            <span className="avatar-mark"><CultivationAvatar /></span>
            <strong>七夜online</strong>
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
            <button className="more-button" type="button" onClick={() => { setMenuOpen(false); setOverviewOpen(true); }} aria-label="更多技能">...</button>
          </div>
        </nav>

        <section className="work-area">
          {activePage !== "today" && (
            <>
              <div className="day-line"><span>📅</span><strong>{todayKey()}（今天）</strong></div>

              <header className="module-head">
                <div className="module-title-row">
                  <span className="module-icon"><AnimeNavIcon name={pages.find((page) => page.id === activePage)?.icon || "spark"} /></span>
                  <div>
                    <h1>{pageNames[activePage]}</h1>
                    <p>{pageDescriptions[activePage]}</p>
                  </div>
                  <button className="date-pill" type="button" onClick={toggleDisplayMode}>{displayMode === "desktop" ? "手机端" : "网页端"}</button>
                </div>
                {activePage === "consultations" ? (
                  <div className="module-tabs consultation-tabs" aria-label="观影内容切换">
                    <button className={consultationView === "today" ? "active" : ""} type="button" onClick={() => setConsultationView("today")}>追剧日历</button>
                    <button className={consultationView === "movies" ? "active" : ""} type="button" onClick={() => setConsultationView("movies")}>电影</button>
                    <button className={consultationView === "tv" ? "active" : ""} type="button" onClick={() => setConsultationView("tv")}>电视剧</button>
                  </div>
                ) : (
                  <div className="module-tabs" aria-label="内容切换">
                    <button className="active" type="button">今日内容</button>
                  </div>
                )}
              </header>
            </>
          )}

        <section className="content">
          {activePage === "today" && (
            <>
              <TodayTimePanel clock={clock} />
              <WeatherCard compact clock={clock} />
              <DailyQuoteCard />
              <section className="dashboard-strip" aria-label="今日概览">
                <div className="dashboard-tile dashboard-tile-primary">
                  <span>今日任务</span>
                  <strong>{stats.plans}</strong>
                  <small>完成 / 总数</small>
                </div>
                <div className="dashboard-tile">
                  <span>待整理</span>
                  <strong>{stats.consultations}</strong>
                  <small>咨询与线索</small>
                </div>
                <div className="dashboard-tile">
                  <span>今日饮食</span>
                  <strong>{stats.dietToday}</strong>
                  <small>饮食与饮水记录</small>
                </div>
              </section>
              <section className="panel quick-panel">
                <div className="panel-head"><h2>快速入口</h2><span className="tag">一步到位</span></div>
                <div className="quick-grid">
                  <QuickAction icon="checklist" label="任务安排" onClick={() => switchPage("plans")} />
                  <QuickAction icon="chat" label="观影记录" onClick={() => switchPage("consultations")} />
                  <QuickAction icon="trend" label="股市行情" onClick={() => switchPage("market")} />
                  <QuickAction icon="food" label="饮食记录" onClick={() => switchPage("diet")} />
                  <QuickAction icon="news" label="热榜时讯" onClick={() => switchPage("news")} />
                </div>
              </section>
              <section className="stats-grid">
                <StatButton label="今日任务" value={stats.plans} onClick={() => switchPage("plans")} />
                <StatButton label="今日饮食" value={`${stats.dietToday} 条`} onClick={() => switchPage("diet")} />
                <StatButton label="追剧清单" value={`${stats.consultations} 部`} onClick={() => switchPage("consultations")} />
              </section>
              <section className="panel">
                <div className="panel-head"><h2>今日任务</h2><span className="tag">{todayKey()}</span></div>
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
            <DailyArrangement
              habits={habits}
              done={done}
              tasks={plans}
              anniversaries={anniversaries}
              onAddHabit={addHabit}
              onToggleHabit={toggleHabit}
              onDeleteHabit={deleteHabit}
              onAddTask={addTask}
              onToggleTask={togglePlan}
              onDeleteTask={deletePlan}
              onAddAnniversary={addAnniversary}
              onDeleteAnniversary={deleteAnniversary}
            />
          )}

          {activePage === "consultations" && (
            <>
              <WatchSchedule
                items={consultations}
                activeView={consultationView}
                tmdbResults={tmdbResults}
                tmdbStatus={tmdbStatus}
                tmdbSections={tmdbSections}
                tmdbRecommendationStatus={tmdbRecommendationStatus}
                onSearchTmdb={searchTmdb}
                onImportTmdb={importTmdb}
                onLoadRecommendations={loadTmdbRecommendations}
                onSyncTmdbWatchlist={syncTmdbWatchlist}
                onRefreshTmdbTracked={refreshTmdbTrackedItems}
                onDeleteItem={deleteConsultation}
              />
            </>
          )}

          {activePage === "market" && <MarketBoard />}

          {activePage === "diet" && (
            <DietTracker records={dietRecords} waterTarget={waterTarget} onAddWater={addWater} onAddMeal={addMeal} onDelete={deleteDietRecord} onSaveTarget={saveWaterTarget} />
          )}

          {activePage === "news" && <NewsBoard />}

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
                  <input value={assetInput} onChange={(event) => setAssetInput(event.target.value)} placeholder="hf_GC,sh603629,sh688507" />
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
