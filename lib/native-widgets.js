import { watchEntriesForDate } from "./watch-schedule.js";
import { thiingsIconByKey } from "./thiings-icons.js";

export function widgetSnapshot(plans, dietRecords, waterTarget, date, consultations = [], assets = [], legacyIconPaths = {}) {
  const pending = plans.filter(plan => plan.title && (!plan.date || plan.date === date) && plan.status !== "已完成");
  const waterMl = dietRecords.filter(record => record.type === "water" && record.date === date)
    .reduce((sum, record) => sum + Math.max(0, Number(record.amount) || 0), 0);
  const tracked = consultations.filter(item => !["已归档", "看过的剧", "暂停/弃剧"].includes(item.status));
  const watchDays = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    const dateKey = day.toISOString().slice(0, 10);
    const groups = new Map();
    for (const entry of watchEntriesForDate(tracked, dateKey).sort((a, b) => String(a.airTime || "23:59").localeCompare(String(b.airTime || "23:59")))) {
      const title = entry.titleZh && /[㐀-鿿]/.test(entry.titleZh) ? entry.titleZh : entry.originalTitle || entry.title || entry.titleZh;
      if (!title) continue;
      const identity = `${entry.tmdbId || entry.id || title}:${entry.season || 1}`;
      if (!groups.has(identity)) groups.set(identity, { id: identity, title, season: entry.season || 1, episodes: new Set(), time: /^\d{2}:\d{2}$/.test(entry.airTime || "") ? entry.airTime : "", poster: entry.posterUrl || "" });
      const episode = Number(entry.updateEpisode);
      if (episode > 0) groups.get(identity).episodes.add(episode);
    }
    const shows = [...groups.values()];
    return {
      date: dateKey,
      count: shows.length,
      episodeCount: shows.reduce((sum, show) => sum + show.episodes.size, 0),
      lines: shows.slice(0, 3).map(show => `${show.time ? `${show.time} ` : ""}${String(show.title).replace(/\s+/g, " ").slice(0, 28)} · 第${show.season}季${show.episodes.size ? ` ${[...show.episodes].sort((a, b) => a - b).join("/")}集` : "更新"}`.slice(0, 70)),
      shows: shows.slice(0, 60).map(show => ({ id: String(show.id).slice(0, 120), title: String(show.title).replace(/\s+/g, " ").slice(0, 80), season: String(show.season).slice(0, 4), episodes: [...show.episodes].sort((a, b) => a - b).slice(0, 30).join("/"), time: show.time, poster: widgetPosterUrl(show.poster) })),
    };
  });
  const activeAssets = assets.filter(item => item.status === "服役中");
  return {
    date,
    tasks: pending.slice(0, 3).map(plan => `${plan.time ? `${String(plan.time).slice(0, 5)} ` : ""}${String(plan.title).slice(0, 40)}`),
    pendingCount: pending.length,
    completedCount: plans.filter(plan => (!plan.date || plan.date === date) && plan.status === "已完成").length,
    waterMl: Math.round(waterMl),
    targetMl: Math.max(250, Number(waterTarget) || 2000),
    watchDays,
    assetCount: activeAssets.length,
    assetTotal: Math.round(activeAssets.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0), 0) * 100) / 100,
    recentAssets: [...activeAssets].sort((a, b) => String(b.purchaseDate || "").localeCompare(String(a.purchaseDate || ""))).slice(0, 2)
      .map(item => String(item.name || "未命名物品").replace(/\s+/g, " ").slice(0, 40)),
    assetDetails: [...activeAssets].sort((a, b) => String(b.purchaseDate || "").localeCompare(String(a.purchaseDate || ""))).slice(0, 500).map(item => ({
      id: String(item.id || "").slice(0, 120), name: String(item.name || "未命名物品").replace(/\s+/g, " ").slice(0, 80),
      price: Math.round(Math.max(0, Number(item.price) || 0) * 100) / 100, purchaseDate: item.purchaseDate || "",
      icon: thiingsIconByKey[item.icon] || legacyIconPaths[item.icon] || "/assets-icons/thiings/home/box.webp",
    })),
  };
}

export function widgetPosterUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !["image.tmdb.org", "lain.bgm.tv", "images.bgm.tv", "static.tvmaze.com", "cdn.myanimelist.net"].includes(url.hostname)) return "";
    if (url.hostname === "image.tmdb.org") url.pathname = url.pathname.replace(/^\/t\/p\/[^/]+\//, "/t/p/w185/");
    return url.href.length <= 768 ? url.href : "";
  } catch { return ""; }
}
