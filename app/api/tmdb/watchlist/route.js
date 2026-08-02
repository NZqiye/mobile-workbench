import { fetchTmdb, loadTmdbDetails, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

const tmdbAccountId = process.env.TMDB_ACCOUNT_ID;
const tmdbSessionId = process.env.TMDB_SESSION_ID;

async function readWatchlistPage(page) {
  const url = new URL(`https://api.themoviedb.org/3/account/${tmdbAccountId}/watchlist/tv`);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort_by", "created_at.desc");
  url.searchParams.set("session_id", tmdbSessionId);

  const response = await fetchTmdb(url);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || "TMDB 片单读取失败");
  return data;
}

export async function GET() {
  try {
    if (!tmdbToken || !tmdbAccountId || !tmdbSessionId) {
      return Response.json({ error: "缺少 TMDB_ACCESS_TOKEN、TMDB_ACCOUNT_ID 或 TMDB_SESSION_ID" }, { status: 500 });
    }

    const firstPage = await readWatchlistPage(1);
    const totalPages = Math.min(Number(firstPage.total_pages || 1), 3);
    const otherPages = totalPages > 1
      ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => readWatchlistPage(index + 2)))
      : [];
    const results = [firstPage, ...otherPages].flatMap((page) => page.results || []);
    const seen = new Set();

    const items = await Promise.all(results
      .filter((item) => {
        if (!item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(async (item) => {
        const baseItem = mapTmdbResult({ ...item, media_type: "tv" });
        try {
          return { ...baseItem, ...(await loadTmdbDetails(item.id, "tv")) };
        } catch {
          return baseItem;
        }
      }));

    return Response.json({ items, count: items.length });
  } catch (error) {
    return Response.json({ error: error.message || "TMDB 片单暂时不可用" }, { status: 500 });
  }
}
