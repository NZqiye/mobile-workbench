function normalizeTitle(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function findExactTmdbMatch(item, results) {
  const mediaType = item?.tmdbMediaType || (item?.type === "电影" ? "movie" : "tv");
  const titles = new Set([item?.title, item?.titleZh, item?.originalTitle].map(normalizeTitle).filter(Boolean));
  if (!titles.size) return null;

  const matches = (Array.isArray(results) ? results : []).filter((result) => {
    if (result?.tmdbMediaType !== mediaType) return false;
    return [result.title, result.titleZh, result.originalTitle].map(normalizeTitle).some((title) => titles.has(title));
  });
  const year = Number(item?.year);
  if (!Number.isInteger(year) || year <= 1800) return matches.length === 1 ? matches[0] : null;

  const sameYear = matches.filter((result) => Number(result.year) === year);
  if (sameYear.length === 1) return sameYear[0];
  const nearbyYear = matches.filter((result) => Math.abs(Number(result.year) - year) <= 1);
  return nearbyYear.length === 1 ? nearbyYear[0] : null;
}
