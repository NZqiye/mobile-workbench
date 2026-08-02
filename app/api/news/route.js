const fallbackNews = {
  politics: [{ title: "DailyHotApi 暂时不可用，请稍后刷新", source: "本地兜底", url: "", publishedAt: "" }],
  finance: [{ title: "DailyHotApi 暂时不可用，请稍后刷新", source: "本地兜底", url: "", publishedAt: "" }],
  consume: [{ title: "DailyHotApi 暂时不可用，请稍后刷新", source: "本地兜底", url: "", publishedAt: "" }],
};

const dailyHotSources = {
  politics: ["thepaper", "sina-news", "netease-news", "toutiao"],
  finance: ["36kr", "huxiu", "ifanr", "wallstreetcn"],
  consume: ["toutiao", "weibo", "baidu", "douyin"],
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

async function loadDailyHotSource(sourceId, category) {
  const response = await fetch(`${dailyHotBase()}/${sourceId}`, {
    headers: { "User-Agent": "qiyeworkbench/1.0" },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`DailyHotApi 不可用：${response.status}`);
  return normalizeDailyHotItems(await response.json(), category, sourceId);
}

async function loadDailyHot(category) {
  const sources = dailyHotSources[category] || dailyHotSources.politics;
  const settled = await Promise.allSettled(sources.map((source) => loadDailyHotSource(source, category)));
  const seen = new Set();
  return settled
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value)
    .filter((item) => {
      const key = item.title.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export async function GET(request) {
  const category = request.nextUrl.searchParams.get("category") || "politics";
  const news = await loadDailyHot(category);

  return Response.json({
    category,
    updatedAt: new Date().toISOString(),
    source: news.length ? "DailyHotApi 热榜接口" : "本地兜底",
    news: news.length ? news : fallbackNews[category] || fallbackNews.politics,
  });
}
