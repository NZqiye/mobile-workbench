import { watchEntriesForDate } from "./watch-schedule.js";

export function widgetSnapshot(plans, dietRecords, waterTarget, date, consultations = [], assets = []) {
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
      if (!groups.has(identity)) groups.set(identity, { title, season: entry.season || 1, episodes: new Set(), time: /^\d{2}:\d{2}$/.test(entry.airTime || "") ? entry.airTime : "" });
      const episode = Number(entry.updateEpisode);
      if (episode > 0) groups.get(identity).episodes.add(episode);
    }
    const shows = [...groups.values()];
    return {
      date: dateKey,
      count: shows.length,
      episodeCount: shows.reduce((sum, show) => sum + show.episodes.size, 0),
      lines: shows.slice(0, 3).map(show => `${show.time ? `${show.time} ` : ""}${String(show.title).replace(/\s+/g, " ").slice(0, 28)} · 第${show.season}季${show.episodes.size ? ` ${[...show.episodes].sort((a, b) => a - b).join("/")}集` : "更新"}`.slice(0, 70)),
    };
  });
  const activeAssets = assets.filter(item => item.status === "服役中");
  return {
    date,
    tasks: pending.slice(0, 3).map(plan => `${plan.time ? `${String(plan.time).slice(0, 5)} ` : ""}${String(plan.title).slice(0, 40)}`),
    pendingCount: pending.length,
    waterMl: Math.round(waterMl),
    targetMl: Math.max(250, Number(waterTarget) || 2000),
    watchDays,
    assetCount: activeAssets.length,
    assetTotal: Math.round(activeAssets.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0), 0) * 100) / 100,
    recentAssets: [...activeAssets].sort((a, b) => String(b.purchaseDate || "").localeCompare(String(a.purchaseDate || ""))).slice(0, 2)
      .map(item => String(item.name || "未命名物品").replace(/\s+/g, " ").slice(0, 40)),
  };
}
