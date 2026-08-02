import { mapResult, tmdbToken } from "../search/route";

const sections = [
  ["trending", "今日趋势", "https://api.themoviedb.org/3/trending/all/day"],
  ["movies", "电影热门", "https://api.themoviedb.org/3/movie/popular"],
  ["tv", "电视剧热门", "https://api.themoviedb.org/3/tv/popular"],
];

async function loadSection([id, title, source]) {
  const url = new URL(source);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("page", "1");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tmdbToken}`,
      accept: "application/json",
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || "TMDB 推荐请求失败");

  return {
    id,
    title,
    items: (data.results || [])
      .filter((item) => item.media_type !== "person")
      .slice(0, 8)
      .map((item) => mapResult({ ...item, media_type: item.media_type || (id === "tv" ? "tv" : "movie") })),
  };
}

export async function GET() {
  try {
    if (!tmdbToken) {
      return Response.json({ error: "本地缺少 TMDB_ACCESS_TOKEN，请在 .env.local 中配置 TMDB 读访问令牌" }, { status: 500 });
    }

    return Response.json({ sections: await Promise.all(sections.map(loadSection)) });
  } catch (error) {
    const message = error.message === "fetch failed"
      ? "本地网络暂时无法连接 TMDB，线上 Vercel 环境可正常使用"
      : error.message || "TMDB 推荐暂时不可用";
    return Response.json({ error: message }, { status: 500 });
  }
}
