export function seriesWatchProgress(seasons, savedProgress, currentSeason, checkedEpisodes, currentCount) {
  let total = 0, watched = 0;
  for (const season of seasons) {
    const active = Number(season.seasonNumber) === Number(currentSeason);
    const count = Number(active ? currentCount || season.episodeCount : season.episodeCount);
    if (!Number.isInteger(count) || count <= 0) return null;
    const episodes = active ? checkedEpisodes : savedProgress?.[String(season.seasonNumber)] || [];
    watched += new Set(Array.from(episodes, Number).filter(number => Number.isInteger(number) && number > 0 && number <= count)).size;
    total += count;
  }
  return total > 0 ? { total, watched, percent: Math.round(watched / total * 100) } : null;
}
