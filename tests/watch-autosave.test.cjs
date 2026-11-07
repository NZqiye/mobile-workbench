const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/page.jsx'), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start).match(/^\s*/)[0];
  const end = `\n${indent}}`;
  return source.slice(start, source.indexOf(end, start) + end.length);
}

test('episode changes save immediately, accumulate rapid selections and save deselection', () => {
  const writes = [];
  const context = vm.createContext({
    selected: { id: 'show' }, isMovie: false, seasonNumber: '2', episodeCount: 5,
    episodes: Array.from({ length: 5 }, (_, i) => ({ episodeNumber: i + 1 })),
    checkedEpisodesRef: { current: new Set() }, setCheckedEpisodes() {}, setRatingStatus() {},
    todayKey: () => '2026-11-07', onCheckin: value => writes.push(JSON.parse(JSON.stringify(value))),
  });
  vm.runInContext(['toggleEpisode', 'toggleAllEpisodes', 'watchThroughEpisode', 'saveProgress'].map(functionSource).join('\n'), context);
  assert.equal(writes.length, 0);
  context.toggleEpisode(2);
  assert.deepEqual(writes.at(-1).episodes, [1, 2]);
  context.toggleEpisode(4);
  assert.deepEqual(writes.at(-1).episodes, [1, 2, 3, 4]);
  context.toggleEpisode(2);
  assert.deepEqual(writes.at(-1).episodes, [1, 3, 4]);
  context.watchThroughEpisode(3);
  assert.deepEqual(writes.at(-1).episodes, [1, 2, 3, 4]);
  context.toggleAllEpisodes();
  assert.deepEqual(writes.at(-1).episodes, [1, 2, 3, 4, 5]);
  context.toggleAllEpisodes();
  assert.deepEqual(writes.at(-1).episodes, []);
  assert.ok(writes.every(value => value.id === 'show' && value.season === 2 && value.mode === 'season-progress' && !('rating' in value)));
});

test('an older cloud response cannot overwrite a newer automatically saved progress', async () => {
  const pending = [], restored = [], storage = {};
  const context = vm.createContext({
    session: { user: 'test' }, syncedCollections: ['consultations', 'watchCheckins'], stampItems: value => value,
    writeStorage: (name, value) => { storage[name] = value; }, cloudCollectionSaveRef: { current: {} },
    saveMergedCloudCollection: () => new Promise(resolve => pending.push(resolve)),
    setConsultations: value => restored.push(value), setWatchCheckins() {}, setSyncStatus() {}, nowText: () => '12:00',
  });
  vm.runInContext(functionSource('persist'), context);
  const first = [{ id: 'show', seasonProgress: { 1: [1] } }];
  const second = [{ id: 'show', seasonProgress: { 1: [1, 2] } }];
  context.persist('consultations', first);
  context.persist('consultations', second);
  pending[1](second);
  await new Promise(resolve => setImmediate(resolve));
  pending[0](first);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(restored, [second]);
  assert.equal(storage.consultations, second);
});

test('cloud merging includes progress edited while the cloud snapshot is loading', async () => {
  let resolveCloud, latest = [{ id: 'show', episodes: [1] }], written;
  const context = vm.createContext({
    cloudWriteQueue: Promise.resolve(), loadCloudItems: () => new Promise(resolve => { resolveCloud = resolve; }),
    readStorage: () => latest, mergeSyncedItems: (name, local) => local,
    saveCloudItem: async (session, name, value) => { written = value; },
  });
  vm.runInContext(`async ${functionSource('saveMergedCloudCollection')}`, context);
  const pending = context.saveMergedCloudCollection({}, 'consultations', latest);
  await new Promise(resolve => setImmediate(resolve));
  latest = [{ id: 'show', episodes: [1, 2, 3] }];
  resolveCloud({ consultations: [] });
  assert.equal(await pending, latest);
  assert.equal(written, latest);
});
