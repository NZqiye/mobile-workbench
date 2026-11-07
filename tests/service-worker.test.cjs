const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function worker(fetcher, openDelay = Promise.resolve()) {
  const listeners = {};
  const stored = new Map();
  const timers = new Map();
  let timerId = 0;
  const url = (request) => typeof request === 'string' ? request : request.url;
  const cache = {
    put: async (request, response) => stored.set(url(request), response),
  };
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, Request, Response, Promise,
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    fetch: fetcher,
    caches: { open: async () => { await openDelay; return cache; }, match: async (request) => stored.get(url(request))?.clone() },
    self: { location: { origin: 'https://example.test' }, addEventListener: (type, callback) => { listeners[type] = callback; } },
  });
  return {
    stored, timers,
    async request(path, { navigate = false, headers = {} } = {}) {
      const request = new Request(`https://example.test${path}`, { headers });
      if (navigate) Object.defineProperty(request, 'mode', { value: 'navigate' });
      const pending = [];
      let response;
      listeners.fetch({ request, waitUntil: (promise) => pending.push(promise), respondWith: (promise) => { response = promise; } });
      return { response, pending };
    },
  };
}

test('cached scripts and images do not wait for the network; uncached ones are saved', async () => {
  let calls = 0;
  const app = worker(async () => { calls++; return new Response('new image'); });
  app.stored.set('https://example.test/_next/static/app.js', new Response('cached script'));
  const cached = await app.request('/_next/static/app.js');
  assert.equal(await (await cached.response).text(), 'cached script');
  assert.equal(calls, 0);
  const first = await app.request('/crew/character.png');
  assert.equal(await (await first.response).text(), 'new image');
  assert.equal(calls, 1);
  assert.equal(await app.stored.get('https://example.test/crew/character.png').text(), 'new image');
});

test('opening online gets fresh HTML and updates the offline copy', async () => {
  const app = worker(async (request) => {
    assert.equal(request.cache, 'no-store');
    return new Response('latest HTML');
  });
  app.stored.set('https://example.test/', new Response('old HTML'));
  const result = await app.request('/', { navigate: true });
  assert.equal(await (await result.response).text(), 'latest HTML');
  await Promise.all(result.pending);
  assert.equal(await app.stored.get('https://example.test/').text(), 'latest HTML');
  assert.equal(app.timers.size, 0);
});

test('a slow opening returns cached HTML after the timeout while updating in the background', async () => {
  let finish;
  const app = worker(() => new Promise((resolve) => { finish = resolve; }));
  app.stored.set('https://example.test/', new Response('offline HTML'));
  const result = await app.request('/', { navigate: true });
  await new Promise(setImmediate);
  assert.equal(app.timers.size, 1);
  [...app.timers.values()][0]();
  assert.equal(await (await result.response).text(), 'offline HTML');
  finish(new Response('fresh HTML'));
  await Promise.all(result.pending);
  assert.equal(await app.stored.get('https://example.test/').text(), 'fresh HTML');
});

test('offline or server failure uses cached HTML without replacing it with an error', async () => {
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => new Response('error', { status: 503 })]) {
    const app = worker(fetcher);
    app.stored.set('https://example.test/', new Response('saved HTML'));
    const result = await app.request('/', { navigate: true });
    assert.equal(await (await result.response).text(), 'saved HTML');
    await Promise.all(result.pending);
    assert.equal(await app.stored.get('https://example.test/').text(), 'saved HTML');
  }
});

test('first opening waits for real HTML rather than returning an empty fallback', async () => {
  const app = worker(async () => new Response('first HTML'));
  const result = await app.request('/', { navigate: true });
  assert.equal(await (await result.response).text(), 'first HTML');
  await Promise.all(result.pending);
  assert.equal(app.timers.size, 0);
});

test('HTML remains cacheable when the browser consumes it before cache storage is ready', async () => {
  let ready;
  const app = worker(async () => new Response('usable HTML'), new Promise((resolve) => { ready = resolve; }));
  const result = await app.request('/', { navigate: true });
  assert.equal(await (await result.response).text(), 'usable HTML');
  ready();
  await Promise.all(result.pending);
  assert.equal(await app.stored.get('https://example.test/').text(), 'usable HTML');
});

test('API calls remain online and partial videos are not cached as complete files', async () => {
  const app = worker(async () => new Response('live data'));
  app.stored.set('https://example.test/api/access', new Response('stale account'));
  const api = await app.request('/api/access');
  assert.equal(await (await api.response).text(), 'live data');
  const range = await app.request('/codex-pets/whale-girl/snack.webm', { headers: { range: 'bytes=0-' } });
  assert.equal(range.response, undefined);
  const partial = worker(async () => new Response('part', { status: 206 }));
  const video = await partial.request('/codex-pets/whale-girl/snack.webm');
  assert.equal((await video.response).status, 206);
  assert.equal(partial.stored.size, 0);
});

test('first cache installation does not reload the page; an existing installation updates once', () => {
  const source = readFileSync('app/register-service-worker.jsx', 'utf8').replace(/^import .*$/gm, '').replace('export default ', '');
  for (const initiallyControlled of [false, true]) {
    const listeners = {};
    let reloads = 0;
    let cleanup;
    vm.runInNewContext(`${source}\nRegisterServiceWorker();`, {
      useEffect: (callback) => { cleanup = callback(); },
      navigator: { serviceWorker: {
        controller: initiallyControlled ? {} : null,
        addEventListener: (type, callback) => { listeners[type] = callback; },
        removeEventListener: (type) => { delete listeners[type]; },
        register: () => Promise.resolve({ update: () => {} }),
      } },
      window: { location: { hostname: 'example.test', reload: () => reloads++ } },
    });
    listeners.controllerchange();
    assert.equal(reloads, initiallyControlled ? 1 : 0);
    listeners.controllerchange();
    assert.equal(reloads, 1);
    listeners.controllerchange();
    assert.equal(reloads, 1);
    cleanup();
    assert.equal(listeners.controllerchange, undefined);
  }
});
