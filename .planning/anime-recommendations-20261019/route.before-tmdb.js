const BANGUMI_API = "https://api.bgm.tv";
const SECTION_LIMIT = 60;
const UPDATE_INTERVAL = 15 * 60 * 1000;
const STALE_INTERVAL = 24 * 60 * 60 * 1000;
let cache = null;
let pending = null;

function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function seasonRange(date) {
  const [year, month] = date.split("-").map(Number);
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return {
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: startMonth === 10 ? `${year + 1}-01-01` : `${year}-${String(startMonth + 3).padStart(2, "0")}-01`,
    label: `${year} 年 ${startMonth} 月新番`,
  };
}

async function fetchBangumiJson(path, body) {
  const response = await fetch(`${BANGUMI_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "User-Agent": "QiyeWorkbench/1.0 (https://github.com/NZqiye/mobile-workbench)",
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Bangumi ${response.status}`);
  return response.json();
}

function searchBangumi(sort, range) {
  return fetchBangumiJson(`/v0/search/subjects?limit=${SECTION_LIMIT}&offset=0`, {
    keyword: "",
    sort,
    filter: {
      type: [2], nsfw: false,
      ...(sort === "rank" ? { rank: [">0", "<=99999"] } : {}),
      ...(range ? { air_date: [`>=${range.start}`, `<${range.end}`] } : {}),
    },
  });
}

function normalizeSubject(item, index) {
  const date = String(item.date || item.air_date || "");
  const title = String(item.name_cn || item.name || "").trim();
  const summary = String(item.summary || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const images = item.images || {};
  const collection = item.collection || {};
  return {
    id: `bangumi-${item.id}`,
    bangumiId: Number(item.id),
    bangumiName: String(item.name || ""),
    bangumiNameCn: String(item.name_cn || ""),
    bangumiUrl: `https://bgm.tv/subject/${item.id}`,
    bangumiScore: Number(item.rating?.score || 0),
    bangumiRank: Number(item.rating?.rank || item.rank || 0),
    bangumiHeat: ["wish", "collect", "doing", "on_hold", "dropped"].reduce((sum, key) => sum + Number(collection[key] || 0), 0),
    airWeekday: Number(item.air_weekday || 0),
    title,
    titleZh: /[\u3400-\u9fff]/.test(item.name_cn || "") ? item.name_cn : "",
    originalTitle: item.name || title,
    allowOriginalTitle: true,
    year: date.slice(0, 4),
    airDate: date,
    type: "动漫",
    category: "anime",
    platform: "Bangumi",
    source: "Bangumi",
    sourceLabel: "Bangumi",
    posterUrl: images.large || images.common || images.medium || images.small || "",
    summary,
    summaryZh: /[\u3400-\u9fff]/.test(summary) ? summary : "",
    tags: Array.isArray(item.meta_tags) ? item.meta_tags : [],
    rank: index + 1,
  };
}

function normalizeSubjects(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || item.nsfw || (item.type && item.type !== 2) || seen.has(item.id)) return false;
    seen.add(item.id);
    return Boolean(item.name_cn || item.name);
  }).map(normalizeSubject);
}

async function loadRecommendations(date) {
  const range = seasonRange(date);
  const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay() || 7;
  const [season, calendar, history] = await Promise.allSettled([
    searchBangumi("heat", range),
    fetchBangumiJson("/calendar"),
    searchBangumi("rank"),
  ]);
  const warnings = [];
  const sections = [];
  if (season.status === "fulfilled" && Array.isArray(season.value.data)) {
    const items = normalizeSubjects(season.value.data).filter((item) => item.airDate >= range.start && item.airDate < range.end);
    sections.push({ id: "animeHot", title: "当季热门", items });
    sections.push({ id: "animeSeason", title: "当季新番", items: [...items].sort((a, b) => b.airDate.localeCompare(a.airDate)) });
  } else {
    warnings.push("当季新番暂时获取失败");
  }
  if (calendar.status === "fulfilled" && Array.isArray(calendar.value)) {
    const day = calendar.value.find((entry) => Number(entry.weekday?.id) === weekday);
    if (day && Array.isArray(day.items)) {
      const items = normalizeSubjects(day.items).map((item) => ({ ...item, airWeekday: weekday, scheduleDate: date }));
      sections.push({ id: "animeToday", title: "今日放送", items });
    } else {
      warnings.push("今日放送暂时获取失败");
    }
  } else {
    warnings.push("今日放送暂时获取失败");
  }
  if (history.status === "fulfilled" && Array.isArray(history.value.data)) {
    sections.push({ id: "animeHistory", title: "高分经典", items: normalizeSubjects(history.value.data) });
  } else {
    warnings.push("高分榜暂时获取失败");
  }
  if (!sections.length) throw new Error("Bangumi 暂时不可用，请稍后刷新");
  const generatedAt = new Date().toISOString();
  return {
    ok: true, source: "Bangumi", date,
    sourceNote: `${range.label} · Bangumi 资料与放送排期`,
    generatedAt,
    nextUpdateAt: new Date(Date.parse(generatedAt) + UPDATE_INTERVAL).toISOString(),
    warnings,
    items: sections.find((section) => section.id === "animeHot")?.items || [],
    sections: sections.map((section) => ({ ...section, generatedAt, scheduleDate: date })),
  };
}

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  const now = Date.now();
  const date = shanghaiDate();
  const refresh = request && new URL(request.url).searchParams.get("refresh") === "1";
  if (cache?.payload.date === date && cache.expiresAt > now && (!refresh || now - cache.loadedAt < 60000)) {
    return json({ ...cache.payload, cache: "hit" });
  }
  try {
    if (!pending) {
      pending = loadRecommendations(date).then((payload) => {
        const loadedAt = Date.now();
        cache = { payload, loadedAt, expiresAt: loadedAt + UPDATE_INTERVAL, staleUntil: loadedAt + STALE_INTERVAL };
        return payload;
      }).finally(() => { pending = null; });
    }
    return json({ ...await pending, cache: "miss" });
  } catch (error) {
    if (cache && cache.staleUntil > now) {
      return json({ ...cache.payload, stale: true, warning: "更新失败，正在显示上次获取的资料", cache: "stale" });
    }
    return json({ ok: false, error: error.message || "动漫推荐暂时不可用" }, 502);
  }
}
