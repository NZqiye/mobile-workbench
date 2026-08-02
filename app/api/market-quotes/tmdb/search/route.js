const tmdbToken = process.env.TMDB_ACCESS_TOKEN;
const imageBase = "https://image.tmdb.org/t/p/w342";

function mapResult(item) {
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
  if (!tmdbToken) {
    return Response.json({ error: "缺少 TMDB_ACCESS_TOKEN" }, { status: 500 });
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

  const data = await response.json();
  if (!response.ok) {
    return Response.json(data, { status: response.status });
  }

  const results = (data.results || [])
    .filter((item) => item.media_type === "tv" || item.media_type === "movie")
    .slice(0, 8)
    .map(mapResult);

  return Response.json({ results });
}
