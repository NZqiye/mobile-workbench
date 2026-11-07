const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/page.jsx'), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start).match(/^\s*/)[0];
  const end = `\n${indent}}`;
  return source.slice(start, source.indexOf(end, start) + end.length);
}
function setup() {
  let supplies = { bone: 4, water: 2, toy: 1, stick: 5 };
  const storage = {};
  const context = vm.createContext({
    Date, Math, Number, Object,
    readStorage: (key, fallback) => storage[key] ?? fallback,
    writeStorage: (key, value) => { storage[key] = value; },
    persist: (key, value) => { storage[key] = value; },
    petSupplies: supplies,
    setPetSupplies: update => { supplies = update(supplies); context.petSupplies = supplies; },
    setPetAction: () => {}, nowText: () => '12:00',
    crypto: { randomUUID: () => 'watch-record' }, todayKey: () => '2026-11-08',
    consultations: [{ id: 'movie', type: '电影' }, { id: 'series', type: '剧集', seasons: [] }],
    watchCheckins: [],
    setConsultations: next => { context.consultations = next; },
    setWatchCheckins: next => { context.watchCheckins = next; },
    tmdbMediaType: item => item.type === '电影' ? 'movie' : 'tv',
    upsertWatchCheckin: (items, record) => [record, ...items.filter(item => item.id !== record.id)],
    dedupeWatchCheckins: items => items,
    parseEpisodeList: episode => [Number(episode)],
    quickRecordState: () => ({}), undoQuickRecordChanges: () => ({ skipped: 0, deleted: [], collections: {} }),
    writeQuickCollections: () => {},
  });
  vm.runInContext(source.match(/const defaultPetSupplies = .*;/)[0] + '\n' + source.slice(source.indexOf('const petSupplyItems = ['), source.indexOf('const ponyThemes = [')), context);
  const names = ['normalizePetSupplies', 'mergePetSupplies', 'changePetSupply', 'rewardPetOnce', 'usePetSupply', 'undoQuickRecords', 'checkinWatchItem', 'rewardWatchedMovie'];
  vm.runInContext(names.map(functionSource).join('\n'), context);
  return { context, storage, supplies: () => supplies };
}

test('earning changes only inventory; using adds one point; undoing earnings keeps interaction happiness', () => {
  const app = setup();
  app.context.changePetSupply('water', 3, 'earned', 'reward');
  assert.equal(app.supplies().water, 5);
  assert.equal(app.supplies().happiness, 0);
  app.context.usePetSupply('water');
  assert.equal(app.supplies().water, 4);
  assert.equal(app.supplies().happiness, 1);
  app.context.changePetSupply('gift', 2, 'new reward', 'reward');
  app.context.undoQuickRecords({ changes: [], rewards: [{ type: 'water', amount: 3 }, { type: 'gift', amount: 1 }] });
  assert.equal(app.supplies().happiness, 1);
  assert.equal(app.supplies().gift, 1);
  assert.equal(app.storage.petSupplies.happiness, 1);
});

test('duplicate task or habit rewards do not add stock or happiness again', () => {
  const app = setup();
  app.context.rewardPetOnce('habit:today:reading', 'toy', 1, 'earned');
  app.context.rewardPetOnce('habit:today:reading', 'toy', 1, 'earned');
  assert.equal(app.supplies().toy, 2);
  assert.equal(app.supplies().happiness, 0);
});

test('old inventories gain zero new fields; sync retains new rewards and happiness using existing timestamps', () => {
  const app = setup();
  const old = app.context.normalizePetSupplies({ bone: 4, water: 2, toy: 1, stick: 5 });
  assert.equal(old.bone, 4);
  assert.equal(old.gift, 0);
  assert.equal(old.cat, 0);
  assert.equal(old.happiness, 0);
  const latest = app.context.mergePetSupplies({ gift: 2, cat: 3, happiness: 8 }, { gift: 1, happiness: 4 }, 20, 10);
  assert.equal(latest.gift, 2);
  assert.equal(latest.cat, 3);
  assert.equal(latest.happiness, 8);
  const merged = app.context.mergePetSupplies({ happiness: 8 }, { happiness: 8 }, 20, 20);
  assert.equal(merged.happiness, 8);
});

test('movie ratings earn a ticket once without increasing interaction happiness', () => {
  const app = setup();
  app.context.checkinWatchItem({ id: 'movie', mode: 'movie', rating: '8' });
  assert.equal(app.supplies().stick, 6);
  assert.equal(app.supplies().happiness, 0);
  app.context.checkinWatchItem({ id: 'movie', mode: 'movie', rating: '9' });
  app.context.checkinWatchItem({ id: 'movie', mode: 'legacy', rating: '9' });
  assert.equal(app.supplies().stick, 6);
  assert.equal(app.supplies().happiness, 0);
});

test('season progress rewards each newly watched episode, without repeat rewards on ratings or rechecking', () => {
  const app = setup();
  const save = (mode, episodes, season = 1) => app.context.checkinWatchItem({ id: 'series', mode, season, episodes, episodeCount: 10, rating: '8' });
  save('season-progress', [1, 2]);
  assert.equal(app.supplies().stick, 7);
  assert.equal(app.supplies().happiness, 0);
  save('season-rating', [1, 2]);
  save('season-progress', [1]);
  save('season-progress', [1, 2, 3]);
  assert.equal(app.supplies().stick, 8);
  assert.equal(app.supplies().happiness, 0);
  save('season-progress', [1], 2);
  assert.equal(app.supplies().stick, 9);
  assert.equal(app.supplies().happiness, 0);
  assert.equal(app.storage.petSupplies.happiness, 0);
});

test('movie rewards from the older entry remain recognized after updating the app', () => {
  for (const key of ['watch-checkin:movie:movie', 'watch:movie']) {
    const app = setup();
    app.storage.petRewardHistory = { [key]: 'previously earned' };
    app.context.checkinWatchItem({ id: 'movie', mode: 'movie', rating: '8' });
    assert.equal(app.supplies().stick, 5);
    assert.equal(app.supplies().happiness, undefined);
  }
});

test('all six interactions add exactly one point, and an empty reward adds nothing', () => {
  const app = setup();
  let points = 0;
  for (const type of ['bone', 'water', 'toy', 'stick', 'gift', 'cat']) {
    app.context.changePetSupply(type, 1, 'earned', 'reward');
    assert.equal(app.supplies().happiness, points);
    const previous = app.supplies()[type];
    app.context.usePetSupply(type);
    assert.equal(app.supplies()[type], previous - 1);
    assert.equal(app.supplies().happiness, ++points);
  }
  app.context.usePetSupply('gift');
  assert.equal(app.supplies().happiness, 6);
  assert.equal(app.storage.petSupplies.happiness, 6);
});

test('queued interactions cannot add points after the last inventory item was consumed', () => {
  const app = setup();
  app.context.changePetSupply('gift', 1, 'earned', 'reward');
  app.context.changePetSupply('gift', -1, 'use', 'gift', 1);
  app.context.changePetSupply('gift', -1, 'use', 'gift', 1);
  assert.equal(app.supplies().gift, 0);
  assert.equal(app.supplies().happiness, 1);
});
