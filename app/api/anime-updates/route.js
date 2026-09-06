import { fetchTmdb, tmdbToken } from "../../../lib/tmdb";

const ANILIST_URL = "https://graphql.anilist.co";
const KITSU_BASE = "https://kitsu.io/api/edge";
let cache = null;
const animeTitleCache = new Map();
const ANIME_ZH = {
  "Steel Ball Run: JoJo no Kimyou na Bouken": "JOJO的奇妙冒险：飙马野郎",
  "One Piece": "海贼王",
  "Super no Ura de Yani Suu Futari": "在超市后门吸烟的两人",
  "Seihantai na Kimi to Boku 2nd Season": "正相反的你与我 第二季",
  "Re:Zero kara Hajimeru Isekai Seikatsu 4th Season": "Re：从零开始的异世界生活 第四季",
  "Tensei Shitara Slime Datta Ken 4th Season": "关于我转生变成史莱姆这档事 第四季",
  "Youjo Senki II": "幼女战记 第二季",
  "Daemons of the Shadow Realm": "黄泉使者",
  "Holo no Graffiti": "Holo的涂鸦",
  "Touhou Gensou Mangekyou: The Memories of Phantasm": "东方幻想万华镜",
  "Detective Conan": "名侦探柯南",
  "Suponjibobu Anime": "海绵宝宝动画",
};
const ANIME_SUMMARY_ZH = {
  "Yomi no Tsugai": "在一座由两名石头守护者监视的偏远山村里，少年弥留过着自给自足的生活，陪伴着他仅剩的家人——珍爱的双胞胎姐姐朝。与此同时，朝被关在笼子里，替村子执行一项神秘的“使命”。她为什么会成为囚犯？弥留平静祥和的家中还隐藏着哪些秘密？（来源：Square Enix）",
};
const anilistQuery = `
query ($page: Int, $perPage: Int, $status: MediaStatus, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, status: $status, sort: $sort, isAdult: false) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { large medium }
      bannerImage
      averageScore
      popularity
      episodes
      status
      seasonYear
      startDate { year month day }
      siteUrl
    }
  }
}`;

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function normalizeTitle(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gi, "");
}

function formatAnilistDate(date = {}) {
  if (!date.year || !date.month || !date.day) return "";
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function cleanDescription(text) {
  return String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchTmdbAnimeTitle(title) {
  if (!tmdbToken || !title) return { title: "", overview: "" };
  if (animeTitleCache.has(title)) return animeTitleCache.get(title);
  const promise = (async () => {
    try {
      const url = new URL("https://api.themoviedb.org/3/search/tv");
      url.searchParams.set("query", title);
      url.searchParams.set("language", "zh-CN");
      url.searchParams.set("include_adult", "false");
      const response = await fetchTmdb(url);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) return { title: "", overview: "" };
      const results = Array.isArray(data.results) ? data.results : [];
      const query = normalizeTitle(title);
      const best = results.find((item) => normalizeTitle(item.original_name) === query || normalizeTitle(item.name) === query)
        || results.find((item) => hasChinese(item.name))
        || null;
      return {
        title: best?.name && hasChinese(best.name) ? best.name : "",
        overview: best?.overview || "",
      };
    } catch {
      return { title: "", overview: "" };
    }
  })();
  animeTitleCache.set(title, promise);
  return promise;
}

async function normalizeAnilistAnime(item) {
  const title = item?.title?.romaji || item?.title?.english || item?.title?.native || "";
  const manualZh = ANIME_ZH[title] || ANIME_ZH[item?.title?.english] || "";
  const tmdbInfo = await fetchTmdbAnimeTitle(title);
  return {
    id: item?.id ? `anilist-${item.id}` : title,
    tmdbId: "",
    title,
    titleZh: manualZh || tmdbInfo.title || (hasChinese(item?.title?.native) ? item.title.native : ""),
    allowOriginalTitle: true,
    titleSource: manualZh ? "manual" : tmdbInfo.title ? "tmdb" : hasChinese(item?.title?.native) ? "native" : "original",
    titleJa: item?.title?.native || "",
    type: "动漫",
    platform: "AniList",
    source: "AniList",
    sourceLabel: "AniList",
    year: item?.seasonYear || "",
    airDate: formatAnilistDate(item?.startDate),
    startDate: formatAnilistDate(item?.startDate),
    episodeCount: item?.episodes || "",
    tmdbRating: item?.averageScore ? String((Number(item.averageScore) / 10).toFixed(1)) : "",
    score: item?.averageScore || "",
    popularity: item?.popularity || "",
    posterUrl: item?.coverImage?.large || item?.coverImage?.medium || "",
    backdropUrl: item?.bannerImage || "",
    summary: cleanDescription(item?.description),
    summaryZh: ANIME_SUMMARY_ZH[title] || tmdbInfo.overview || (hasChinese(item?.description) ? cleanDescription(item?.description) : ""),
    review: cleanDescription(item?.description),
    url: item?.siteUrl || "",
  };
}

async function fetchAnilistSection(id, title, variables) {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: anilistQuery, variables: { page: 1, perPage: 60, ...variables } }),
    cache: "no-store",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.errors) throw new Error(data.errors?.[0]?.message || "AniList 请求失败");
  const raw = data?.data?.Page?.media || [];
  return { id, title, items: (await Promise.all(raw.map(normalizeAnilistAnime))).filter((item) => item.title) };
}

function pickKitsuTitle(attrs) {
  const titles = attrs.titles || {};
  return attrs.canonicalTitle || titles.en_jp || titles.en || titles.ja_jp || "";
}

async function normalizeKitsuAnime(item) {
  const attrs = item?.attributes || {};
  const titles = attrs.titles || {};
  const poster = attrs.posterImage || {};
  const title = pickKitsuTitle(attrs);
  const manualZh = ANIME_ZH[title] || "";
  const tmdbInfo = await fetchTmdbAnimeTitle(title);
  return {
    id: item?.id ? `kitsu-${item.id}` : title,
    title,
    titleZh: manualZh || tmdbInfo.title,
    allowOriginalTitle: true,
    titleSource: manualZh ? "manual" : tmdbInfo.title ? "tmdb" : "original",
    titleJa: titles.ja_jp || "",
    type: "动漫",
    platform: "Kitsu",
    source: "Kitsu",
    sourceLabel: "Kitsu 备用",
    year: String(attrs.startDate || "").slice(0, 4),
    airDate: attrs.startDate || "",
    startDate: attrs.startDate || "",
    episodeCount: attrs.episodeCount || "",
    tmdbRating: attrs.averageRating ? String((Number(attrs.averageRating) / 10).toFixed(1)) : "",
    score: attrs.averageRating || "",
    posterUrl: poster.small || poster.medium || poster.original || "",
    backdropUrl: "",
    summary: attrs.synopsis || "",
    summaryZh: ANIME_SUMMARY_ZH[title] || tmdbInfo.overview || (hasChinese(attrs.synopsis) ? attrs.synopsis : ""),
    review: attrs.synopsis || "",
    url: attrs.slug ? `https://kitsu.app/anime/${attrs.slug}` : "",
  };
}

async function fetchKitsuFallback() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${KITSU_BASE}/anime?filter[status]=current&page[limit]=60&sort=-averageRating`, {
      headers: { Accept: "application/vnd.api+json", "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("bad status " + response.status);
    const data = await response.json();
    const items = (await Promise.all((Array.isArray(data.data) ? data.data : []).map(normalizeKitsuAnime))).filter((item) => item.title);
    return [
      { id: "animeHot", title: "动漫·当前热播", items },
      { id: "animeUpcoming", title: "动漫·即将上线", items: [] },
      { id: "animeHistory", title: "动漫·历史热榜", items },
    ];
  } finally {
    clearTimeout(timer);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return json(cache.payload);

    let sections = [];
    let source = "AniList";
    try {
      sections = await Promise.all([
        fetchAnilistSection("animeHot", "动漫·当前热播", { status: "RELEASING", sort: ["TRENDING_DESC", "POPULARITY_DESC"] }),
        fetchAnilistSection("animeUpcoming", "动漫·即将上线", { status: "NOT_YET_RELEASED", sort: ["POPULARITY_DESC"] }),
        fetchAnilistSection("animeHistory", "动漫·历史热榜", { sort: ["SCORE_DESC", "POPULARITY_DESC"] }),
      ]);
    } catch {
      sections = await fetchKitsuFallback();
      source = "Kitsu";
    }

    const payload = {
      ok: true,
      source,
      sourceNote: source === "AniList"
        ? (tmdbToken ? "AniList 动漫榜单·TMDB 中文名回填" : "AniList 动漫榜单·内置中文名回填")
        : "Kitsu 当前连载动漫·备用数据源",
      generatedAt: new Date().toISOString(),
      items: sections[0]?.items || [],
      sections,
    };
    cache = { expiresAt: Date.now() + 30 * 60 * 1000, payload };
    return json(payload);
  } catch (error) {
    return json({ ok: false, error: error.message || "动漫资讯暂时不可用" }, 500);
  }
}
