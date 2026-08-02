const dailyHotSources = {
  weibo: ["weibo"],
  bilibili: ["bilibili"],
  douyin: ["douyin"],
  sina: ["sina-news"],
  weread: ["weread"],
  history: ["history"],
};

function dailyHotBase() {
  return (process.env.DAILY_HOT_API_BASE || "https://api-hot.imsyy.top").replace(/\/$/, "");
}

function normalizeDailyHotItems(data, category, sourceId) {
  const items = Array.isArray(data.data) ? data.data : Array.isArray(data.result) ? data.result : [];
  const source = data.name || data.title || sourceId;
  return items.map((item) => ({
    title: item.title || item.name || item.desc || "",
    url: item.url || item.mobileUrl || item.link || "",
    source,
    publishedAt: data.updateTime || data.updatedTime || "",
    category,
  })).filter((item) => item.title);
}

function normalizeWeiboHotItems(data) {
  const items = Array.isArray(data?.data?.realtime) ? data.data.realtime : [];
  return items.map((item) => ({
    title: item.note || item.word || "",
    url: item.word ? `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word)}` : "",
    source: "微博热搜",
    publishedAt: new Date().toISOString(),
    category: "weibo",
  })).filter((item) => item.title);
}

async function loadDailyHotSource(sourceId, category) {
  const url = `${dailyHotBase()}/${sourceId}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "qiyeworkbench/1.0" },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`${sourceId} 返回 ${response.status}`);
  try {
    return normalizeDailyHotItems(await response.json(), category, sourceId);
  } catch {
    throw new Error(`${sourceId} 返回内容无法解析`);
  }
}

async function loadWeiboHotSearch() {
  const response = await fetch("https://weibo.com/ajax/side/hotSearch", {
    headers: {
      Referer: "https://weibo.com/",
      "User-Agent": "Mozilla/5.0 qiyeworkbench/1.0",
    },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`微博热搜返回 ${response.status}`);
  return normalizeWeiboHotItems(await response.json());
}

async function loadDailyHot(category) {
  const sources = dailyHotSources[category] || dailyHotSources.weibo;
  const settled = await Promise.allSettled(sources.map((source) => loadDailyHotSource(source, category)));
  const seen = new Set();
  const news = settled
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value)
    .filter((item) => {
      const key = item.title.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
  if (news.length || category !== "weibo") return news;
  return loadWeiboHotSearch().then((items) => items.slice(0, 12)).catch(() => []);
}

export async function GET(request) {
  const category = request.nextUrl.searchParams.get("category") || "weibo";
  const news = await loadDailyHot(category);

  return Response.json({
    category,
    updatedAt: new Date().toISOString(),
    source: news.length ? (news[0].source || "DailyHotApi 热榜接口") : "DailyHotApi 暂时不可用",
    error: news.length ? "" : "当前 DailyHotApi 地址没有返回可用新闻，请检查 DAILY_HOT_API_BASE 或稍后刷新。",
    news,
  });
}
