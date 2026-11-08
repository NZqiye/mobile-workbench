const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(files, extras = {}) {
  const context = vm.createContext({ ...crypto, Buffer, Response, URL, process: { env: {
    NODE_ENV: 'production', WORKBENCH_SESSION_SECRET: 's'.repeat(32), WORKBENCH_ACCESS_CODE: 'test-password',
  } }, ...extras });
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
  return context;
}

function input(pathname, body, headers = {}, method = 'POST') {
  return new Request(`https://workbench.test${pathname}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

test('cross-site fetch metadata is rejected even when Origin and Referer are absent', () => {
  const context = load(['lib/access-auth.js']);
  for (const headers of [{ 'Sec-Fetch-Site': 'cross-site' }, { Origin: 'null' }, { Referer: 'https://other.test/' }]) {
    assert.equal(context.isSameOrigin(input('/api/sync', {}, headers)), false);
  }
  for (const headers of [{}, { Origin: 'https://workbench.test' }, { 'Sec-Fetch-Site': 'same-origin' }]) {
    assert.equal(context.isSameOrigin(input('/api/sync', {}, headers)), true);
  }
});

test('JSON input limits cancel a chunked upload without consuming the remaining body', async () => {
  const context = load(['lib/access-auth.js']);
  let reads = 0;
  let canceled = false;
  const body = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(4000).fill(32)); },
    cancel() { canceled = true; },
  }, { highWaterMark: 0 });
  const request = new Request('https://workbench.test/api/access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half',
  });
  await assert.rejects(context.readJson(request, 4096), /请求体过大/);
  assert.equal(reads, 2);
  assert.equal(canceled, true);
});

test('JSON input counts UTF-8 bytes and rejects form submissions and arrays', async () => {
  const context = load(['lib/access-auth.js']);
  await assert.rejects(context.readJson(input('/api/sync', { text: '中文'.repeat(20) }), 100), /请求体过大/);
  await assert.rejects(context.readJson(input('/api/sync', {}, { 'Content-Type': 'text/plain' })), /JSON/);
  await assert.rejects(context.readJson(input('/api/sync', [])), /JSON/);
  assert.equal((await context.readJson(input('/api/sync', { text: '正常文字' }))).text, '正常文字');
});

test('oversized login uploads get 413 and JSON parser errors do not echo submitted content', async () => {
  const context = load(['lib/access-auth.js', 'app/api/access/route.js']);
  assert.equal((await context.POST(input('/api/access', { password: 'x'.repeat(5000) }))).status, 413);
  const bad = new Request('https://workbench.test/api/access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{private-password',
  });
  const response = await context.POST(bad);
  assert.equal(response.status, 400);
  assert.ok(!(await response.text()).includes('private-password'));
});

test('login rate limiting provides a retry delay and bounds attacker-controlled IP storage', async () => {
  const context = load(['lib/access-auth.js', 'app/api/access/route.js']);
  for (let i = 0; i < 1000; i++) {
    assert.equal((await context.POST(input('/api/access', {}, { 'X-Forwarded-For': `192.0.2.${i}` }))).status, 401);
  }
  const response = await context.POST(input('/api/access', {}, { 'X-Forwarded-For': 'new-ip' }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '600');
  assert.equal(vm.runInContext('attempts.size', context), 1000);
});

for (const [file, methods] of [
  ['app/api/tmdb/watchlist/route.js', ['POST', 'PUT', 'DELETE']],
  ['app/api/tmdb/rating/route.js', ['POST']],
  ['app/api/push/subscribe/route.js', ['POST']],
]) {
  test(`${file} rejects foreign websites before using a valid session or external service`, async () => {
    let externalCalls = 0;
    const context = load(['lib/access-auth.js', file], {
      tmdbToken: 'test-token', fetch: () => { externalCalls++; throw new Error('Unexpected external call'); },
      pushConfig: () => { externalCalls++; throw new Error('Unexpected config lookup'); },
    });
    for (const method of methods) {
      const request = input('/api/private', { mediaId: 1, mediaType: 'movie' }, {
        Cookie: `workbench_session=${context.createSession()}`, Origin: 'https://other.test',
      }, method);
      assert.equal((await context[method](request)).status, 403);
      assert.equal((await context[method](input('/api/private', {}, {}, method))).status, 401);
    }
    assert.equal(externalCalls, 0);
  });
}

function subscription(endpoint = 'https://fcm.googleapis.com/fcm/send/test') {
  const keys = crypto.createECDH('prime256v1');
  keys.generateKeys();
  return { endpoint, keys: { p256dh: keys.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
}

test('push accepts real browser key formats and only HTTPS official provider hosts', () => {
  const context = load(['lib/push-server.js']);
  for (const url of ['https://fcm.googleapis.com/fcm/send/test', 'https://updates.push.services.mozilla.com/wpush/v2/test',
    'https://web.push.apple.com/test', 'https://wns2-db5p.notify.windows.com/w/?token=test']) {
    assert.equal(context.validSubscription(subscription(url)), true, url);
  }
  for (const url of ['https://127.0.0.1/api', 'https://169.254.169.254/latest/meta-data', 'https://localhost/api',
    'http://fcm.googleapis.com/test', 'https://fcm.googleapis.com.attacker.test/test', 'https://attacker.test/',
    'https://fcm.googleapis.com:8443/test', 'https://user:password@fcm.googleapis.com/test', 'https://fcm.googleapis.com/test#fragment']) {
    assert.equal(context.validSubscription(subscription(url)), false, url);
  }
  for (const keys of [{}, { auth: 'abc', p256dh: 'abc' }, { ...subscription().keys, p256dh: Buffer.alloc(65).toString('base64url') }]) {
    assert.equal(context.validSubscription({ ...subscription(), keys }), false);
  }
});

test('cron skips unsafe subscriptions already stored in the database and still sends valid reminders', async () => {
  let sent = 0;
  const context = load(['lib/push-server.js', 'app/api/push/cron/route.js'], {
    process: { env: { CRON_SECRET: 'cron-test-secret' } },
    webpush: { sendNotification: async (sub) => { assert.equal(new URL(sub.endpoint).hostname, 'fcm.googleapis.com'); sent++; } },
  });
  context.pushConfig = () => ({ supabase: { from(table) {
    if (table === 'push_subscriptions') return { select: async () => ({ data: [
      { user_id: 'personal-workbench', subscription: subscription('https://127.0.0.1/internal') },
      { user_id: 'personal-workbench', subscription: subscription() },
    ] }) };
    return {
      select: () => ({ eq: () => ({ like: async () => ({ data: [{ id: 1, title: 'personal-workbench:plans',
        note: JSON.stringify([{ title: '测试提醒', reminderAt: '2020-01-01' }]) }] }) }) }),
      update: () => ({ eq: async () => ({}) }),
    };
  } } });
  assert.equal((await context.GET(new Request('https://workbench.test/api/push/cron'))).status, 401);
  const result = await context.GET(new Request('https://workbench.test/api/push/cron', { headers: { Authorization: 'Bearer cron-test-secret' } }));
  assert.equal(result.status, 200);
  assert.equal(sent, 1);
  assert.equal((await result.json()).sent, 1);
});

test('cloud sync accepts all current client collections, settings, deletion markers and checkin dates', () => {
  const context = load(['lib/sync-server.js']);
  const page = fs.readFileSync(path.join(__dirname, '../app/page.jsx'), 'utf8');
  const names = [...page.matchAll(/saveCloudItem\([^,]+, "([^"]+)"/g)].map(match => match[1]);
  assert.ok(names.length > 20);
  for (const name of [...names, 'deletedIds:notes', 'deletedIds:travelRecords', 'done:2026-11-08']) {
    assert.equal(context.validSyncName(name), true, name);
  }
  for (const name of ['__proto__', 'constructor', 'prototype', 'other-owner:notes', 'deletedIds:__proto__', 'arbitrary', 'done:bad-date', null]) {
    assert.equal(context.validSyncName(name), false);
  }
});

test('cloud sync never returns reserved keys or exposes database failure details', async () => {
  const context = load(['lib/access-auth.js', 'lib/sync-server.js', 'app/api/sync/route.js']);
  let databaseError = false;
  context.syncConfig = () => ({ page: 'app_state', userId: 'personal-workbench', supabase: { from: () => ({
    select: () => ({ eq: () => ({ like: () => ({ order: async () => databaseError
      ? { error: { message: 'private database schema secret' } }
      : { data: [{ title: 'personal-workbench:notes', note: '[{"title":"test"}]' },
        { title: 'personal-workbench:__proto__', note: '{"polluted":true}' }] } }) }) }),
  }) } });
  const request = () => new Request('https://workbench.test/api/sync', { headers: { Cookie: `workbench_session=${context.createSession()}` } });
  assert.deepEqual((await (await context.GET(request())).json()).items, { notes: [{ title: 'test' }] });
  databaseError = true;
  const response = await context.GET(request());
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('private database schema secret'));
});
