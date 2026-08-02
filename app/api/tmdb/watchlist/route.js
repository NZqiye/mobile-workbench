import { fetchTmdb, loadTmdbDetails, mapTmdbResult, tmdbToken } from "../../../../lib/tmdb";

const tmdbAccountId = process.env.TMDB_ACCOUNT_ID;
const tmdbSessionId = process.env.TMDB_SESSION_ID;

async function readTmdbJson(url, fallbackMessage) {
  const response = await fetchTmdb(url);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || fallbackMessage);
  return data;
}

async function readAccountId() {
  const url = new URL("https://api.themoviedb.org/3/account");
  url.searchParams.set("session_id", tmdbSessionId);
  const account = await readTmdbJson(url, "TMDB 账号信息读取失败");
  return account.id || tmdbAccountId;
}

async function readWatchlistPage(accountId, page) {
  const url = new URL(`https://api.themoviedb.org/3/account/${accountId}/watchlist/tv`);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort_by", "created_at.desc");
  url.searchParams.set("session_id", tmdbSessionId);

  return readTmdbJson(url, "TMDB 片单读取失败");
}

export async function GET() {
  try {
    if (!tmdbToken || !tmdbSessionId) {
      return Response.json({ error: "缺少 TMDB_ACCESS_TOKEN 或 TMDB_SESSION_ID" }, { status: 500 });
    }

    const accountId = await readAccountId();
    const firstPage = await readWatchlistPage(accountId, 1);
    const totalPages = Math.min(Number(firstPage.total_pages || 1), 3);
    const otherPages = totalPages > 1
      ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => readWatchlistPage(accountId, index + 2)))
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

    return Response.json({ items, count: items.length, accountId });
  } catch (error) {
    const message = error.message === "Authentication failed: You do not have permissions to access the service."
      ? "TMDB_SESSION_ID 没有账号片单权限，请重新生成并确认授权后再填到 Vercel。"
      : error.message || "TMDB 片单暂时不可用";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!tmdbToken || !tmdbSessionId) {
      return Response.json({ error: "缺少 TMDB_ACCESS_TOKEN 或 TMDB_SESSION_ID" }, { status: 500 });
    }

    const body = await request.json();
    const mediaId = Number(body.mediaId);
    const mediaType = body.mediaType === "movie" ? "movie" : "tv";
    if (!mediaId) return Response.json({ error: "缺少 TMDB mediaId" }, { status: 400 });

    const accountId = await readAccountId();
    const url = new URL(`https://api.themoviedb.org/3/account/${accountId}/watchlist`);
    url.searchParams.set("session_id", tmdbSessionId);
    const response = await fetchTmdb(url, {
      method: "POST",
      body: JSON.stringify({ media_type: mediaType, media_id: mediaId, watchlist: true }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.status_message || "TMDB 待看片单写入失败");

    return Response.json({ ok: true, accountId, result: data });
  } catch (error) {
    const message = error.message === "Authentication failed: You do not have permissions to access the service."
      ? "TMDB_SESSION_ID 没有写入片单权限，请重新生成并确认授权后再填到 Vercel。"
      : error.message || "TMDB 待看片单写入失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
