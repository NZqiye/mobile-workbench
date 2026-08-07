import { fetchTmdb, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

const sections = [
  ["airingToday", "今日更新影视", "https://api.themoviedb.org/3/tv/airing_today"],
  ["onTheAir", "即将播放影视", "https://api.themoviedb.org/3/tv/on_the_air"],
];

async function loadSection([id, title, source]) {
  const pages = await Promise.all([1, 2].map(async (page) => {
    const url = new URL(source);
    url.searchParams.set("language", "zh-CN");
    url.searchParams.set("timezone", "Asia/Shanghai");
    url.searchParams.set("page", String(page));
    const response = await fetchTmdb(url);
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.status_message || "TMDB 推荐请求失败");
    return data.results || [];
  }));
  const seen = new Set();

  return {
    id,
    title,
    items: pages.flat()
      .filter((item) => item.media_type !== "person")
      .filter((item) => {
        const key = item.id || item.name || item.title;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 16)
      .map((item) => mapTmdbResult({ ...item, media_type: "tv" })),
  };
}

export async function GET() {
  try {
    if (!tmdbToken) {
      return Response.json({ error: "本地缺少 TMDB_ACCESS_TOKEN，请在 .env.local 中配置 TMDB 读访问令牌" }, { status: 500 });
    }

    const settled = await Promise.allSettled(sections.map(loadSection));
    const loadedSections = settled
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value);
    if (loadedSections.length === 0) throw settled.find((item) => item.status === "rejected")?.reason || new Error("TMDB 推荐暂时不可用");
    return Response.json({ sections: loadedSections });
  } catch (error) {
    const message = error.message === "fetch failed"
      ? "暂时无法连接 TMDB，请稍后重试"
      : error.message || "TMDB 推荐暂时不可用";
    return Response.json({ error: message }, { status: 500 });
  }
}
