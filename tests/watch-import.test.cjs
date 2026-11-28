const test = require('node:test');
const assert = require('node:assert/strict');

const fixture = () => ({
  consultations: [{ id: 'trakt-tv-10', tmdbId: 10, tmdbMediaType: 'tv', title: '节目', type: '综艺', status: '正在看', seasonProgress: { 1: [1, 2] }, seasonEpisodeCounts: { 1: 3 }, seasons: [{ seasonNumber: 1, episodeCount: 3 }] }],
  watchCheckins: [{ id: 'trakt-tv-10-1', consultationId: 'trakt-tv-10', type: '综艺', mode: 'season', season: '1', episodes: [1, 2], episodeCount: 3, date: '2026-11-27', time: '22:00:00', traktHistory: [{ id: '100', watchedAt: '2026-11-27T14:00:00.000Z', episode: 1 }, { id: '101', watchedAt: '2026-11-27T14:30:00.000Z', episode: 2 }] }],
});

test('Trakt merge preserves primary IDs, manual ratings and progress while relinking history', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const incoming = fixture();
  incoming.consultations[0].rating = '7';
  const existing = { consultations: [{ ...incoming.consultations[0], id: 'phone-original', rating: '9', note: '我的感想', seasonProgress: { 1: [3] } }], watchCheckins: [] };
  const before = structuredClone(existing);
  const result = mergeWatchImport(existing, incoming, 123);
  assert.equal(result.consultations.length, 1);
  assert.equal(result.consultations[0].id, 'phone-original');
  assert.equal(result.watchCheckins[0].consultationId, 'phone-original');
  assert.deepEqual(result.consultations[0].seasonProgress[1], [1, 2, 3]);
  assert.equal(result.consultations[0].rating, '9');
  assert.equal(result.consultations[0].note, '我的感想');
  assert.equal(result.summary.ratingConflicts.length, 1);
  assert.deepEqual(existing, before);
});

test('reimport is idempotent and different-time rewatches remain separate events', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const incoming = fixture();
  incoming.watchCheckins[0].traktHistory.push({ id: '102', watchedAt: '2026-11-28T14:00:00.000Z', episode: 1 });
  const first = mergeWatchImport({}, incoming, 100);
  const second = mergeWatchImport(first, incoming, 100);
  assert.equal(second.consultations.length, 1);
  assert.equal(second.watchCheckins.length, 1);
  assert.equal(second.watchCheckins[0].traktHistory.length, 3);
  assert.deepEqual(second.watchCheckins[0].episodes, [1, 2]);
  assert.equal(second.summary.addedHistory, 0);
  assert.equal(second.summary.matchedHistory, 3);
});

test('same numeric TMDB IDs in movies and television never merge', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const result = mergeWatchImport({ consultations: [{ id: 'movie', tmdbId: 10, tmdbMediaType: 'movie', type: '电影', title: '同名作品' }] }, fixture(), 100);
  assert.equal(result.consultations.length, 2);
  assert.equal(result.watchCheckins[0].consultationId, 'trakt-tv-10');
});

test('deleted media and checkins are not resurrected, paused status remains intentional', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const deleted = mergeWatchImport({ deletedTmdbWatchlist: [{ tmdbId: 10, mediaType: 'tv' }] }, fixture(), 100);
  assert.equal(deleted.consultations.length, 0);
  assert.equal(deleted.watchCheckins.length, 0);
  const existing = { consultations: [{ ...fixture().consultations[0], id: 'phone', status: '暂停/弃剧' }], 'deletedIds:watchCheckins': ['trakt-tv-10-1'] };
  const result = mergeWatchImport(existing, fixture(), 100);
  assert.equal(result.consultations[0].status, '暂停/弃剧');
  assert.equal(result.watchCheckins.length, 0);
});

test('absolute episode numbers complete a season without fabricating episodes 1-61', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const incoming = fixture();
  incoming.consultations[0].seasonProgress = { 1: [62, 63] };
  incoming.consultations[0].seasonEpisodeNumbers = { 1: [62, 63, 64] };
  const current = { ...incoming.consultations[0], id: 'phone', seasonProgress: { 1: [64] } };
  const result = mergeWatchImport({ consultations: [current] }, incoming, 100);
  assert.equal(result.consultations[0].status, '看过的剧');
  assert.deepEqual(result.consultations[0].seasonProgress[1], [62, 63, 64]);
});

test('unmapped original history remains intact and does not duplicate on reimport', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const incoming = fixture();
  incoming.watchCheckins[0] = { ...incoming.watchCheckins[0], id: 'unmapped', mode: 'trakt-unmapped', season: '', episodes: [] };
  const first = mergeWatchImport({}, incoming, 100);
  const second = mergeWatchImport(first, incoming, 100);
  assert.equal(second.watchCheckins.length, 1);
  assert.equal(second.watchCheckins[0].traktHistory.length, 2);
});

test('blank season ratings do not hide imported ratings and episode ratings accumulate', async () => {
  const { mergeWatchImport } = await import('../lib/watch-import.js');
  const incoming = fixture();
  incoming.consultations[0].seasonRatings = { 1: '8', 2: '7' };
  incoming.consultations[0].traktEpisodeRatings = { 11: { rating: 8 }, 12: { rating: 7 } };
  const existing = { ...incoming.consultations[0], id: 'phone', seasonRatings: { 1: '', 2: '9' }, traktEpisodeRatings: { 12: { rating: 9 } } };
  const result = mergeWatchImport({ consultations: [existing] }, incoming, 100);
  assert.deepEqual(result.consultations[0].seasonRatings, { 1: '8', 2: '9' });
  assert.deepEqual(result.consultations[0].traktEpisodeRatings, { 11: { rating: 8 }, 12: { rating: 9 } });
});
