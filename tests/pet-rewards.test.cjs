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
    setPetSupplies: update => { supplies = update(supplies); },
    setPetAction: () => {}, nowText: () => '12:00',
    quickRecordState: () => ({}), undoQuickRecordChanges: () => ({ skipped: 0, deleted: [], collections: {} }),
    writeQuickCollections: () => {},
  });
  vm.runInContext(source.match(/const defaultPetSupplies = .*;/)[0] + '\n' + source.slice(source.indexOf('const petSupplyItems = ['), source.indexOf('const ponyThemes = [')), context);
  vm.runInContext(['normalizePetSupplies', 'mergePetSupplies', 'changePetSupply', 'rewardPetOnce', 'undoQuickRecords'].map(functionSource).join('\n'), context);
  return { context, storage, supplies: () => supplies };
}

test('each earned unit adds happiness, spending keeps it, and undo removes only the earned points', () => {
  const app = setup();
  app.context.changePetSupply('water', 3, 'earned', 'reward');
  assert.equal(app.supplies().water, 5);
  assert.equal(app.supplies().happiness, 3);
  app.context.changePetSupply('water', -1, 'use', 'water');
  assert.equal(app.supplies().water, 4);
  assert.equal(app.supplies().happiness, 3);
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
  assert.equal(app.supplies().happiness, 1);
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
