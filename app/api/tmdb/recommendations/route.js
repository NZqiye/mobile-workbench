import { fetchTmdb, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

const sectionMeta = [
  ["movieHot", "\u7535\u5f71", "\u70ed\u95e8\u699c", "movie", "https://api.themoviedb.org/3/movie/popular"],
  ["movieUpcoming", "\u7535\u5f71", "\u4e0a\u5347\u699c", "movie", "https://api.themoviedb.org/3/movie/upcoming"],
  ["movieHistory", "\u7535\u5f71", "\u9ad8\u5206\u699c", "movie", "https://api.themoviedb.org/3/movie/top_rated"],
  ["tvHot", "\u7535\u89c6\u5267", "\u70ed\u95e8\u699c", "tv", "https://api.themoviedb.org/3/tv/popular"],
  ["tvUpcoming", "\u7535\u89c6\u5267", "\u4e0a\u5347\u699c", "tv", "https://api.themoviedb.org/3/tv/on_the_air"],
  ["tvHistory", "\u7535\u89c6\u5267", "\u9ad8\u5206\u699c", "tv", "https://api.themoviedb.org/3/tv/top_rated"],
  ["varietyHot", "\u7efc\u827a", "\u70ed\u95e8\u699c", "tv", "https://api.themoviedb.org/3/discover/tv", "10764|10767", "popularity.desc"],
  ["varietyUpcoming", "\u7efc\u827a", "\u4e0a\u5347\u699c", "tv", "https://api.themoviedb.org/3/discover/tv", "10764|10767", "first_air_date.desc"],
  ["varietyHistory", "\u7efc\u827a", "\u9ad8\u5206\u699c", "tv", "https://api.themoviedb.org/3/discover/tv", "10764|10767", "vote_average.desc"],
  ["animeHot", "\u52a8\u6f2b", "\u70ed\u95e8\u699c"],
  ["animeUpcoming", "\u52a8\u6f2b", "\u4e0a\u5347\u699c"],
  ["animeHistory", "\u52a8\u6f2b", "\u9ad8\u5206\u699c"],
];

async function readPage(source, page, genres = "", sortBy = "") {
  const url = new URL(source);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("page", String(page));
  if (genres) url.searchParams.set("with_genres", genres);
  if (genres === "10764|10767") url.searchParams.set("with_origin_country", "CN|KR");
  if (sortBy) url.searchParams.set("sort_by", sortBy);
  if (sortBy === "vote_average.desc") url.searchParams.set("vote_count.gte", "200");
  const response = await fetchTmdb(url, { signal: AbortSignal.timeout(6000) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || "TMDB request failed");
  return data;
}

async function loadSection([id, type, category, mediaType, source, genres, sortBy]) {
  if (!source) return null;
  const settled = await Promise.allSettled([1, 2, 3].map((page) => readPage(source, page, genres, sortBy)));
  const pages = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  if (!pages.length) throw new Error(`${category}加载失败`);
  const items = pages.flatMap((data) => data.results || [])
    .filter((item) => item.media_type !== "person")
    .filter((item) => !item.media_type || item.media_type === mediaType)
    .filter((item) => {
      const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
      const isAnimation = genreIds.includes(16);
      const isVariety = genreIds.includes(10764) || genreIds.includes(10767);
      if (type === "\u7535\u89c6\u5267") return !isAnimation && !isVariety;
      if (type === "\u7efc\u827a") return isVariety && (item.origin_country || []).some((country) => country === "CN" || country === "KR");
      return true;
    })
    .slice(0, 60);
  return {
    id,
    title: category,
    items: items.map((item) => ({
      ...mapTmdbResult({ ...item, media_type: mediaType }),
      source: "TMDB",
      sourceLabel: "TMDB",
      category: type === "\u7535\u5f71" ? "movie" : type === "\u7535\u89c6\u5267" ? "tv" : "variety",
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
      airDate: mediaType === "movie" ? item.release_date || "" : item.first_air_date || "",
      summary: item.overview || "",
    })),
  };
}

export async function GET() {
  if (!tmdbToken) {
    return Response.json({ ok: false, sections: [], source: "TMDB", error: "缺少 TMDB_ACCESS_TOKEN，无法加载真实影视数据" }, { status: 503 });
  }
  try {
    const settled = await Promise.allSettled(sectionMeta.map(loadSection));
    const sections = settled
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
    const errors = settled
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message || "TMDB section unavailable");
    if (!sections.length) {
      return Response.json({ ok: false, sections: [], source: "TMDB", errors, error: "TMDB 暂时没有返回真实影视数据" }, { status: 502 });
    }
    return Response.json({ ok: true, sections, source: "TMDB", errors });
  } catch (error) {
    return Response.json({ ok: false, sections: [], source: "TMDB", error: error.message || "TMDB unavailable" }, { status: 502 });
  }
}
