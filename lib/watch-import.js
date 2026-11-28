function mediaKey(item) {
  const type = item.tmdbMediaType || (item.type === "电影" ? "movie" : "tv");
  return item.tmdbId ? `${type}:${item.tmdbId}` : "";
}

function mergeProgress(existing = {}, incoming = {}) {
  const result = { ...existing };
  for (const [season, episodes] of Object.entries(incoming)) {
    result[season] = [...new Set([...(result[season] || []), ...episodes].map(Number))].sort((left, right) => left - right);
  }
  return result;
}

export function mergeWatchImport(existing, incoming, now = Date.now()) {
  const consultations = (existing.consultations || []).map(item => ({ ...item }));
  const watchCheckins = (existing.watchCheckins || []).map(item => ({ ...item }));
  const byMedia = new Map(consultations.map((item, index) => [mediaKey(item), index]).filter(([key]) => key));
  const deletedMedia = new Set((existing.deletedTmdbWatchlist || []).map(item => typeof item === "object" ? `${item.mediaType || item.tmdbMediaType || (item.type === "电影" ? "movie" : "tv")}:${item.tmdbId}` : `tv:${item}`));
  const deletedItems = new Set(existing["deletedIds:consultations"] || []);
  const deletedCheckins = new Set(existing["deletedIds:watchCheckins"] || []);
  const references = new Map();
  const summary = { addedTitles: 0, matchedTitles: 0, addedHistory: 0, matchedHistory: 0, skippedDeleted: 0, ratingConflicts: [] };
  for (const item of incoming.consultations || []) {
    const key = mediaKey(item);
    if (deletedMedia.has(key) || deletedItems.has(item.id)) { summary.skippedDeleted++; continue; }
    const index = byMedia.get(key);
    if (index === undefined) {
      const added = { ...item, updatedAt: now };
      consultations.push(added);
      if (key) byMedia.set(key, consultations.length - 1);
      references.set(item.id, added.id);
      summary.addedTitles++;
      continue;
    }
    const current = consultations[index];
    if (deletedItems.has(current.id)) { summary.skippedDeleted++; continue; }
    references.set(item.id, current.id);
    const ratingConflict = current.rating && item.rating && Number(current.rating) !== Number(item.rating);
    if (ratingConflict) summary.ratingConflicts.push({ title: current.title, existing: current.rating, imported: item.rating });
    const additions = Object.fromEntries(Object.entries(item).filter(([name, value]) => (current[name] === undefined || current[name] === null || current[name] === "") && value !== ""));
    const progress = mergeProgress(current.seasonProgress, item.seasonProgress);
    const seasons = current.seasons?.length ? current.seasons : item.seasons || [];
    const complete = seasons.length > 0 && seasons.every(season => {
      const episodes = new Set(progress[String(season.seasonNumber)] || []);
      const expected = current.seasonEpisodeNumbers?.[String(season.seasonNumber)] || item.seasonEpisodeNumbers?.[String(season.seasonNumber)] || Array.from({ length: season.episodeCount }, (_, offset) => offset + 1);
      return season.episodeCount > 0 && expected.length === season.episodeCount && expected.every(episode => episodes.has(episode));
    });
    const preserveStatus = ["暂停/弃剧", "已归档"].includes(current.status);
    const status = preserveStatus ? current.status : current.status === "看过的剧" || item.tmdbMediaType === "movie" && item.status === "看过的剧" || complete ? "看过的剧" : Object.values(progress).some(episodes => episodes.length) ? "正在看" : current.status || item.status;
    consultations[index] = {
      ...current, ...additions, id: current.id, status, seasonProgress: progress,
      seasonRatings: { ...item.seasonRatings, ...Object.fromEntries(Object.entries(current.seasonRatings || {}).filter(([, rating]) => String(rating || "").trim())) },
      seasonEpisodeCounts: { ...item.seasonEpisodeCounts, ...current.seasonEpisodeCounts },
      seasonEpisodeNumbers: { ...item.seasonEpisodeNumbers, ...current.seasonEpisodeNumbers },
      traktEpisodeRatings: { ...item.traktEpisodeRatings, ...current.traktEpisodeRatings },
      watchedDate: [current.watchedDate, item.watchedDate].filter(Boolean).sort().at(-1) || "",
      updatedAt: now,
    };
    summary.matchedTitles++;
  }
  const historyKey = record => `${record.type === "电影" ? "movie" : "season"}:${record.consultationId}:${record.type === "电影" ? "" : record.season}`;
  const byHistory = new Map(watchCheckins.filter(record => record.mode === "season" || record.mode === "trakt-unmapped" || record.type === "电影").map(record => [historyKey(record), record]));
  for (const record of incoming.watchCheckins || []) {
    const consultationId = references.get(record.consultationId);
    if (!consultationId || deletedCheckins.has(record.id)) continue;
    const linked = { ...record, consultationId };
    const key = historyKey(linked);
    const matching = byHistory.get(key);
    const history = new Map((matching?.traktHistory || []).map(event => [String(event.id), event]));
    for (const event of record.traktHistory || []) {
      if (history.has(String(event.id))) summary.matchedHistory++;
      else { history.set(String(event.id), event); summary.addedHistory++; }
    }
    if (matching) {
      const newer = `${matching.date || ""} ${matching.time || ""}` > `${record.date || ""} ${record.time || ""}` ? matching : record;
      Object.assign(matching, {
        ...record, ...matching, consultationId, mode: record.mode,
        episodes: [...new Set([...(matching.episodes || []), ...(record.episodes || [])])].sort((left, right) => left - right),
        episodeCount: Math.max(matching.episodeCount || 0, record.episodeCount || 0),
        rating: matching.rating || record.rating || "", seasonRating: matching.seasonRating || record.seasonRating || "",
        date: newer.date, time: newer.time, traktHistory: [...history.values()], updatedAt: now,
      });
    } else {
      const added = { ...linked, traktHistory: [...history.values()], updatedAt: now };
      watchCheckins.push(added);
      byHistory.set(key, added);
    }
  }
  return { consultations, watchCheckins, summary };
}
