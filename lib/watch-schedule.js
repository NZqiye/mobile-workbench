export function parseEpisodeList(value, fallbackEpisode) {
  const text = String(value || "").trim();
  if (!text) return fallbackEpisode ? [fallbackEpisode] : [];
  const range = text.match(/^(\d+)\s*[-~至到]\s*(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }
  return text
    .split(/[,，、\s]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
}

export function watchEntriesForDate(items, dateKey) {
  return items.flatMap((item) => {
    if (Array.isArray(item.episodeSchedule) && item.episodeSchedule.length) {
      return item.episodeSchedule
        .filter((episode) => episode.date === dateKey)
        .map((episode) => ({
          ...item,
          nextAirDate: episode.date,
          updateEpisode: episode.episode,
          episodeTitle: episode.title || "",
          season: episode.season || item.season,
        }));
    }

    if (item.nextAirDate !== dateKey) return [];
    const current = Number(item.currentEpisode || 0);
    const episodes = parseEpisodeList(item.updateEpisodes, current > 0 ? current + 1 : 0);
    return (episodes.length ? episodes : [0]).map((episode) => ({ ...item, updateEpisode: episode }));
  });
}
