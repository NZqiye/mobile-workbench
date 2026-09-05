import { fetchTmdb, tmdbToken } from "../../../lib/tmdb";

const TVMAZE_BASE = "https://api.tvmaze.com";
let cache = null;
const NOISE_TYPES = new Set(["News", "Talk Show", "Panel", "Sports", "Game Show", "Quiz Show", "Award Show", "Variety"]);
const SHOW_ZH = {"Battle Through the Heavens":"斗破苍穹","Tales of Demons and Gods":"妖神记","Wan Jie Du Zun":"万界独尊","Lian Qi Shi Wan Nian":"炼气十万年","Soul Land 2: The Unrivaled Tang Sect":"斗罗大陆2：绝世唐门","Fanren Xiu Xian Chuan Zhi Fanren Feng Qi Tian Nan":"凡人修仙传·风起天南","Swallowed Star":"吞噬星空","Shrouding the Heavens":"遮天","Xian Ni":"仙逆","Yi Nian Yong Heng":"一念永恒","Wanmei Shijie":"完美世界","Zhu Xian":"诛仙","LINK CLICK":"时光代理人","The Great Ruler":"大主宰","The Eternal Supreme, Li Yunxiao":"万古至尊：李云霄传","Mushen Ji":"牧神记","GuAn":"一斩苍穹","Dongda Gao Wu Xueyuan":"东大高武学院","Legend of Xianwu":"仙武传","Guangyin Zhi Wai":"光阴之外","Ling Jing Xing Zhe":"灵境行者","Zeri Feisheng":"择日飞升","Caishen Dou Zhanlong":"财神窦占龙","Alchemy Supreme":"丹道至尊","Jue Shi Zhan Hun":"绝世战魂","Shixiong A Shixiong":"师兄啊师兄","Under the Gate":"界门之下","Against the Sky Supreme":"逆天至尊","The Underworld":"话事人","Against the Current":"兰香如故","In My Prime":"生逢其时","The Early Spring":"早春晴朗","The Phoenix's Other Self":"凰权之下，她即是我","Prelude of the White Snake":"浮生之白蛇前缘","See You Later... Maybe":"囧徒之预演告别","Blossom through the Cloud":"飞到我心上","The Legendary Chitose-Sama":"驸马小仵作","Ash":"烟灰","Don't Be Too Emotional":"心动禁止","Your Third":"第三心属","Ted Lasso":"足球教练","Dark Matter":"人生复本","Lanterns":"绿灯军团","Conan O'Brien Must Go":"柯南势在必行","Untold":"体坛秘史","Made in Korea":"韩国制造","Las Azules":"女警出更","The Producer":"接招吧！制作人"};
const PLATFORM_ZH = {"Tencent QQ":"腾讯视频","Youku":"优酷","Mango TV":"芒果TV","Bilibili":"哔哩哔哩","iQIYI":"爱奇艺"};
const KEEP_PLATFORM = {"Netflix":"Netflix","Disney+":"Disney+","HBO":"HBO","HBO Max":"HBO","Apple TV":"Apple TV","Tencent QQ":"Tencent QQ","iQIYI":"iQIYI","Youku":"Youku","Mango TV":"Mango TV","Bilibili":"Bilibili"};
const PLATFORM_CALIBRATION = {
  Netflix: { displayName: "Netflix", level: "高", score: 0.95, note: "全球流媒体，TVMaze 命中通常最稳定。" },
  "Disney+": { displayName: "Disney+", level: "高", score: 0.94, note: "全球流媒体，平台名和排期都较稳。" },
  HBO: { displayName: "HBO", level: "高", score: 0.93, note: "HBO / HBO Max 统一按 HBO 处理。" },
  "Apple TV": { displayName: "Apple TV", level: "高", score: 0.92, note: "官方平台名稳定。" },
  "Tencent QQ": { displayName: "腾讯视频", level: "中", score: 0.82, note: "中文平台别名较多，排期可用但需容忍少量别名。" },
  iQIYI: { displayName: "爱奇艺", level: "中", score: 0.81, note: "中文平台别名较多，适合参考。" },
  Youku: { displayName: "优酷", level: "中", score: 0.8, note: "中文平台名稳定，但别名映射偶尔会变。" },
  "Mango TV": { displayName: "芒果TV", level: "中", score: 0.79, note: "中文平台名稳定，排期以 TVMaze 为准。" },
  Bilibili: { displayName: "哔哩哔哩", level: "中", score: 0.78, note: "更适合番剧和少量国产内容。" },
};
const akaCache = new Map();
const tmdbTitleCache = new Map();
const titleCache = new Map();

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function normalizeTitle(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gi, "");
}

function getPlatformCalibration(platform) {
  return PLATFORM_CALIBRATION[platform] || { displayName: PLATFORM_ZH[platform] || platform, level: "中", score: 0.75, note: "TVMaze 原始平台名，作为参考。" };
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function fetchShowAkas(showId) {
  if (!showId) return [];
  if (akaCache.has(showId)) return akaCache.get(showId);
  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${TVMAZE_BASE}/shows/${showId}/akas`, { signal: controller.signal });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  })();
  akaCache.set(showId, promise);
  return promise;
}

function pickChineseAlias(akas = []) {
  const preferredCountryCodes = new Set(["CN", "HK", "TW", "MO", "SG", "MY"]);
  const entries = Array.isArray(akas) ? akas.filter((aka) => aka && aka.name) : [];
  return (
    entries.find((aka) => preferredCountryCodes.has(aka.country?.code) && hasChinese(aka.name))?.name ||
    entries.find((aka) => hasChinese(aka.name))?.name ||
    entries.find((aka) => preferredCountryCodes.has(aka.country?.code))?.name ||
    ""
  );
}

async function fetchTmdbTitle(show) {
  if (!tmdbToken || !show?.name) return "";
  const cacheKey = `${show.name}|${show.premiered || ""}`;
  if (tmdbTitleCache.has(cacheKey)) return tmdbTitleCache.get(cacheKey);
  const promise = (async () => {
    try {
      const url = new URL("https://api.themoviedb.org/3/search/tv");
      url.searchParams.set("query", show.name);
      url.searchParams.set("language", "zh-CN");
      url.searchParams.set("include_adult", "false");
      if (show.premiered) url.searchParams.set("first_air_date_year", String(show.premiered).slice(0, 4));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetchTmdb(url, { signal: controller.signal });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) return "";
        const results = Array.isArray(data.results) ? data.results : [];
        const query = normalizeTitle(show.name);
        const best = results.find((item) => normalizeTitle(item.name) === query || normalizeTitle(item.original_name) === query)
          || results.find((item) => hasChinese(item.name) || hasChinese(item.original_name))
          || results[0];
        const name = best?.name || "";
        return name && name !== show.name ? name : "";
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return "";
    }
  })();
  tmdbTitleCache.set(cacheKey, promise);
  return promise;
}

async function resolveTitleZh(show) {
  if (!show?.name) return { titleZh: "", titleSource: "original" };
  if (titleCache.has(show.id || show.name)) return titleCache.get(show.id || show.name);
  const promise = (async () => {
    const manual = SHOW_ZH[show.name];
    if (manual) return { titleZh: manual, titleSource: "manual" };
    const akas = await fetchShowAkas(show.id);
    const akaZh = pickChineseAlias(akas);
    if (akaZh && akaZh !== show.name) return { titleZh: akaZh, titleSource: "tvmaze-aka" };
    const tmdbZh = await fetchTmdbTitle(show);
    if (tmdbZh && tmdbZh !== show.name) return { titleZh: tmdbZh, titleSource: "tmdb" };
    return { titleZh: "", titleSource: "original" };
  })();
  titleCache.set(show.id || show.name, promise);
  return promise;
}

async function normalizeEpisode(episode) {
  const show = episode?.show || episode?._embedded?.show || {};
  const platform = KEEP_PLATFORM[show.webChannel?.name || show.network?.name] || "";
  if (!platform) return null;
  const calibration = getPlatformCalibration(platform);
  const titleZh = await resolveTitleZh(show);
  return {
    id: episode?.id || "",
    title: show.name || "",
    episodeName: episode?.name || "",
    season: episode?.season ?? "",
    number: episode?.number ?? "",
    airdate: episode?.airdate || "",
    airtime: episode?.airtime || "",
    type: episode?.type || "",
    platform,
    platformZh: calibration.displayName,
    platformLevel: calibration.level,
    platformScore: calibration.score,
    platformNote: calibration.note,
    showType: show.type || "",
    status: show.status || "",
    image: show.image?.medium || "",
    titleZh: titleZh.titleZh,
    titleSource: titleZh.titleSource,
  };
}

async function fetchJson(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: controller.signal });
    if (!response.ok) throw new Error("bad status " + response.status);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDay(dateKeyValue) {
  const settled = await Promise.allSettled([
    fetchJson(`${TVMAZE_BASE}/schedule?country=US&date=${dateKeyValue}`),
    fetchJson(`${TVMAZE_BASE}/schedule/web?date=${dateKeyValue}`),
  ]);
  const items = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const episode of result.value || []) {
      const item = await normalizeEpisode(episode);
      if (item && item.title && !NOISE_TYPES.has(item.showType)) items.push(item);
    }
  }
  const seen = new Set();
  return items.filter((item) => {
    const key = [item.title, item.platform, item.season, item.number, item.episodeName].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function json(payload) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(7, Math.max(1, Number(searchParams.get("days")) || 7));
    const now = Date.now();
    if (cache && cache.expiresAt > now && cache.days === days) {
      return json(cache.payload);
    }

    const dayList = Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return { key: dateKey(date), offset: index };
    });

    const results = [];
    for (const day of dayList) {
      let items = await fetchDay(day.key);
      if (!items.length) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        items = await fetchDay(day.key);
      }
      items.sort((a, b) => String(a.airtime || "99:99").localeCompare(String(b.airtime || "99:99")));
      results.push({ date: day.key, offset: day.offset, items });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const payload = {
      ok: true,
      source: "TVMaze",
      sourceNote: tmdbToken ? "TVMaze 排期 · 中文名回填（TVMaze AKAs / TMDB）" : "TVMaze 排期 · 中文名回填（TVMaze AKAs）",
      generatedAt: new Date().toISOString(),
      platforms: Object.fromEntries((() => {
        const map = new Map();
        for (const item of results.flatMap((day) => day.items)) {
          const current = map.get(item.platform) || {
            key: item.platform,
            displayName: item.platformZh || item.platform,
            level: item.platformLevel || "中",
            score: item.platformScore || 0.75,
            note: item.platformNote || "TVMaze 原始平台名，作为参考。",
            count: 0,
          };
          current.count += 1;
          map.set(item.platform, current);
        }
        return Array.from(map.entries());
      })()),
      days: results,
    };
    cache = { expiresAt: Date.now() + 10 * 60 * 1000, days, payload };
    return json(payload);
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "更新日历暂时不可用" }, { status: 500 });
  }
}
