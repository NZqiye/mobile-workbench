export const tmdbToken = process.env.TMDB_ACCESS_TOKEN;
export const imageBase = "https://image.tmdb.org/t/p/w342";

export function mapResult(item) {
  return {
    tmdbId: item.id,
    title: item.name || item.title || "未命名",
    year: (item.first_air_date || item.release_date || "").slice(0, 4),
    type: item.media_type === "movie" ? "电影" : "剧集",
    platform: "TMDB",
    posterUrl: item.poster_path ? `${imageBase}${item.poster_path}` : "",
    review: item.overview || "",
    nextAirDate: item.first_air_date || item.release_date || "",
    tags: [],
  };
}

export async function GET(request) {
  try {
    if (!tmdbToken) {
      return Response.json({ error: "本地缺少 TMDB_ACCESS_TOKEN，请在 .env.local 中配置 TMDB 读访问令牌" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();
    if (!query) {
      return Response.json({ results: [] });
    }

    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", query);
    url.searchParams.set("language", "zh-CN");
    url.searchParams.set("include_adult", "false");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tmdbToken}`,
        accept: "application/json",
      },
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      return Response.json({ error: data.status_message || "TMDB 请求失败" }, { status: response.status });
    }

    const results = (data.results || [])
      .filter((item) => item.media_type === "tv" || item.media_type === "movie")
      .slice(0, 8)
      .map(mapResult);

    return Response.json({ results });
  } catch (error) {
    const message = error.message === "fetch failed"
      ? "本地网络暂时无法连接 TMDB，线上 Vercel 环境可正常使用"
      : error.message || "TMDB 接口暂时不可用";
    return Response.json({ error: message }, { status: 500 });
  }
}
