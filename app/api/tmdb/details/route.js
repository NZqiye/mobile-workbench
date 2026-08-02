import { loadTmdbDetails, tmdbToken } from "../../../../lib/tmdb";

export async function GET(request) {
  try {
    if (!tmdbToken) {
      return Response.json({ error: "本地缺少 TMDB_ACCESS_TOKEN，请在 .env.local 中配置 TMDB 读访问令牌" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") || "tv";
    if (!id) return Response.json({ error: "缺少 TMDB id" }, { status: 400 });

    return Response.json(await loadTmdbDetails(id, type));
  } catch (error) {
    return Response.json({ error: error.message || "TMDB 详情暂时不可用" }, { status: 500 });
  }
}
