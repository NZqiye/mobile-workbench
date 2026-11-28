export function seriesWatchProgress(seasons, savedProgress, currentSeason, checkedEpisodes, currentCount, episodeNumbersBySeason = {}) {
  let total = 0, watched = 0;
  for (const season of seasons) {
    const active = Number(season.seasonNumber) === Number(currentSeason);
    const count = Number(active ? currentCount || season.episodeCount : season.episodeCount);
    if (!Number.isInteger(count) || count <= 0) return null;
    const episodes = active ? checkedEpisodes : savedProgress?.[String(season.seasonNumber)] || [];
    const numbers = episodeNumbersBySeason[String(season.seasonNumber)] || season.episodeNumbers;
    const expected = new Set(numbers?.length ? numbers.map(Number) : Array.from({ length: count }, (_, index) => index + 1));
    if (expected.size !== count) return null;
    watched += new Set(Array.from(episodes, Number).filter(number => expected.has(number))).size;
    total += count;
  }
  return total > 0 ? { total, watched, percent: Math.round(watched / total * 100) } : null;
}
