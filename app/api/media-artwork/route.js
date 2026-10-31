import { fetchTmdb, tmdbToken } from "../../../lib/tmdb";

const cache = new Map();

async function readJson(url, tmdb = false) {
  const options = { signal: AbortSignal.timeout(8000) };
  const response = await (tmdb ? fetchTmdb(url, options) : fetch(url, options));
  if (!response.ok) throw new Error("Artwork unavailable");
  return response.json();
}

async function loadArtwork(id, type, tvmazeId, bangumiId, anime) {
  const urls = [];
  if (id && tmdbToken) {
    try {
      const details = await readJson(`https://api.themoviedb.org/3/${type}/${id}?append_to_response=images&include_image_language=null,en,zh`, true);
      const paths = [details.backdrop_path, ...(details.images?.backdrops || []).map((image) => image.file_path)];
      if (type === "tv") {
        paths.push(details.last_episode_to_air?.still_path, details.next_episode_to_air?.still_path);
        if (!paths.some(Boolean)) {
          const seasonNumber = details.last_episode_to_air?.season_number || details.seasons?.find((season) => season.season_number > 0)?.season_number;
          if (seasonNumber) {
            const season = await readJson(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`, true);
            paths.push(...(season.episodes || []).map((episode) => episode.still_path));
          }
        }
      }
      urls.push(...paths.filter(Boolean).map((path) => `https://image.tmdb.org/t/p/w780${path}`));
    } catch { /* Keep the original poster when a source is unavailable. */ }
  }
  if (tvmazeId && !urls.length) {
    const results = await Promise.allSettled([
      readJson(`https://api.tvmaze.com/shows/${tvmazeId}/images`),
      readJson(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`),
    ]);
    const images = results[0].status === "fulfilled" ? results[0].value : [];
    const episodes = results[1].status === "fulfilled" ? results[1].value : [];
    urls.push(...images.filter((image) => image.type === "background").map((image) => image.resolutions?.original?.url));
    urls.push(...episodes.map((episode) => episode.image?.original || episode.image?.medium));
  }
  if (bangumiId && !urls.length) {
    try {
      const subject = anime.name && anime.date ? anime : await readJson(`https://api.bgm.tv/v0/subjects/${bangumiId}`);
      const key = (name) => String(name || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const names = new Set([subject.name, subject.name_cn].filter(Boolean).map(key));
      for (const query of [...new Set([subject.name, subject.name_cn].filter(Boolean))]) {
        const data = await readJson(`https://kitsu.app/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=5`);
        const matches = (data.data || []).filter((entry) => {
          const attributes = entry.attributes || {};
          return Object.values(attributes.titles || {}).some((title) => names.has(key(title)))
            && subject.date && attributes.startDate && Math.abs(Number(subject.date.slice(0, 4)) - Number(attributes.startDate.slice(0, 4))) <= 1;
        });
        if (matches.length !== 1) continue;
        const attributes = matches[0].attributes;
        const cover = attributes.coverImage;
        if (cover) urls.push(cover.large || cover.original || cover.small);
        if (!urls.length) {
          const episodes = await readJson(`https://kitsu.app/api/edge/anime/${matches[0].id}/episodes?page[limit]=10`);
          urls.push(...(episodes.data || []).map((episode) => episode.attributes?.thumbnail?.original));
        }
        if (urls.length) break;
      }
    } catch { /* Unmatched seasons retain their own poster. */ }
  }
  return [...new Set(urls.filter(Boolean))].slice(0, 8);
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  const tvmazeId = params.get("tvmazeId") || "";
  const bangumiId = params.get("bangumiId") || "";
  const type = params.get("type") || "tv";
  const anime = { name: (params.get("name") || "").slice(0, 200), name_cn: (params.get("nameCn") || "").slice(0, 200), date: params.get("year") || "" };
  if ((!id && !tvmazeId && !bangumiId) || [id, tvmazeId, bangumiId].some((value) => value && !/^[1-9]\d*$/.test(value)) || !["tv", "movie"].includes(type)) {
    return Response.json({ images: [] }, { status: 400 });
  }
  const key = JSON.stringify([type, id, tvmazeId, bangumiId, anime]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json({ images: await cached.images });
  const images = loadArtwork(id, type, tvmazeId, bangumiId, anime);
  const entry = { images, expires: Date.now() + 15000 };
  cache.set(key, entry);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  const result = await images;
  entry.expires = Date.now() + (result.length ? 15 * 60 * 1000 : 15000);
  return Response.json({ images: result });
}
