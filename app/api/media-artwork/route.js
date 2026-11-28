import { fetchTmdb, tmdbToken } from "../../../lib/tmdb";

const cache = new Map();

async function readJson(url, tmdb = false) {
  const options = { signal: AbortSignal.timeout(8000) };
  const response = await (tmdb ? fetchTmdb(url, options) : fetch(url, options));
  if (!response.ok) throw new Error("Artwork unavailable");
  return response.json();
}

async function loadArtwork(id, type) {
  const urls = [];
  let posterUrl = "";
  if (id && tmdbToken) {
    try {
      const details = await readJson(`https://api.themoviedb.org/3/${type}/${id}?append_to_response=images&include_image_language=null,en,zh`, true);
      const posters = (details.images?.posters || []).filter((image) => image.file_path);
      const seasonPoster = type === "tv" ? [...(details.seasons || [])].filter((season) => season.season_number > 0 && season.poster_path).sort((left, right) => right.season_number - left.season_number)[0]?.poster_path : "";
      const posterPath = details.poster_path || posters.find((image) => image.iso_639_1 === "zh")?.file_path || posters.find((image) => image.iso_639_1 === "en")?.file_path || posters[0]?.file_path || seasonPoster;
      if (posterPath) posterUrl = `https://image.tmdb.org/t/p/w342${posterPath}`;
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
  return { images: [...new Set(urls.filter(Boolean))].slice(0, 8), posterUrl };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  const type = params.get("type") || "tv";
  if (!/^[1-9]\d*$/.test(id) || !["tv", "movie"].includes(type)) {
    return Response.json({ images: [] }, { status: 400 });
  }
  const key = JSON.stringify([type, id]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json(await cached.images);
  const images = loadArtwork(id, type);
  const entry = { images, expires: Date.now() + 15000 };
  cache.set(key, entry);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  const result = await images;
  entry.expires = Date.now() + (result.images.length || result.posterUrl ? 15 * 60 * 1000 : 15000);
  return Response.json(result);
}
