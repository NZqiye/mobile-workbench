import { fetchTmdb, mapTmdbResult, tmdbToken } from "../../../lib/tmdb";

const BANGUMI_API = "https://api.bgm.tv";
const BANGUMI_USER_AGENT = "Codex-MobileWorkbench/1.0 (personal anime ranking)";
const SECTION_LIMIT = 60;
const TMDB_CONCURRENCY = 8;
const UPDATE_INTERVAL = 12 * 60 * 60 * 1000;
const STALE_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const TMDB_MATCH_INTERVAL = 12 * 60 * 60 * 1000;
const tmdbMatchCache = new Map();
let cache = null;

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function normalizeTitle(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gi, "");
}

function cleanDescription(text) {
  return String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function animeTitleCandidates(...titles) {
  const candidates = [];
  for (const value of titles) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    candidates.push(raw);
    const stripped = raw
      .replace(/\s*[:：-]?\s*(?:season|第\s*[0-9一二三四五六七八九十]+\s*季|[0-9]+(?:st|nd|rd|th)\s+season|part\s*[0-9ivx]+|cour\s*[0-9]+).*$/i, "")
      .replace(/\s*[:：-]?\s*(?:2nd|3rd|4th|final|the final).*$/i, "")
      .trim();
    if (stripped && stripped !== raw) candidates.push(stripped);
    const mainTitle = raw.split(/\s*[:：]\s*/)[0].trim();
    if (mainTitle && mainTitle !== raw && mainTitle.length >= 2) candidates.push(mainTitle);
  }
  return [...new Set(candidates)];
}

async function fetchBangumiJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": BANGUMI_USER_AGENT,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    throw new Error(`Bangumi \u7f51\u7edc\u8bf7\u6c42\u5931\u8d25: ${error?.cause?.code || error?.message || "fetch failed"}`);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data?.title || data?.message || data?.description || `HTTP ${response.status}`;
    throw new Error(`Bangumi ${response.status}: ${message}`);
  }
  return data;
}

async function searchBangumiSubjects(sort, keyword = "") {
  const url = new URL(`${BANGUMI_API}/v0/search/subjects`);
  url.searchParams.set("limit", String(SECTION_LIMIT));
  url.searchParams.set("offset", "0");
  return fetchBangumiJson(url.toString(), {
    method: "POST",
    body: JSON.stringify({
      keyword,
      sort,
      filter: { type: [2], nsfw: false },
    }),
  });
}

async function fetchBangumiSubjects(sort) {
  try {
    return await searchBangumiSubjects(sort, "");
  } catch (error) {
    if (!/40[0-9]|422/.test(String(error?.message || ""))) throw error;
    return searchBangumiSubjects(sort, "\u52a8\u753b");
  }
}

async function fetchBangumiCalendar() {
  return fetchBangumiJson(`${BANGUMI_API}/calendar`);
}

function subjectHeat(item) {
  const collection = item?.collection || {};
  return ["wish", "collect", "doing", "on_hold", "dropped"]
    .reduce((sum, key) => sum + Number(collection[key] || 0), 0);
}

function subjectRank(item) {
  const rank = Number(item?.rating?.rank || item?.rank || 0);
  return rank > 0 ? rank : Number.MAX_SAFE_INTEGER;
}

function subjectScore(item) {
  const score = Number(item?.rating?.score || 0);
  return Number.isFinite(score) ? score : 0;
}

function normalizeBangumiSubject(item, index) {
  const date = String(item?.date || item?.air_date || "");
  return {
    id: `bangumi-${item?.id || index}`,
    bangumiId: Number(item?.id || 0),
    bangumiType: Number(item?.type || 0),
    nsfw: Boolean(item?.nsfw),
    bangumiName: String(item?.name || ""),
    bangumiNameCn: String(item?.name_cn || ""),
    bangumiSummary: cleanDescription(item?.summary || ""),
    bangumiRank: subjectRank(item),
    bangumiScore: subjectScore(item),
    bangumiHeat: subjectHeat(item),
    bangumiUrl: item?.id ? `https://bgm.tv/subject/${item.id}` : "",
    airWeekday: Number(item?.air_weekday || 0),
    title: String(item?.name_cn || item?.name || "").trim(),
    titleZh: hasChinese(item?.name_cn) ? String(item.name_cn).trim() : "",
    originalTitle: String(item?.name || "").trim(),
    allowOriginalTitle: false,
    year: date.slice(0, 4),
    type: "\u52a8\u6f2b",
    category: "anime",
    platform: "Bangumi",
    source: "Bangumi",
    sourceLabel: "Bangumi",
    tmdbMediaType: "tv",
    posterUrl: "",
    backdropUrl: "",
    tmdbRating: "",
    airDate: date,
    nextAirDate: date,
    summary: "",
    summaryZh: "",
    review: "",
    tags: Array.isArray(item?.meta_tags) ? item.meta_tags : [],
    rank: index + 1,
  };
}

function dedupeBangumiSubjects(items) {
  const byId = new Map();
  for (const item of items) {
    if (!item?.bangumiId || item.nsfw || (item.bangumiType && item.bangumiType !== 2)) continue;
    const current = byId.get(item.bangumiId);
    if (!current) {
      byId.set(item.bangumiId, item);
      continue;
    }
    const score = [item.titleZh, item.bangumiSummary, item.bangumiHeat]
      .filter(Boolean).length;
    const currentScore = [current.titleZh, current.bangumiSummary, current.bangumiHeat]
      .filter(Boolean).length;
    if (score > currentScore) byId.set(item.bangumiId, item);
  }
  return [...byId.values()];
}

function shanghaiWeekday() {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(new Date());
  return { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] || 7;
}

function weekdayDistance(day) {
  const value = Number(day || 0);
  if (value < 1 || value > 7) return 99;
  const today = shanghaiWeekday();
  return value >= today ? value - today : 7 - today + value;
}

function sortBangumiSubjects(items, kind) {
  return [...items].sort((a, b) => {
    if (kind === "hot") return b.bangumiHeat - a.bangumiHeat || a.bangumiRank - b.bangumiRank || b.bangumiScore - a.bangumiScore;
    if (kind === "history") return a.bangumiRank - b.bangumiRank || b.bangumiScore - a.bangumiScore || b.bangumiHeat - a.bangumiHeat;
    return weekdayDistance(a.airWeekday) - weekdayDistance(b.airWeekday) || b.bangumiHeat - a.bangumiHeat;
  });
}

function scoreTmdbMatch(item, subject) {
  const sourceTitles = animeTitleCandidates(subject.bangumiNameCn, subject.bangumiName).map(normalizeTitle).filter(Boolean);
  const names = [item?.name, item?.original_name, item?.title, item?.original_title].map(normalizeTitle).filter(Boolean);
  const exact = names.some((name) => sourceTitles.includes(name));
  const related = names.some((name) => sourceTitles.some((title) => name.includes(title) || title.includes(name)));
  const animation = Array.isArray(item?.genre_ids) && item.genre_ids.includes(16);
  const japanese = String(item?.original_language || "").toLowerCase() === "ja";
  const sourceYear = Number(String(subject.airDate || "").slice(0, 4) || 0);
  const tmdbYear = Number(String(item?.first_air_date || "").slice(0, 4) || 0);
  const yearScore = sourceYear && tmdbYear ? (sourceYear === tmdbYear ? 20 : Math.abs(sourceYear - tmdbYear) <= 1 ? 8 : -20) : 0;
  return (exact ? 100 : related ? 55 : 0) + (animation ? 35 : 0) + (japanese ? 20 : 0) + yearScore + Number(item?.popularity || 0) / 1000;
}

async function searchTmdb(title) {
  const url = new URL("https://api.themoviedb.org/3/search/tv");
  url.searchParams.set("query", title);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("include_adult", "false");
  const response = await fetchTmdb(url, { signal: AbortSignal.timeout(6000) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || "TMDB search failed");
  return Array.isArray(data.results) ? data.results : [];
}

async function findTmdbAnime(subject) {
  if (!tmdbToken) return null;
  const cached = tmdbMatchCache.get(subject.bangumiId);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = (async () => {
    const titles = animeTitleCandidates(subject.bangumiNameCn, subject.bangumiName);
    const results = [];
    for (const title of titles) {
      try {
        results.push(...await searchTmdb(title));
      } catch {
        // Try the next title candidate.
      }
    }
    const candidates = [...new Map(results.filter((item) => item?.id).map((item) => [item.id, item])).values()];
    const best = candidates
      .map((item) => ({ item, score: scoreTmdbMatch(item, subject) }))
      .sort((a, b) => b.score - a.score)[0];
    return best && best.score >= 60 ? best.item : null;
  })().catch((error) => {
    tmdbMatchCache.delete(subject.bangumiId);
    throw error;
  });
  tmdbMatchCache.set(subject.bangumiId, { expiresAt: Date.now() + TMDB_MATCH_INTERVAL, promise });
  return promise;
}

async function enrichWithTmdb(subject) {
  const matched = await findTmdbAnime(subject);
  if (!matched) return null;
  const mapped = mapTmdbResult({ ...matched, media_type: "tv" });
  const tmdbTitle = mapped.title || matched.name || matched.original_name || "";
  const title = hasChinese(tmdbTitle) ? tmdbTitle : subject.bangumiNameCn || tmdbTitle;
  return {
    ...subject,
    ...mapped,
    id: `bangumi-${subject.bangumiId}`,
    title,
    titleZh: hasChinese(title) ? title : "",
    originalTitle: matched.original_name || subject.bangumiName,
    allowOriginalTitle: false,
    platform: "Bangumi",
    source: "Bangumi",
    sourceLabel: "Bangumi",
    dataSource: "TMDB",
    tmdbMediaType: "tv",
    posterUrl: mapped.posterUrl || "",
    backdropUrl: matched.backdrop_path ? `https://image.tmdb.org/t/p/w780${matched.backdrop_path}` : "",
    tmdbRating: mapped.tmdbRating || "",
    summary: cleanDescription(mapped.summary || ""),
    summaryZh: cleanDescription(mapped.summaryZh || ""),
    review: cleanDescription(mapped.review || ""),
    year: mapped.year || subject.year,
    airDate: subject.airDate,
    nextAirDate: subject.airDate,
    bangumiRank: subject.bangumiRank,
    bangumiScore: subject.bangumiScore,
    bangumiHeat: subject.bangumiHeat,
    bangumiUrl: subject.bangumiUrl,
    rank: subject.rank,
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function dedupeMatchedAnime(items) {
  const seenTmdb = new Set();
  const seenBangumi = new Set();
  return items.filter((item) => {
    const tmdbKey = item?.tmdbId ? `tmdb:${item.tmdbId}` : "";
    const bangumiKey = item?.bangumiId ? `bangumi:${item.bangumiId}` : "";
    if ((tmdbKey && seenTmdb.has(tmdbKey)) || (bangumiKey && seenBangumi.has(bangumiKey))) return false;
    if (tmdbKey) seenTmdb.add(tmdbKey);
    if (bangumiKey) seenBangumi.add(bangumiKey);
    return true;
  });
}

async function loadSection(id, title, kind) {
  const payload = kind === "upcoming" ? await fetchBangumiCalendar() : await fetchBangumiSubjects(kind === "hot" ? "heat" : "rank");
  const raw = kind === "upcoming"
    ? (Array.isArray(payload) ? payload : []).flatMap((day) => Array.isArray(day?.items) ? day.items : [])
    : (Array.isArray(payload?.data) ? payload.data : []);
  const normalized = raw.map(normalizeBangumiSubject);
  const candidates = sortBangumiSubjects(dedupeBangumiSubjects(normalized), kind).slice(0, SECTION_LIMIT);
  const enriched = await mapWithConcurrency(candidates, TMDB_CONCURRENCY, enrichWithTmdb);
  return {
    id,
    title,
    items: dedupeMatchedAnime(enriched.filter(Boolean)),
  };
}

function json(payload, status = 200, cacheState = "") {
  return new Response(JSON.stringify(cacheState ? { ...payload, cache: cacheState } : payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "public, s-maxage=43200, stale-while-revalidate=3600" : "no-store",
    },
  });
}

export async function GET() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return json(cache.payload, 200, "hit");

  try {
    if (!tmdbToken) throw new Error("\u7f3a\u5c11 TMDB_ACCESS_TOKEN\uff0c\u65e0\u6cd5\u8865\u5168 Bangumi \u52a8\u6f2b\u6570\u636e");
    const sections = [];
    sections.push(await loadSection("animeHot", "\u52a8\u6f2b\u00b7\u5f53\u524d\u70ed\u64ad", "hot"));
    sections.push(await loadSection("animeUpcoming", "\u52a8\u6f2b\u00b7\u5373\u5c06\u4e0a\u7ebf", "upcoming"));
    sections.push(await loadSection("animeHistory", "\u52a8\u6f2b\u00b7\u5386\u53f2\u70ed\u699c", "history"));
    if (!sections.some((section) => section.items.length)) {
      throw new Error("\u5f53\u524d\u65e0\u6cd5\u83b7\u53d6 Bangumi \u699c\u5355\u6216 TMDB \u4e2d\u6587\u6570\u636e");
    }
    const payload = {
      ok: true,
      source: "Bangumi",
      sourceNote: "Bangumi \u52a8\u6f2b\u699c\u5355\u00b7TMDB \u4e2d\u6587\u6807\u9898\u3001\u4e2d\u6587\u7b80\u4ecb\u4e0e\u6d77\u62a5\u00b7\u5df2\u53bb\u91cd",
      generatedAt: new Date().toISOString(),
      nextUpdateAt: new Date(now + UPDATE_INTERVAL).toISOString(),
      items: sections[0]?.items || [],
      sections,
    };
    cache = { payload, expiresAt: now + UPDATE_INTERVAL, staleUntil: now + STALE_INTERVAL };
    return json(payload, 200, "miss");
  } catch (error) {
    if (cache && cache.staleUntil > now) {
      return json({ ...cache.payload, stale: true, warning: error.message || "Bangumi \u66f4\u65b0\u5931\u8d25" }, 200, "stale");
    }
    return json({ ok: false, error: error.message || "\u52a8\u6f2b\u699c\u5355\u6682\u65f6\u4e0d\u53ef\u7528" }, 502);
  }
}
