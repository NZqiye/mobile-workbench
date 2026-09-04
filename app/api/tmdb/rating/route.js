import { fetchTmdb, tmdbToken } from "../../../../lib/tmdb";

export async function POST(request) {
  try {
    if (!tmdbToken || !process.env.TMDB_SESSION_ID) {
      return Response.json({ error: "缺少 TMDB_ACCESS_TOKEN 或 TMDB_SESSION_ID" }, { status: 500 });
    }
    const body = await request.json();
    const mediaId = Number(body.mediaId);
    const mediaType = body.mediaType === "movie" ? "movie" : "tv";
    const rating = Number(body.rating);
    if (!mediaId) return Response.json({ error: "缺少 TMDB mediaId" }, { status: 400 });
    if (!Number.isFinite(rating) || rating < 0.5 || rating > 10) return Response.json({ error: "评分必须在 0.5 到 10 之间" }, { status: 400 });

    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/rating`);
    url.searchParams.set("session_id", process.env.TMDB_SESSION_ID);
    const response = await fetchTmdb(url, { method: "POST", body: JSON.stringify({ value: rating }) });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.status_message || "TMDB 评分同步失败");
    return Response.json({ ok: true, result: data });
  } catch (error) {
    return Response.json({ error: error.message || "TMDB 评分同步失败" }, { status: 500 });
  }
}
