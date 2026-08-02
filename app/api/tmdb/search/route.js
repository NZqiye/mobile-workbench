import { fetchTmdb, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

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

    const response = await fetchTmdb(url);

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      return Response.json({ error: data.status_message || "TMDB 请求失败" }, { status: response.status });
    }

    const results = (data.results || [])
      .filter((item) => item.media_type === "tv" || item.media_type === "movie")
      .slice(0, 8)
      .map(mapTmdbResult);

    return Response.json({ results });
  } catch (error) {
    const message = error.message === "fetch failed"
      ? "暂时无法连接 TMDB，请稍后重试"
      : error.message || "TMDB 接口暂时不可用";
    return Response.json({ error: message }, { status: 500 });
  }
}
