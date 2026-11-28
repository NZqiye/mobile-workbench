const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'lib/tmdb-match.js'), 'utf8').replace('export function', 'function');
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.findExactTmdbMatch = findExactTmdbMatch`, context);

test('TMDB matching requires title, media type and compatible year', () => {
  const item = { title: 'Tokyo Revengers', originalTitle: '東京リベンジャーズ', year: '2021', type: '剧集' };
  const results = [
    { tmdbId: 1, tmdbMediaType: 'movie', title: 'Tokyo Revengers', year: '2021' },
    { tmdbId: 2, tmdbMediaType: 'tv', title: '东京复仇者', originalTitle: '東京リベンジャーズ', year: '2021' },
  ];
  assert.equal(context.findExactTmdbMatch(item, results).tmdbId, 2);
  assert.equal(context.findExactTmdbMatch(item, [{ ...results[1], year: '2024' }]), null);
  assert.equal(context.findExactTmdbMatch(item, [{ ...results[1], originalTitle: '別作品' }]), null);
});

test('ambiguous exact TMDB matches require year disambiguation', () => {
  const item = { title: 'Same Show', year: '2020', type: '剧集' };
  const results = [
    { tmdbId: 1, tmdbMediaType: 'tv', title: 'Same Show', year: '2019' },
    { tmdbId: 2, tmdbMediaType: 'tv', title: 'Same Show', year: '2020' },
  ];
  assert.equal(context.findExactTmdbMatch(item, results).tmdbId, 2);
  assert.equal(context.findExactTmdbMatch({ ...item, year: '' }, results), null);
});
