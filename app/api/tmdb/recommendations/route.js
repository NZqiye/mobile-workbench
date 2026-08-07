import { fetchTmdb, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

const sections = [
  ["movieNowPlaying", "正在上映", "https://api.themoviedb.org/3/movie/now_playing", "movie"],
  ["movieUpcoming", "即将上映", "https://api.themoviedb.org/3/movie/upcoming", "movie"],
  ["tvPopular", "热门影视", "https://api.themoviedb.org/3/tv/popular", "tv"],
  ["tvAiringToday", "今日播出", "https://api.themoviedb.org/3/tv/airing_today", "tv"],
];
const maxPages = 3;
const maxItems = 50;
const backdropBase = "https://image.tmdb.org/t/p/w780";

async function readPage(source, page) {
  const url = new URL(source);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("page", String(page));
  const response = await fetchTmdb(url);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || "TMDB 推荐请求失败");
  return data;
}

async function loadSection([id, title, source, mediaType]) {
  const firstPage = await readPage(source, 1);
  const totalPages = Math.min(Number(firstPage.total_pages || 1), maxPages);
  const restPages = totalPages > 1
    ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => readPage(source, index + 2)))
    : [];
  const pages = [firstPage, ...restPages].map((page) => page.results || []);
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
      .slice(0, maxItems)
      .map((item) => ({
        ...mapTmdbResult({ ...item, media_type: mediaType }),
        backdropUrl: item.backdrop_path ? `${backdropBase}${item.backdrop_path}` : "",
        airDate: mediaType === "movie" ? item.release_date || "" : item.first_air_date || "",
        summary: item.overview || "",
      })),
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
