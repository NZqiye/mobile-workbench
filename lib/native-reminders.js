import { anniversaryDates, beijingDateKey } from "./anniversary-dates.js";
import { watchEntriesForDate } from "./watch-schedule.js";
import { phoneFeeProjection } from "./subscriptions.js";

export function nativeReminderTasks(plans) {
  return plans.filter(plan => plan.status !== "已完成" && plan.reminderAt && plan.id && plan.title).map(plan => {
    const value = String(plan.reminderAt);
    const at = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}+08:00`);
    return { id: String(plan.id), title: String(plan.title).slice(0, 500), at };
  }).filter(task => Number.isFinite(task.at) && task.at > 0);
}

export function nativeReminderSchedule({ plans = [], consultations = [], anniversaries = [], subscriptionRecords = [] }, now = Date.now()) {
  const today = beijingDateKey(now);
  const reminders = nativeReminderTasks(plans).map(task => ({ ...task, kind: "tasks" }));
  const atTime = (date, time = "09:00") => Date.parse(`${date}T${time}:00+08:00`);
  const before = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const shows = new Map();
  for (const item of consultations) {
    if (["已归档", "看过的剧", "暂停/弃剧"].includes(item.status)) continue;
    const dates = new Set(item.episodeSchedule?.length ? item.episodeSchedule.map(episode => episode.date) : [item.nextAirDate]);
    for (const date of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) continue;
      for (const entry of watchEntriesForDate([item], date)) {
        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.airTime || "") ? entry.airTime : "20:00";
        const identity = `${item.tmdbId ? `tmdb-${item.tmdbMediaType || "tv"}-${item.tmdbId}` : item.id || item.title}`.slice(0, 100);
        const id = `watch:${identity}:${entry.season || 1}:${date}`;
        const title = entry.titleZh && /[㐀-鿿]/.test(entry.titleZh) ? entry.titleZh : entry.originalTitle || entry.title || entry.titleZh;
        if (!title) continue;
        if (!shows.has(id)) shows.set(id, { id, kind: "watch", title, season: entry.season || 1, at: atTime(date, time), episodes: new Set() });
        if (Number(entry.updateEpisode) > 0) shows.get(id).episodes.add(Number(entry.updateEpisode));
      }
    }
  }
  for (const show of shows.values()) {
    const episodes = [...show.episodes].sort((left, right) => left - right).join("、");
    reminders.push({ id: show.id, kind: show.kind, at: show.at, title: `${show.title} · 第${show.season}季${episodes ? ` 第${episodes}集` : ""}更新`.slice(0, 500) });
  }
  for (const item of anniversaries) {
    if (!item.id || !item.title) continue;
    for (const date of anniversaryDates(item, today)) {
      for (const lead of [1, 0]) reminders.push({
        id: `anniversary:${String(item.id).slice(0, 100)}:${date}:${lead}`,
        kind: "anniversaries",
        title: `${item.title} · ${lead ? "明天" : "今天"}${item.type === "birthday" ? "生日" : "到日子了"}（${date}）`.slice(0, 500),
        at: atTime(before(date, lead)),
      });
    }
  }
  for (const item of subscriptionRecords) {
    if (!item.id || !item.title || item.purchaseType === "永久会员") continue;
    const phone = item.purchaseType === "手机话费";
    const date = phone ? phoneFeeProjection(item, today)?.rechargeDate : item.endDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) continue;
    for (const lead of [3, 0]) reminders.push({
      id: `subscription:${String(item.id).slice(0, 100)}:${date}:${lead}`,
      kind: "subscriptions",
      title: `${item.title} · ${lead ? `还有${lead}天` : "今天"}${phone ? "需充值" : "到期"}（${date}）${phone ? "，按当前余额估算" : ""}`.slice(0, 500),
      at: atTime(before(date, lead)),
    });
  }
  return [...new Map(reminders.filter(item => Number.isFinite(item.at) && item.at >= now - 86400000).map(item => [item.id, item])).values()]
    .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
}
