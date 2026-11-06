const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(env = {}) {
  const context = vm.createContext({ ...crypto, Buffer, TextEncoder, Response, URL, process: { env: {
    NODE_ENV: 'production', WORKBENCH_ACCESS_CODE: 'test-password-123', WORKBENCH_SESSION_SECRET: 's'.repeat(32), ...env,
  } } });
  for (const file of ['lib/access-auth.js', 'app/api/access/route.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
  }
  context.logout = vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/api/access/logout/route.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function signOut') + '\nsignOut;', context);
  return context;
}

function login(body, headers = {}) {
  return new Request('https://workbench.test/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

test('a personal account login issues a server cookie and restores the same data owner', async () => {
  const context = load();
  const response = await context.POST(login({ username: 'qiye', password: 'test-password-123' }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).user, { id: 'personal-workbench', name: 'qiye' });
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
  const restored = await context.GET(new Request('https://workbench.test/api/access', { headers: { Cookie: cookie.split(';')[0] } }));
  assert.equal(restored.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await restored.json(), { authenticated: true, username: 'qiye', user: { id: 'personal-workbench', name: 'qiye' } });
});

test('the configured username is enforced while the old access-code login remains compatible', async () => {
  const context = load({ WORKBENCH_USERNAME: 'owner' });
  assert.equal((await context.POST(login({ username: 'qiye', password: 'test-password-123' }))).status, 401);
  assert.equal((await context.POST(login({ username: 'owner', password: 'test-password-123' }))).status, 200);
  assert.equal((await context.POST(login({ code: 'test-password-123' }))).status, 200);
  assert.equal((await context.POST(login({ username: 'other', code: 'test-password-123' }))).status, 401);
});

test('wrong credentials never receive a cookie and do not reveal the expected password', async () => {
  for (const body of [{ username: 'qiye', password: 'wrong' }, { username: 'other', password: 'test-password-123' }, {}, { username: 'qiye', password: { value: 'test-password-123' } }]) {
    const response = await load().POST(login(body));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).error, '账号或密码不正确');
  }
});

test('missing, expired and tampered sessions are reported as signed out', async () => {
  const context = load();
  const fresh = context.createSession();
  const now = Date.now();
  assert.equal(context.isValidSession(fresh, now + 8 * 24 * 60 * 60 * 1000), false);
  for (const cookie of ['', `workbench_session=${fresh.slice(0, -1)}!`, 'workbench_session=local-unlocked-flag']) {
    const response = await context.GET(new Request('https://workbench.test/api/access', { headers: { Cookie: cookie } }));
    assert.equal((await response.json()).authenticated, false);
  }
});

test('login and logout reject cross-origin requests and logout clears the real cookie', async () => {
  const context = load();
  assert.equal((await context.POST(login({ code: 'test-password-123' }, { Origin: 'https://other.test' }))).status, 403);
  const external = new Request('https://workbench.test/api/access/logout', { method: 'POST', headers: { Origin: 'https://other.test' } });
  assert.equal((await context.logout(external)).status, 403);
  const signedOut = await context.logout(new Request('https://workbench.test/api/access/logout', { method: 'POST' }));
  assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0; Secure/);
});

test('repeated failed logins are limited and missing server secrets cannot mint a session', async () => {
  const context = load();
  for (let i = 0; i < 10; i++) assert.equal((await context.POST(login({ username: 'qiye', password: 'wrong' }))).status, 401);
  assert.equal((await context.POST(login({ username: 'qiye', password: 'test-password-123' }))).status, 429);
  for (const env of [{ WORKBENCH_ACCESS_CODE: '' }, { WORKBENCH_SESSION_SECRET: '' }]) {
    const response = await load(env).POST(login({ username: 'qiye', password: 'test-password-123' }));
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('set-cookie'), null);
  }
});
