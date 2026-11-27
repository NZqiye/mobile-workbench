const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/page.jsx'), 'utf8');
const code = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');

function storageHarness(storage = new Map()) {
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const context = vm.createContext({ window: {}, localStorage });
  vm.runInContext(code('lib/account-storage.js'), context);
  return { context, storage };
}

test('switching accounts pins each tab to its own cache and preserves every primary record', () => {
  const { context, storage } = storageHarness(new Map([['qiyeworkbench:plans', '[{"title":"主账号"}]'], ['qiyeworkbench:quickRecordDraft', '主账号草稿']]));
  assert.equal(context.accountStorageKey('plans'), 'qiyeworkbench:plans');
  assert.equal(context.selectAccountStorage('test-workbench'), true);
  assert.equal(context.accountStorageKey('plans'), 'qiyeworkbench:plans');
  const next = storageHarness(storage).context;
  assert.equal(next.accountStorageKey('plans'), 'qiyeworkbench:user:plans');
  assert.equal(storage.has(next.accountStorageKey('plans')), false);
  assert.equal(storage.has(next.accountStorageKey('quickRecordDraft')), false);
  storage.set(next.accountStorageKey('plans'), '[{"title":"测试"}]');
  assert.equal(storage.get('qiyeworkbench:plans'), '[{"title":"主账号"}]');
  assert.equal(next.selectAccountStorage('personal-workbench'), true);
  assert.equal(storageHarness(storage).context.accountStorageKey('plans'), 'qiyeworkbench:plans');
});

test('test account does not seed primary stock lists, fund positions, index observations or old records', () => {
  const { context } = storageHarness(new Map([['qiyeworkbench:activeAccount', 'test-workbench']]));
  Object.assign(context, { defaultAssets: 'primary-stocks', legacyDefaultAssets: 'legacy', stockDefaultAssets: 'stocks', defaultFundCodes: '161725', indexTrackerItems: [{ name: '主账号指标' }] });
  const functions = ['normalizeSavedAssets', 'normalizeFundCodes', 'normalizeIndexTrackerItems', 'migrateLegacyData'];
  for (const name of functions) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
  }
  assert.equal(context.normalizeSavedAssets(null), '');
  assert.equal(context.normalizeSavedAssets(null, 'primary-stocks'), '');
  assert.equal(context.normalizeFundCodes(null), '');
  assert.equal(JSON.stringify(context.normalizeIndexTrackerItems([])), '[]');
  assert.doesNotThrow(() => context.migrateLegacyData());
});

test('cloud read and write owners come exclusively from signed server sessions', async () => {
  const requests = [];
  const context = vm.createContext({ ...crypto, Buffer, Response, URL, process: { env: { WORKBENCH_SESSION_SECRET: 's'.repeat(32), NEXT_PUBLIC_SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'server-key' } }, createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ like: (name, value) => { requests.push(value); return { order: async () => ({ data: [] }) }; } }) }), insert: value => { requests.push(value.title); return { select: async () => ({ data: [] }) }; } }) }) });
  for (const file of ['lib/access-auth.js', 'lib/sync-server.js', 'app/api/sync/route.js']) vm.runInContext(code(file), context);
  for (const owner of ['personal-workbench', 'test-workbench']) {
    const cookie = `workbench_session=${context.createSession(owner)}`;
    const headers = { Cookie: cookie, 'Content-Type': 'application/json', 'X-Workbench-Account': owner };
    const read = await context.GET(new Request('https://workbench.test/api/sync?owner=personal-workbench', { headers }));
    assert.deepEqual(await read.json(), { items: {}, userId: owner });
    const write = await context.POST(new Request('https://workbench.test/api/sync', { method: 'POST', headers, body: JSON.stringify({ name: 'notes', value: [], owner: 'personal-workbench' }) }));
    assert.equal(write.status, 200);
    assert.deepEqual(requests.splice(0), [`${owner}:%`, `${owner}:notes`]);
  }
  const mismatch = await context.GET(new Request('https://workbench.test/api/sync', { headers: { Cookie: `workbench_session=${context.createSession('test-workbench')}`, 'X-Workbench-Account': 'personal-workbench' } }));
  assert.equal(mismatch.status, 401);
  assert.equal(requests.length, 0);
});

test('test account cannot read, mutate or rate the primary external film account', async () => {
  for (const file of ['app/api/tmdb/watchlist/route.js', 'app/api/tmdb/rating/route.js']) {
    const context = vm.createContext({ ...crypto, Buffer, Response, URL, process: { env: { WORKBENCH_SESSION_SECRET: 's'.repeat(32) } }, tmdbToken: 'token', fetch: () => { throw new Error('must not fetch primary account'); } });
    vm.runInContext(code('lib/access-auth.js'), context);
    vm.runInContext(code(file), context);
    const headers = { Cookie: `workbench_session=${context.createSession('test-workbench')}`, 'Content-Type': 'application/json' };
    for (const method of file.includes('watchlist') ? ['GET', 'POST', 'PUT', 'DELETE'] : ['POST']) {
      const response = await context[method](new Request('https://workbench.test/api/tmdb/test', { method, headers, ...(method === 'GET' ? {} : { body: '{}' }) }));
      assert.equal(response.status, method === 'GET' ? 200 : 403);
      if (method === 'GET') assert.deepEqual((await response.json()).items, []);
    }
  }
});
