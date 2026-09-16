import { fetchTmdb, tmdbToken } from "../../../../lib/tmdb";
import { isAuthorized, parseMediaInput, readJson, unauthorizedResponse } from "../../../../lib/access-auth";

export async function POST(request) {
  try {
    if (!isAuthorized(request)) return unauthorizedResponse();
    if (!tmdbToken || !process.env.TMDB_SESSION_ID) {
      return Response.json({ error: "缺少 TMDB_ACCESS_TOKEN 或 TMDB_SESSION_ID" }, { status: 500 });
    }
    let body;
    let mediaId;
    let mediaType;
    try {
      body = await readJson(request, 4096);
      ({ mediaId, mediaType } = parseMediaInput(body));
    } catch (error) {
      return Response.json({ error: error.message || "TMDB 参数无效" }, { status: error.message === "请求体过大" ? 413 : 400 });
    }
    const rawRating = Number(body.rating);
    if (!Number.isFinite(rawRating) || rawRating < 0.5 || rawRating > 10) return Response.json({ error: "评分必须在 0.5 到 10 之间" }, { status: 400 });
    const rating = Math.round(rawRating * 2) / 2;

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
