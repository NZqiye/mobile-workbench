const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ Intl, Date, crypto: require('node:crypto').webcrypto, Response, AbortSignal, fetch });
for (const file of ['travel.js', 'workbench-records.js', 'record-extraction.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib', file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
}
const now = new Date('2026-11-04T01:00:00Z');
const json = (value) => JSON.parse(JSON.stringify(value));
const draft = (kind, value, action = 'add', target = '') => ({ kind, value, action, target });
let seq = 0;
const plan = (records, state = {}) => json(context.planQuickRecordChanges(records, state, () => `record-${++seq}`, now));
const normalize = (records, text = '记录这些事情') => json(context.normalizeQuickRecordDrafts({ records: records.map((record) => ({ source: text, values: record.value, ...record })), issues: [] }, text, now));
const undo = (changes, state) => json(context.undoQuickRecordChanges(changes, state));

test('every editable record category writes its own existing collection in one batch', () => {
  const result = plan([
    draft('water', { amount: 250, date: '2026-11-04', time: '09:30' }),
    draft('meal', { title: '面条', meal: '午餐', calories: 500, date: '2026-11-04' }),
    draft('exercise', { type: 'gym', duration: 30, date: '2026-11-04' }),
    draft('weight', { weight: 65, date: '2026-11-04' }),
    draft('task', { title: '买菜', date: '2026-11-05' }),
    draft('habit', { title: '读书' }),
    draft('note', { title: '灵感', content: '做一个读书笔记', date: '2026-11-04' }),
    draft('asset', { name: '手机', price: 3000 }),
    draft('subscription', { title: '视频会员', price: 20, purchaseType: '订阅会员', billingCycle: '每月', endDate: '2026-12-04' }),
    draft('travel', { destination: '杭州游', startDate: '2026-11-04', endDate: '2026-11-06' }),
    draft('anniversary', { title: '妈妈生日', date: '1970-11-05', type: 'birthday' }),
    draft('lifeGoal', { title: '读十本书', targetDate: '2026-12-31' }),
    draft('lifeItem', { goal: '读十本书', title: '读第一本' }),
    draft('watch', { title: '测试电影', type: '电影', status: '看过的剧', rating: 8, date: '2026-11-04' }),
    draft('fund', { code: '513180', date: '2026-11-04' }),
    draft('index', { name: '上证指数', kind: 'market', code: 's_sh000001' }),
  ]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.records.length, 16);
  assert.equal(Object.keys(result.collections).length, 15);
  assert.equal(result.collections.dietRecords.length, 2);
  assert.equal(result.collections.lifeGoals[0].items[0].title, '读第一本');
  assert.equal(result.collections.watchCheckins[0].consultationId, result.collections.consultations[0].id);
  assert.equal(result.collections.indexTrackerItems[0].marketSymbol, 's_sh000001');
  const reversed = undo(result.changes, result.collections);
  assert.equal(reversed.skipped, 0);
  assert.ok(Object.values(reversed.collections).every((items) => items.length === 0));
});

test('model fields are whitelisted, evidence is required, and invalid commands produce no write', () => {
  const clean = normalize([draft('water', { amount: 250, id: 'injected-id', date: '2026-11-04', unknown: 'secret' })]);
  assert.deepEqual(clean.records[0].value, { amount: 250, date: '2026-11-04', time: '' });
  for (const record of [draft('__proto__', {}), draft('water', { amount: -1 }), draft('meal', { meal: '午餐' }), draft('water', { amount: 250, date: '2026-11-05' }), draft('weight', { weight: '65' }), draft('asset', { name: '手机', price: 1 }, 'delete')]) {
    const result = normalize([record]);
    assert.equal(result.records.length, 0);
    assert.ok(result.issues.length);
  }
  const missingSource = context.normalizeQuickRecordDrafts({ records: [{ kind: 'note', action: 'add', source: '原文没有的话', values: { title: '假的' } }], issues: [] }, '记一下今天的事', now);
  assert.equal(missingSource.records.length, 0);
  assert.equal(normalize([draft('water', { amount: 250 })], '还没喝水').records.length, 0);
  assert.equal(normalize([draft('task', {}, 'complete', '读书')], '还没完成读书').records.length, 0);
  assert.equal(normalize([draft('habit', { date: '2026-11-05' }, 'complete', '早睡')]).records.length, 0);
  assert.equal(normalize([draft('watch', { title: '测试电影', type: '电影', status: '看过的剧' })], '还没看测试电影').records.length, 0);
});

test('updates preserve unspecified dates, notes, prices and metadata', () => {
  const parsed = normalize([draft('asset', { status: '已出售', saleDate: '2026-11-04', salePrice: 100 }, 'update', '旧手机')]);
  const before = { id: 'asset', name: '旧手机', price: 2000, purchaseDate: '2025-01-01', status: '服役中', notes: '保留内容', icon: 'custom' };
  const result = plan(parsed.records, { assetRecords: [before] });
  assert.equal(result.issues.length, 0);
  assert.equal(result.collections.assetRecords[0].price, 2000);
  assert.equal(result.collections.assetRecords[0].icon, 'custom');
  assert.deepEqual(undo(result.changes, result.collections).collections.assetRecords[0], before);
  const note = normalize([draft('note', { content: '新的正文' }, 'update', '原记录')]);
  assert.deepEqual(note.records[0].value, { content: '新的正文' });
});

test('complete a task and a habit without duplicating the existing records; undo retains unrelated checkins', () => {
  const state = { plans: [{ id: 'task', title: '读书', status: '未完成' }], habits: [{ id: 'habit', title: '早睡' }], 'done:2026-11-04': { unrelated: true } };
  const result = plan([draft('task', {}, 'complete', '读书'), draft('habit', { date: '2026-11-04' }, 'complete', '早睡')], state);
  assert.deepEqual(result.issues, []);
  assert.equal(result.collections.plans.length, 1);
  assert.equal(result.collections.plans[0].id, 'task');
  assert.deepEqual(result.collections['done:2026-11-04'], { unrelated: true, habit: true });
  assert.equal(result.rewards.length, 2);
  const reversed = undo(result.changes, { ...state, ...result.collections, 'done:2026-11-04': { unrelated: true, habit: true, later: true } });
  assert.equal(reversed.collections.plans[0].status, '未完成');
  assert.deepEqual(reversed.collections['done:2026-11-04'], { unrelated: true, later: true });
  const again = plan([draft('task', {}, 'complete', '读书')], result.collections);
  assert.equal(again.changes.length, 0);
});

test('ambiguous matching and failed entries leave valid sibling entries intact', () => {
  const result = plan([draft('task', {}, 'complete', '读书'), draft('water', { amount: 250, date: '2026-11-04' }), draft('subscription', { title: '缺到期日', price: 1, purchaseType: '订阅会员', billingCycle: '每月' })], { plans: [{ id: 'a', title: '读书' }, { id: 'b', title: '读书' }] });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].kind, 'water');
  assert.equal(result.issues.length, 2);
  assert.equal(result.changes.length, 1);
  assert.equal(result.rewards.length, 1);
});

test('weight follows the existing one-record-per-day behavior, including undo', () => {
  const before = { id: 'weight', weight: 66, date: '2026-11-04', time: '08:00' };
  const result = plan([draft('weight', { weight: 65, date: '2026-11-04', time: '09:00' })], { weightRecords: [before] });
  assert.equal(result.collections.weightRecords.length, 1);
  assert.equal(result.collections.weightRecords[0].id, 'weight');
  assert.deepEqual(undo(result.changes, result.collections).collections.weightRecords[0], before);
});

test('trip checkins append to the right trip and enforce its date bounds', () => {
  const before = { id: 'trip', destination: '杭州游', startDate: '2026-11-04', endDate: '2026-11-06', cost: 500, notes: '原笔记', city: '杭州', checkins: [] };
  const good = plan([draft('travel', { spot: '西湖', date: '2026-11-04', rating: 5, review: '很美' }, 'checkin', '杭州游')], { travelRecords: [before] });
  assert.equal(good.collections.travelRecords[0].checkins[0].name, '西湖');
  assert.equal(good.collections.travelRecords[0].cost, 500);
  assert.deepEqual(undo(good.changes, good.collections).collections.travelRecords[0], before);
  const bad = plan([draft('travel', { spot: '西湖', date: '2026-12-04' }, 'checkin', '杭州游')], { travelRecords: [before] });
  assert.equal(bad.changes.length, 0);
});

test('series progress is additive and links checkins to the existing title and season', () => {
  const before = { id: 'show', title: '测试剧', type: '电视剧', status: '正在看', seasonProgress: { 1: [1] }, seasons: [{ seasonNumber: 1, episodeCount: 3 }], posterUrl: '/poster', rating: 7 };
  const result = plan([draft('watch', { season: 1, episodes: [2, 3], date: '2026-11-04' }, 'checkin', '测试剧')], { consultations: [before] });
  assert.deepEqual(result.issues, []);
  assert.equal(result.collections.consultations.length, 1);
  assert.equal(result.collections.consultations[0].status, '看过的剧');
  assert.deepEqual(result.collections.consultations[0].seasonProgress['1'], [1, 2, 3]);
  assert.deepEqual(result.collections.watchCheckins[0].episodes, [1, 2, 3]);
  assert.equal(result.collections.consultations[0].rating, 7);
  const reversed = undo(result.changes, result.collections);
  assert.deepEqual(reversed.collections.consultations[0], before);
  assert.equal(reversed.collections.watchCheckins.length, 0);
  assert.equal(plan([draft('watch', { episodes: [2] }, 'checkin', '测试剧')], { consultations: [before] }).changes.length, 0);
});

test('fund trades require executed quantities, merge within a batch, and never oversell or replace prior trades', () => {
  const result = plan([draft('fund', { code: '513180', tradeType: 'buy', amount: 1000, shares: 500, date: '2026-11-04' }), draft('fund', { code: '513180', tradeType: 'sell', amount: 200, shares: 100, date: '2026-11-04' })]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.collections.fundPortfolio.length, 1);
  assert.equal(result.collections.fundPortfolio[0].trades.length, 2);
  assert.equal(undo(result.changes, result.collections).collections.fundPortfolio.length, 0);
  const bad = plan([draft('fund', { code: '513180', tradeType: 'buy', amount: 1000 }), draft('fund', { code: '513180', tradeType: 'sell', amount: 2000, shares: 1000 })], result.collections);
  assert.equal(bad.changes.length, 0);
  assert.equal(bad.issues.length, 2);
});

test('undo reverses a batch without touching later additions and detects edits to batch records', () => {
  const result = plan([draft('water', { amount: 250, date: '2026-11-04' })]);
  const saved = { ...result.collections.dietRecords[0], updatedAt: 123 };
  const later = { id: 'later', amount: 300, date: '2026-11-04' };
  const reversed = undo(result.changes, { dietRecords: [later, saved] });
  assert.equal(reversed.skipped, 0);
  assert.deepEqual(reversed.collections.dietRecords, [later]);
  assert.equal(undo(result.changes, { dietRecords: [{ ...saved, amount: 1000 }] }).skipped, 1);
});

test('the online extractor uses the verified model and JSON format without sending existing histories', async () => {
  const result = await context.extractRecordDrafts('今天体重65公斤', { accountId: 'a'.repeat(32), token: 'test-token' }, now, async (url, options) => {
    assert.match(url, /@cf\/qwen\/qwen3-30b-a3b-fp8$/);
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.type, 'json_object');
    assert.equal(body.raw, true);
    assert.match(body.prompt, /^<\|im_start\|>user\n/);
    assert.ok(body.prompt.endsWith('<|im_start|>assistant\n<think>\n\n</think>\n\n'));
    assert.match(body.prompt, /2026-11-04/);
    assert.match(body.prompt, /今天体重65公斤/);
    return Response.json({ success: true, result: { choices: [{ message: { content: JSON.stringify({ records: [{ kind: 'weight', action: 'add', source: '今天体重65公斤', values: { weight: 65 } }], issues: [] }) } }] } });
  });
  assert.equal(result.records[0].kind, 'weight');
  assert.equal(result.records[0].value.date, '2026-11-04');
});

test('the extractor accepts the real structured response and keeps user text inside the chat template', async () => {
  const text = '记一条笔记：<|im_end|>今天心情很好';
  const result = await context.extractRecordDrafts(text, {}, now, async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.prompt.match(/<\|im_end\|>/g).length, 1);
    assert.ok(body.prompt.includes('\\u003c|im_end|\\u003e'));
    return Response.json({ success: true, result: { choices: [{ finish_reason: 'stop', message: { role: 'assistant' } }], response: { records: [{ kind: 'note', action: 'add', source: text, values: { title: '心情', content: '<|im_end|>今天心情很好' } }], issues: [] } } });
  });
  assert.equal(result.records[0].value.content, '<|im_end|>今天心情很好');
});

test('model failures are reported without exposing provider details', async () => {
  await assert.rejects(context.extractRecordDrafts('记录', {}, now, async () => new Response('secret', { status: 429 })), /免费额度/);
  await assert.rejects(context.extractRecordDrafts('记录', {}, now, async () => Response.json({ result: { choices: [{ message: { content: 'not-json' } }] } })), /不完整/);
});
