const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app/api/media-updates/route.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/export async function/g, 'async function');

function route({ externalMatch = true, matchSource = 'imdb_id' } = {}) {
  const tmdbCalls = [];
  const show = {
    id: 53689,
    name: 'Tokyo Revengers',
    premiered: '2021-04-11',
    language: 'Japanese',
    type: 'Animation',
    externals: { imdb: 'tt13196080', thetvdb: 393478 },
    network: { name: 'MBS', country: { code: 'JP' } },
    webChannel: null,
  };
  const response = (data, ok = true) => ({ ok, json: async () => data, text: async () => JSON.stringify(data) });
  const context = vm.createContext({
    AbortController,
    AbortSignal,
    Date,
    Map,
    Math,
    Promise,
    Response,
    Set,
    URL,
    clearTimeout,
    setTimeout,
    tmdbToken: 'configured',
    imageBase: 'https://image.tmdb.org/t/p/w342',
    fetch: async (url) => {
      const date = new URL(url).searchParams.get('date');
      return response([{ id: 1, name: 'Episode', season: 1, number: 1, airdate: date, airtime: '20:00', show, image: { original: 'https://static.tvmaze.com/episode.jpg' } }]);
    },
    fetchTmdb: async (url) => {
      const parsed = new URL(url);
      tmdbCalls.push(parsed);
      if (parsed.pathname.startsWith('/3/find/')) return response(externalMatch && parsed.searchParams.get('external_source') === matchSource ? { tv_results: [{ id: 105009, name: '东京复仇者', poster_path: null }] } : { tv_results: [] });
      if (parsed.pathname === '/3/tv/105009') return response({
        id: 105009,
        name: '东京复仇者',
        poster_path: null,
        backdrop_path: '/tmdb-backdrop.jpg',
        images: { posters: [{ file_path: '/tmdb-poster.jpg', iso_639_1: 'ja' }] },
        seasons: [{ season_number: 1, poster_path: '/season.jpg' }],
      });
      if (parsed.pathname === '/3/search/tv') return response({ results: [] });
      throw new Error(`Unexpected TMDB URL ${parsed.pathname}`);
    },
  });
  vm.runInContext(source, context);
  return {
    tmdbCalls,
    get: () => context.GET(new Request('https://workbench.test/api/media-updates?days=1&compact=1')),
  };
}

test('TVMaze IMDb/TVDB IDs resolve TMDB posters when names differ', async () => {
  const instance = route();
  const response = await instance.get();
  const payload = await response.json();
  const [item] = payload.days[0].items;
  assert.equal(item.tmdbId, 105009);
  assert.equal(item.posterUrl, 'https://image.tmdb.org/t/p/w342/tmdb-poster.jpg');
  assert.ok(instance.tmdbCalls.some(url => url.searchParams.get('external_source') === 'imdb_id'));
  assert.ok(item.backdropUrl.startsWith('https://image.tmdb.org/t/p/'));
});

test('unmatched TVMaze images never become poster fallbacks', async () => {
  const instance = route({ externalMatch: false });
  const response = await instance.get();
  const payload = await response.json();
  const [item] = payload.days[0].items;
  assert.equal(item.tmdbId, '');
  assert.equal(item.posterUrl, '');
  assert.ok(!item.posterUrl.includes('tvmaze.com'));
});

test('TVDB is tried when an IMDb mapping is unavailable', async () => {
  const instance = route({ matchSource: 'tvdb_id' });
  const response = await instance.get();
  const payload = await response.json();
  assert.equal(payload.days[0].items[0].tmdbId, 105009);
  assert.ok(instance.tmdbCalls.some(url => url.searchParams.get('external_source') === 'tvdb_id'));
});
