const test = require('node:test');
const assert = require('node:assert/strict');

test('series progress combines saved seasons with the active unsaved selection', async () => {
  const { seriesWatchProgress } = await import('../lib/watch-progress.js');
  const seasons = [{ seasonNumber: 1, episodeCount: 26 }, { seasonNumber: 2, episodeCount: 10 }];
  const saved = { 1: [1,2,3,4,5,6,7,8,9,10,11], 2: [1] };
  assert.deepEqual(seriesWatchProgress(seasons, saved, 2, new Set([1,2,3,4]), 10), { total: 36, watched: 15, percent: 42 });
  assert.deepEqual(seriesWatchProgress([seasons[0]], saved, 1, saved[1], 26), { total: 26, watched: 11, percent: 42 });
});

test('percentages remain accurate for repeated, invalid, empty and complete episodes', async () => {
  const { seriesWatchProgress } = await import('../lib/watch-progress.js');
  const seasons = [{ seasonNumber: 1, episodeCount: 3 }];
  assert.deepEqual(seriesWatchProgress(seasons, {}, 1, [1,1,0,4,'2'], 3), { total: 3, watched: 2, percent: 67 });
  assert.deepEqual(seriesWatchProgress(seasons, {}, 1, [], 3), { total: 3, watched: 0, percent: 0 });
  assert.deepEqual(seriesWatchProgress(seasons, {}, 1, [1,2,3], 3), { total: 3, watched: 3, percent: 100 });
  assert.equal(seriesWatchProgress([], {}, 1, [], 0), null);
  assert.equal(seriesWatchProgress([...seasons, { seasonNumber: 2 }], {}, 1, [1], 3), null);
});
