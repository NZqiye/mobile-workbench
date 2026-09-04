const TVMAZE_BASE = "https://api.tvmaze.com";
let cache = null;
const NOISE_TYPES = new Set(["News", "Talk Show", "Panel", "Sports", "Game Show", "Quiz Show", "Award Show", "Variety"]);
const SHOW_ZH = {"Battle Through the Heavens":"斗破苍穹","Tales of Demons and Gods":"妖神记","Wan Jie Du Zun":"万界独尊","Lian Qi Shi Wan Nian":"炼气十万年","Soul Land 2: The Unrivaled Tang Sect":"斗罗大陆2：绝世唐门","Fanren Xiu Xian Chuan Zhi Fanren Feng Qi Tian Nan":"凡人修仙传·风起天南","Swallowed Star":"吞噬星空","Shrouding the Heavens":"遮天","Xian Ni":"仙逆","Yi Nian Yong Heng":"一念永恒","Wanmei Shijie":"完美世界","Zhu Xian":"诛仙","LINK CLICK":"时光代理人","The Great Ruler":"大主宰","The Eternal Supreme, Li Yunxiao":"万古至尊：李云霄传","Mushen Ji":"牧神记","GuAn":"一斩苍穹","Dongda Gao Wu Xueyuan":"东大高武学院","Legend of Xianwu":"仙武传","Guangyin Zhi Wai":"光阴之外","Ling Jing Xing Zhe":"灵境行者","Zeri Feisheng":"择日飞升","Caishen Dou Zhanlong":"财神窦占龙","Alchemy Supreme":"丹道至尊","Jue Shi Zhan Hun":"绝世战魂","Shixiong A Shixiong":"师兄啊师兄","Under the Gate":"界门之下","Against the Sky Supreme":"逆天至尊","The Underworld":"话事人","Against the Current":"兰香如故","In My Prime":"生逢其时","The Early Spring":"早春晴朗","The Phoenix's Other Self":"凰权之下，她即是我","Prelude of the White Snake":"浮生之白蛇前缘","See You Later... Maybe":"囧徒之预演告别","Blossom through the Cloud":"飞到我心上","The Legendary Chitose-Sama":"驸马小仵作","Ash":"烟灰","Don't Be Too Emotional":"心动禁止","Your Third":"第三心属","Ted Lasso":"足球教练","Dark Matter":"人生复本","Lanterns":"绿灯军团","Conan O'Brien Must Go":"柯南势在必行","Untold":"体坛秘史","Made in Korea":"韩国制造","Las Azules":"女警出更","The Producer":"接招吧！制作人"};
const PLATFORM_ZH = {"Tencent QQ":"腾讯视频","Youku":"优酷","Mango TV":"芒果TV","Bilibili":"哔哩哔哩","iQIYI":"爱奇艺"};
const KEEP_PLATFORM = {"Netflix":"Netflix","Disney+":"Disney+","HBO":"HBO","HBO Max":"HBO","Apple TV":"Apple TV","Tencent QQ":"Tencent QQ","iQIYI":"iQIYI","Youku":"Youku","Mango TV":"Mango TV","Bilibili":"Bilibili"};

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeEpisode(episode) {
  const show = episode?.show || episode?._embedded?.show || {};
  const platform = KEEP_PLATFORM[show.webChannel?.name || show.network?.name] || "";
  if (!platform) return null;
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
    platformZh: PLATFORM_ZH[platform] || "",
    showType: show.type || "",
    status: show.status || "",
    image: show.image?.medium || "",
    titleZh: SHOW_ZH[show.name] || "",
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
  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    (result.value || []).forEach((episode) => {
      const item = normalizeEpisode(episode);
      if (item && item.title && !NOISE_TYPES.has(item.showType)) items.push(item);
    });
  });
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
      generatedAt: new Date().toISOString(),
      days: results,
    };
    cache = { expiresAt: Date.now() + 10 * 60 * 1000, days, payload };
    return json(payload);
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "更新日历暂时不可用" }, { status: 500 });
  }
}