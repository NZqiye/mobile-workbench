import { fetchTmdb, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

const sectionMeta = [
  ["movieHot", "\u7535\u5f71", "\u8fd1\u671f\u70ed\u64ad", "movie", "https://api.themoviedb.org/3/movie/popular"],
  ["movieUpcoming", "\u7535\u5f71", "\u5373\u5c06\u4e0a\u7ebf", "movie", "https://api.themoviedb.org/3/movie/upcoming"],
  ["movieHistory", "\u7535\u5f71", "\u5386\u53f2\u70ed\u699c", "movie", "https://api.themoviedb.org/3/movie/top_rated"],
  ["tvHot", "\u7535\u89c6\u5267", "\u8fd1\u671f\u70ed\u64ad", "tv", "https://api.themoviedb.org/3/tv/popular"],
  ["tvUpcoming", "\u7535\u89c6\u5267", "\u5373\u5c06\u4e0a\u7ebf", "tv", "https://api.themoviedb.org/3/tv/on_the_air"],
  ["tvHistory", "\u7535\u89c6\u5267", "\u5386\u53f2\u70ed\u699c", "tv", "https://api.themoviedb.org/3/tv/top_rated"],
  ["varietyHot", "\u7efc\u827a", "\u8fd1\u671f\u70ed\u64ad", "tv", "https://api.themoviedb.org/3/discover/tv", "10764,10767", "popularity.desc"],
  ["varietyUpcoming", "\u7efc\u827a", "\u5373\u5c06\u4e0a\u7ebf", "tv", "https://api.themoviedb.org/3/discover/tv", "10764,10767", "first_air_date.desc"],
  ["varietyHistory", "\u7efc\u827a", "\u5386\u53f2\u70ed\u699c", "tv", "https://api.themoviedb.org/3/discover/tv", "10764,10767", "vote_average.desc"],
  ["animeHot", "\u52a8\u6f2b", "\u8fd1\u671f\u70ed\u64ad"],
  ["animeUpcoming", "\u52a8\u6f2b", "\u5373\u5c06\u4e0a\u7ebf"],
  ["animeHistory", "\u52a8\u6f2b", "\u5386\u53f2\u70ed\u699c"],
];

const fallbackNames = {
  movieHot: ["\u6c99\u4e18\uff1a\u7b2c\u4e8c\u90e8", "\u70ed\u8fa3\u6eda\u70eb", "\u5965\u672c\u6d77\u9ed8"],
  movieUpcoming: ["\u8d85\u4eba", "\u963f\u51e1\u8fbe\uff1a\u706b\u4e0e\u7070", "\u65e0\u540d\u5973\u5b69"],
  movieHistory: ["\u8096\u7533\u514b\u7684\u6551\u8d4e", "\u5343\u4e0e\u5343\u5bfb", "\u8f9b\u5fb7\u52d2\u7684\u540d\u5355"],
  tvHot: ["\u9ed1\u955c", "\u718a\u5bb6\u9910\u9986", "\u4eba\u751f\u5207\u5272\u672f"],
  tvUpcoming: ["\u6307\u73af\u738b\u56fd", "\u98de\u9ec4\u817e\u8fbe", "\u767d\u83b2\u82b1\u5ea6\u5047\u6751"],
  tvHistory: ["\u7edd\u547d\u6bd2\u5e08", "\u6743\u529b\u7684\u6e38\u620f", "\u516d\u4eba\u884c"],
  varietyHot: ["\u5954\u8dd1\u5427", "\u5927\u4fa6\u63a2", "\u79cd\u5730\u5427"],
  varietyUpcoming: ["\u58f0\u751f\u4e0d\u606f\u00b7\u534e\u590f\u4f20\u5947", "\u4e58\u98ce2025", "\u975e\u8bda\u52ff\u6270"],
  varietyHistory: ["\u7238\u7238\u53bb\u54ea\u513f", "\u5947\u8469\u8bf4", "\u5947\u8469\u8bf4\u8131\u53e3\u79c0"],
  animeHot: ["\u8ff7\u5bab\u996d", "\u846c\u9001\u7684\u8299\u8389\u83b2", "\u836f\u5c4b\u5c11\u5973\u7684\u5462\u5583"],
  animeUpcoming: ["\u9b54\u6cd5\u4f7f\u7684\u7ea6\u5b9a", "\u9b3c\u706d\u4e4b\u5203\u65e0\u9650\u57ce", "\u94c1\u8840\u5b64\u513f\u65b0\u7bc7"],
  animeHistory: ["\u94a2\u4e4b\u70bc\u91d1\u672f\u5e08FA", "\u8fdb\u51fb\u7684\u5de8\u4eba", "\u590f\u76ee\u53cb\u4eba\u5e10"],
};

const fallbackSections = sectionMeta.map(([id, type, category]) => ({
  id,
  title: category,
  items: (fallbackNames[id] || []).map((title, index) => ({
    id: `local-${id}-${index + 1}`,
    title,
    titleZh: title,
    type,
    tmdbMediaType: type === "\u7535\u5f71" ? "movie" : "tv",
    year: id.includes("History") ? "2020" : "2025",
    tmdbRating: (8.8 - index * 0.2).toFixed(1),
    review: type === "\u52a8\u6f2b" ? "\u503c\u5f97\u6536\u85cf\u7684\u52a8\u753b\u4f5c\u54c1\u3002" : `\u6765\u81ea\u672c\u5730\u7247\u5355\u7684${type}\u7cbe\u9009\u3002`,
    source: "\u672c\u5730\u7cbe\u9009",
    sourceLabel: "\u672c\u5730\u7cbe\u9009",
    platform: "\u672c\u5730\u7cbe\u9009",
    category: type === "\u7535\u5f71" ? "movie" : type === "\u7535\u89c6\u5267" ? "tv" : type === "\u7efc\u827a" ? "variety" : "anime",
  })),
}));

async function readPage(source, page, genres = "", sortBy = "") {
  const url = new URL(source);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("page", String(page));
  if (genres) url.searchParams.set("with_genres", genres);
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
  const data = await readPage(source, 1, genres, sortBy);
  const items = (data.results || [])
    .filter((item) => item.media_type !== "person")
    .filter((item) => {
      const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
      const isAnimation = genreIds.includes(16);
      const isVariety = genreIds.includes(10764) || genreIds.includes(10767);
      if (type === "\u7535\u89c6\u5267") return !isAnimation && !isVariety;
      if (type === "\u7efc\u827a") return isVariety;
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
  if (!tmdbToken) return Response.json({ sections: fallbackSections, source: "local" });
  try {
    const settled = await Promise.allSettled(sectionMeta.map(loadSection));
    const loadedById = new Map(settled.filter((result) => result.status === "fulfilled" && result.value).map((result) => [result.value.id, result.value]));
    const sections = fallbackSections.map((fallback) => {
      const live = loadedById.get(fallback.id);
      return live && live.items.length ? live : fallback;
    });
    return Response.json({ sections, source: loadedById.size === sectionMeta.filter((entry) => entry[4]).length ? "TMDB" : "TMDB + local" });
  } catch (error) {
    return Response.json({ sections: fallbackSections, source: "local", error: error.message || "TMDB unavailable" });
  }
}
