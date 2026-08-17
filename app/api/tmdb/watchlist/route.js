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

async function readWatchlistPage(accountId, page, mediaType = "tv") {
  const apiMediaType = mediaType === "movie" ? "movies" : "tv";
  const url = new URL(`https://api.themoviedb.org/3/account/${accountId}/watchlist/${apiMediaType}`);
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
    const allPages = [];
    for (const mediaType of ["movie", "tv"]) {
      const firstPage = await readWatchlistPage(accountId, 1, mediaType);
      const totalPages = Number(firstPage.total_pages || 1);
      const otherPages = totalPages > 1
        ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => readWatchlistPage(accountId, index + 2, mediaType)))
        : [];
      allPages.push(
        ...[firstPage, ...otherPages].map((page) => ({
          ...page,
          results: (page.results || []).map((item) => ({ ...item, media_type: mediaType })),
        }))
      );
    }
    const results = allPages.flatMap((page) => page.results || []);
    const seen = new Set();
    const uniqueResults = results.filter((item) => {
      const mediaType = item.media_type === "movie" ? "movie" : "tv";
      const key = `${mediaType}:${item.id}`;
      if (!item.id || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const items = await Promise.all(uniqueResults.map(async (item) => {
      const mediaType = item.media_type === "movie" ? "movie" : "tv";
      const baseItem = mapTmdbResult({ ...item, media_type: mediaType });
      try {
        return { ...baseItem, ...(await loadTmdbDetails(item.id, mediaType)) };
      } catch {
        return baseItem;
      }
    }));

    return Response.json({ items, count: items.length, accountId });
  } catch (error) {
    const message = String(error.message || "").includes("Authentication failed")
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
    const message = String(error.message || "").includes("Authentication failed")
      ? "TMDB_SESSION_ID 没有写入片单权限，请重新生成并确认授权后再填到 Vercel。"
      : error.message || "TMDB 待看片单写入失败";
    return Response.json({ error: message }, { status: 500 });
  }
}


export async function DELETE(request) {
  try {
    if (!tmdbToken || !tmdbSessionId) {
      return Response.json({ error: "\u7f3a\u5c11 TMDB_ACCESS_TOKEN \u6216 TMDB_SESSION_ID" }, { status: 500 });
    }

    const body = await request.json();
    const mediaId = Number(body.mediaId);
    const mediaType = body.mediaType === "movie" ? "movie" : "tv";
    if (!mediaId) return Response.json({ error: "\u7f3a\u5c11 TMDB mediaId" }, { status: 400 });

    const accountId = await readAccountId();
    const url = new URL(`https://api.themoviedb.org/3/account/${accountId}/watchlist`);
    url.searchParams.set("session_id", tmdbSessionId);
    const response = await fetchTmdb(url, {
      method: "POST",
      body: JSON.stringify({ media_type: mediaType, media_id: mediaId, watchlist: false }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.status_message || "\u79fb\u9664\u7247\u5355\u5931\u8d25");

    return Response.json({ ok: true, accountId, result: data });
  } catch (error) {
    const message = String(error.message || "").includes("Authentication failed")
      ? "TMDB_SESSION_ID \u6ca1\u6709\u5199\u5165\u7247\u5355\u6743\u9650\uff0c\u8bf7\u91cd\u65b0\u751f\u6210\u5e76\u786e\u8ba4\u6388\u6743\u540e\u518d\u586b\u5230 Vercel\u3002"
      : error.message || "\u79fb\u9664\u7247\u5355\u5931\u8d25";
    return Response.json({ error: message }, { status: 500 });
  }
}
