function normalizeEnvValue(value) {
  return String(value || '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^.*apikey=([^&\s]+).*$/i, '$1')
    .trim();
}

export const tmdbToken = normalizeEnvValue(process.env.TMDB_ACCESS_TOKEN);
export const imageBase = "https://image.tmdb.org/t/p/w342";
const stillBase = "https://image.tmdb.org/t/p/w300";

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

export async function fetchTmdb(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tmdbToken}`,
      accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
}

export function mapTmdbResult(item) {
  const title = item.name || item.title || item.original_name || item.original_title || "未命名";
  const originalTitle = item.original_name || item.original_title || title;
  const overview = item.overview || "";
  return {
    tmdbId: item.id,
    title,
    titleZh: hasChinese(title) ? title : "",
    originalTitle,
    allowOriginalTitle: true,
    year: (item.first_air_date || item.release_date || "").slice(0, 4),
    type: item.media_type === "movie" ? "电影" : "剧集",
    platform: "TMDB",
    tmdbMediaType: item.media_type || (item.first_air_date ? "tv" : "movie"),
    posterUrl: item.poster_path ? `${imageBase}${item.poster_path}` : "",
    tmdbRating: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average).toFixed(1) : "",
    review: overview,
    summary: overview,
    summaryZh: hasChinese(overview) ? overview : "",
    nextAirDate: item.media_type === "movie" ? item.release_date || "" : "",
    tags: [],
  };
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function readTmdb(url) {
  const response = await fetchTmdb(url);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.status_message || "TMDB 详情请求失败");
  return data;
}

function localizedDetails(details) {
  const translation = (details?.translations?.translations || []).find((entry) => ["CN", "TW", "HK"].includes(entry.iso_3166_1) && entry.data);
  return translation?.data || {};
}

function pickSeason(details) {
  return details.next_episode_to_air?.season_number
    || details.last_episode_to_air?.season_number
    || details.seasons?.find((season) => season.season_number > 0)?.season_number
    || 1;
}

function summarizeEpisodes(episodes, nextEpisode) {
  const today = dateKey();
  const upcoming = episodes
    .filter((episode) => episode.airDate && episode.airDate >= today)
    .sort((a, b) => String(a.airDate).localeCompare(String(b.airDate)) || a.episodeNumber - b.episodeNumber);
  const nextDate = upcoming[0]?.airDate || nextEpisode?.air_date || "";
  const sameDay = nextDate ? upcoming.filter((episode) => episode.airDate === nextDate) : [];
  const updateEpisodes = sameDay.length ? sameDay : nextEpisode ? [nextEpisode] : [];
  const previous = episodes
    .filter((episode) => episode.airDate && nextDate && episode.airDate < nextDate)
    .sort((a, b) => b.episodeNumber - a.episodeNumber)[0];

  return {
    currentEpisode: previous?.episodeNumber ? String(previous.episodeNumber) : "",
    nextAirDate: nextDate,
    updateEpisodes: updateEpisodes.map((episode) => episode.episodeNumber ?? episode.episode_number).filter(Boolean).join(","),
    episodeSchedule: (upcoming.length ? upcoming : updateEpisodes).map((episode) => ({
      date: episode.airDate || episode.air_date || "",
      episode: episode.episodeNumber ?? episode.episode_number ?? "",
      title: episode.name || "",
      season: episode.seasonNumber ?? episode.season_number ?? "",
    })).filter((episode) => episode.date && episode.episode),
  };
}

function normalizeTmdbSeason(season) {
  return {
    seasonNumber: Number(season?.season_number || 0),
    name: season?.name || "",
    overview: season?.overview || "",
    airDate: season?.air_date || "",
    episodeCount: Number(season?.episode_count || 0),
    posterUrl: season?.poster_path ? `${imageBase}${season.poster_path}` : "",
  };
}

function normalizeTmdbEpisode(episode) {
  return {
    id: episode?.id || "",
    seasonNumber: Number(episode?.season_number || 0),
    episodeNumber: Number(episode?.episode_number || 0),
    name: episode?.name || "",
    overview: episode?.overview || "",
    airDate: episode?.air_date || "",
    runtime: Number(episode?.runtime || 0),
    stillUrl: episode?.still_path ? `${stillBase}${episode.still_path}` : "",
    voteAverage: Number.isFinite(Number(episode?.vote_average)) ? Number(episode.vote_average).toFixed(1) : "",
  };
}

export async function loadTmdbSeasonDetails(id, seasonNumber) {
  const normalizedSeasonNumber = Number(seasonNumber);
  if (!Number.isInteger(normalizedSeasonNumber) || normalizedSeasonNumber < 1) {
    throw new Error("TMDB 季数无效");
  }
  const seasonUrl = new URL(`https://api.themoviedb.org/3/tv/${id}/season/${normalizedSeasonNumber}`);
  seasonUrl.searchParams.set("language", "zh-CN");
  const season = await readTmdb(seasonUrl);
  return {
    ...normalizeTmdbSeason(season),
    seasonNumber: normalizedSeasonNumber,
    episodeCount: Number(season.episode_count || season.episodes?.length || 0),
    episodes: (Array.isArray(season.episodes) ? season.episodes : []).map(normalizeTmdbEpisode),
  };
}

export async function loadTmdbDetails(id, type = "tv") {
  const detailsUrl = new URL(`https://api.themoviedb.org/3/${type}/${id}`);
  detailsUrl.searchParams.set("language", "zh-CN");
  detailsUrl.searchParams.set("append_to_response", "translations");
  const details = await readTmdb(detailsUrl);
  const translation = localizedDetails(details);

  if (type === "movie") {
    return {
      title: translation.title || details.title || "",
      year: (details.release_date || "").slice(0, 4),
      posterUrl: details.poster_path ? `${imageBase}${details.poster_path}` : "",
      backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : "",
      tmdbRating: Number.isFinite(Number(details.vote_average)) ? Number(details.vote_average).toFixed(1) : "",
      review: translation.overview || details.overview || "",
      nextAirDate: details.release_date || "",
      tags: (details.genres || []).map((genre) => genre.name).filter(Boolean),
    };
  }

  const seasonNumber = pickSeason(details);
  const season = await loadTmdbSeasonDetails(id, seasonNumber);
  const episodeSummary = summarizeEpisodes(season.episodes || [], details.next_episode_to_air);

  return {
    title: translation.name || details.name || "",
    year: (details.first_air_date || "").slice(0, 4),
    posterUrl: details.poster_path ? `${imageBase}${details.poster_path}` : "",
    backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : "",
    tmdbRating: Number.isFinite(Number(details.vote_average)) ? Number(details.vote_average).toFixed(1) : "",
    review: translation.overview || details.overview || "",
    season: String(seasonNumber),
    totalEpisodes: String((season.episodes || []).length || season.episodeCount || details.number_of_episodes || ""),
    seasons: (Array.isArray(details.seasons) ? details.seasons : [])
      .map(normalizeTmdbSeason)
      .filter((seasonItem) => seasonItem.seasonNumber > 0),
    tags: (details.genres || []).map((genre) => genre.name).filter(Boolean),
    ...episodeSummary,
  };
}
