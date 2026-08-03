export const tmdbToken = process.env.TMDB_ACCESS_TOKEN;
export const imageBase = "https://image.tmdb.org/t/p/w342";

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
  return {
    tmdbId: item.id,
    title: item.name || item.title || "未命名",
    year: (item.first_air_date || item.release_date || "").slice(0, 4),
    type: item.media_type === "movie" ? "电影" : "剧集",
    platform: "TMDB",
    tmdbMediaType: item.media_type || (item.first_air_date ? "tv" : "movie"),
    posterUrl: item.poster_path ? `${imageBase}${item.poster_path}` : "",
    review: item.overview || "",
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

function pickSeason(details) {
  return details.next_episode_to_air?.season_number
    || details.last_episode_to_air?.season_number
    || details.seasons?.find((season) => season.season_number > 0)?.season_number
    || 1;
}

function summarizeEpisodes(episodes, nextEpisode) {
  const today = dateKey();
  const upcoming = episodes
    .filter((episode) => episode.air_date && episode.air_date >= today)
    .sort((a, b) => String(a.air_date).localeCompare(String(b.air_date)) || a.episode_number - b.episode_number);
  const nextDate = upcoming[0]?.air_date || nextEpisode?.air_date || "";
  const sameDay = nextDate ? upcoming.filter((episode) => episode.air_date === nextDate) : [];
  const updateEpisodes = sameDay.length ? sameDay : nextEpisode ? [nextEpisode] : [];
  const previous = episodes
    .filter((episode) => episode.air_date && nextDate && episode.air_date < nextDate)
    .sort((a, b) => b.episode_number - a.episode_number)[0];

  return {
    currentEpisode: previous?.episode_number ? String(previous.episode_number) : "",
    nextAirDate: nextDate,
    updateEpisodes: updateEpisodes.map((episode) => episode.episode_number).filter(Boolean).join(","),
    episodeSchedule: (upcoming.length ? upcoming : updateEpisodes).map((episode) => ({
      date: episode.air_date || "",
      episode: episode.episode_number || "",
      title: episode.name || "",
      season: episode.season_number || "",
    })).filter((episode) => episode.date && episode.episode),
  };
}

export async function loadTmdbDetails(id, type = "tv") {
  const detailsUrl = new URL(`https://api.themoviedb.org/3/${type}/${id}`);
  detailsUrl.searchParams.set("language", "zh-CN");
  const details = await readTmdb(detailsUrl);

  if (type === "movie") {
    return {
      title: details.title || "",
      year: (details.release_date || "").slice(0, 4),
      posterUrl: details.poster_path ? `${imageBase}${details.poster_path}` : "",
      review: details.overview || "",
      nextAirDate: details.release_date || "",
      tags: (details.genres || []).map((genre) => genre.name).filter(Boolean),
    };
  }

  const seasonNumber = pickSeason(details);
  const seasonUrl = new URL(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`);
  seasonUrl.searchParams.set("language", "zh-CN");
  const season = await readTmdb(seasonUrl);
  const episodeSummary = summarizeEpisodes(season.episodes || [], details.next_episode_to_air);

  return {
    title: details.name || "",
    year: (details.first_air_date || "").slice(0, 4),
    posterUrl: details.poster_path ? `${imageBase}${details.poster_path}` : "",
    review: details.overview || "",
    season: String(seasonNumber),
    totalEpisodes: String((season.episodes || []).length || season.episode_count || details.number_of_episodes || ""),
    tags: (details.genres || []).map((genre) => genre.name).filter(Boolean),
    ...episodeSummary,
  };
}
