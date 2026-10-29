const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const route = readFileSync(path.join(root, 'app/api/anime-updates/route.js'), 'utf8');
const tmdb = readFileSync(path.join(root, 'lib/tmdb.js'), 'utf8');
const page = readFileSync(path.join(root, 'app/page.jsx'), 'utf8');
const subject = (id, date = '2026-10-05') => ({ id, name: `Anime ${id}`, name_cn: `新番 ${id}`, type: 2, date, images: { large: 'https://lain.bgm.tv/pic/cover/l/test.jpg' }, summary: '<p>中文简介</p>', rating: { score: 8 }, collection: { doing: 20 } });

function harness({ token = '', tmdbResult = () => ({results:[]}), signals = AbortSignal } = {}) {
  let now = Date.parse('2026-10-18T16:05:00Z'); // Monday in Shanghai, Sunday in UTC.
  let fail = false;
  let calendarFail = false;
  let emptyToday = false;
  const calls = [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = vm.createContext({ Date: Clock, Intl, Response, URL, AbortSignal: signals, process: {env: {TMDB_ACCESS_TOKEN: token}},
    fetch: async (url, options) => {
      url = String(url);
      calls.push({ url, options });
      if (url.startsWith('https://api.themoviedb.org/')) return Response.json(await tmdbResult(new URL(url).searchParams.get('query'), options));
      if (fail || (calendarFail && url.endsWith('/calendar'))) throw new Error('offline');
      if (url.endsWith('/calendar')) return Response.json([
        { weekday: { id: 7 }, items: [subject(7)] },
        { weekday: { id: 1 }, items: emptyToday ? [] : [subject(1)] },
        { weekday: { id: 2 }, items: [subject(2)] },
      ]);
      const body = JSON.parse(options.body);
      if (body.sort === 'rank') return Response.json({ data: [subject(100, '2000-01-01')] });
      return Response.json({ data: [subject(10), subject(10), subject(11, '2026-10-15'), subject(12, '2026-07-01'), { ...subject(13), nsfw: true }, { ...subject(14), type: 6 }] });
    },
  });
  vm.runInContext(tmdb.replace(/^export /gm, '') + '\n' + route.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '') + '\nthis.api = { GET, seasonRange, shanghaiDate, enrichWithTmdb };', context);
  return { calls, api: context.api, advance: (ms) => { now += ms; }, fail: () => { fail = true; }, calendarFail: () => { calendarFail = true; }, emptyToday: () => { emptyToday = true; }, get: (refresh = false) => context.api.GET(new Request(`https://local.test/api/anime-updates${refresh ? '?refresh=1' : ''}`)) };
}

test('quarter dates include October rollover and Shanghai day boundary', () => {
  const { api } = harness();
  assert.equal(api.shanghaiDate(), '2026-10-19');
  assert.equal(api.seasonRange('2026-12-31').end, '2027-01-01');
  assert.equal(api.seasonRange('2027-01-01').start, '2027-01-01');
});

test('real route retains season and Shanghai today when TMDB is unconfigured', async () => {
  const h = harness();
  const response = await h.get();
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(h.calls.length, 3);
  assert.ok(h.calls.every((call) => call.url.startsWith('https://api.bgm.tv/')));
  assert.deepEqual(data.sections.find((s) => s.id === 'animeHot').items.map((i) => i.bangumiId), [10, 11]);
  assert.deepEqual(data.sections.find((s) => s.id === 'animeSeason').items.map((i) => i.bangumiId), [11, 10]);
  const today = data.sections.find((s) => s.id === 'animeToday').items[0];
  assert.equal(today.bangumiId, 1);
  assert.equal(today.scheduleDate, '2026-10-19');
  assert.equal(today.summary, '中文简介');
  assert.ok(today.posterUrl);
  assert.equal(today.tmdbId, undefined);
  assert.match(data.metadataNote, /TMDB 尚未配置/);
  const filter = JSON.parse(h.calls.find((c) => c.options.body && JSON.parse(c.options.body).sort === 'heat').options.body).filter;
  assert.deepEqual(filter.air_date, ['>=2026-10-01', '<2027-01-01']);
  assert.equal(Date.parse(data.nextUpdateAt) - Date.parse(data.generatedAt), 15 * 60 * 1000);
});

test('cache, bounded manual refresh, and concurrent refresh use a single upstream batch', async () => {
  const h = harness();
  await Promise.all([h.get(), h.get()]);
  assert.equal(h.calls.length, 3);
  await h.get(true);
  assert.equal(h.calls.length, 3);
  h.advance(61000);
  assert.equal((await (await h.get(true)).json()).cache, 'miss');
  assert.equal(h.calls.length, 6);
  await h.get();
  assert.equal(h.calls.length, 6);
  h.advance(15 * 60 * 1000);
  await h.get();
  assert.equal(h.calls.length, 9);
});

test('partial source failure does not hide working recommendations', async () => {
  const h = harness(); h.calendarFail();
  const data = await (await h.get()).json();
  assert.equal(data.ok, true);
  assert.ok(data.warnings.length);
  assert.ok(data.sections.some((s) => s.id === 'animeHot'));
  assert.ok(!data.sections.some((s) => s.id === 'animeToday'));
});

test('a valid empty today remains empty instead of being replaced with old shows', async () => {
  const h = harness(); h.emptyToday();
  const data = await (await h.get()).json();
  assert.deepEqual(data.sections.find((s) => s.id === 'animeToday').items, []);
  assert.deepEqual(data.warnings, []);
});

test('outage exposes stale metadata and expires its fallback after 24 hours', async () => {
  const h = harness(); await h.get(); h.fail(); h.advance(16 * 60 * 1000);
  const stale = await (await h.get()).json();
  assert.equal(stale.stale, true);
  assert.ok(stale.warning);
  h.advance(24 * 60 * 60 * 1000);
  assert.equal((await h.get()).status, 502);
});

test('Shanghai midnight invalidates today even before the 15 minute cache expires', async () => {
  const h = harness(); h.advance((23 * 60 + 50) * 60 * 1000); await h.get();
  h.advance(6 * 60 * 1000);
  const data = await (await h.get()).json();
  assert.equal(data.date, '2026-10-20');
  assert.equal(data.sections.find((s) => s.id === 'animeToday').items[0].bangumiId, 2);
});

function tmdbCandidate(query, changes = {}) {
  return {id: Number(query.replace('Anime ', '')) + 1000, media_type:'tv', genre_ids:[16], name:'TMDB 中文片名', original_name:query, first_air_date:query === 'Anime 100' ? '2000-01-01' : '2026-10-01', overview:'TMDB 中文简介', poster_path:'/tmdb.jpg', vote_average:8.5, ...changes};
}

test('TMDB zh-CN metadata is present before render without changing rankings or schedules', async () => {
  const h = harness({token:'test-token', tmdbResult: (query) => ({results:[tmdbCandidate(query)]})});
  const data = await (await h.get()).json();
  const hot = data.sections.find((s) => s.id === 'animeHot').items;
  assert.deepEqual(hot.map((i) => i.bangumiId), [10,11]);
  assert.deepEqual(data.sections.find((s) => s.id === 'animeSeason').items.map((i) => i.bangumiId), [11,10]);
  assert.equal(hot[0].title, 'TMDB 中文片名');
  assert.equal(hot[0].titleZh, 'TMDB 中文片名');
  assert.equal(hot[0].summary, 'TMDB 中文简介');
  assert.equal(hot[0].summaryZh, 'TMDB 中文简介');
  assert.equal(hot[0].posterUrl, 'https://image.tmdb.org/t/p/w342/tmdb.jpg');
  assert.equal(hot[0].tmdbId, 1010);
  assert.equal(hot[0].tmdbMediaType, 'tv');
  assert.equal(hot[0].tmdbRating, '8.5');
  assert.equal(hot[0].bangumiScore, 8);
  assert.equal(hot[0].airDate, '2026-10-05');
  assert.equal(hot[0].year, '2026');
  assert.equal(hot[0].id, 'bangumi-10');
  assert.equal(hot[0].category, 'anime');
  assert.equal(hot[0].type, '动漫');
  const today = data.sections.find((s) => s.id === 'animeToday').items[0];
  assert.equal(today.tmdbId, 1001);
  assert.equal(today.scheduleDate, '2026-10-19');
  const searches = h.calls.filter((c) => c.url.includes('themoviedb'));
  assert.equal(searches.length, 4); // Shared season/hot entries only matched once.
  for (const call of searches) {
    assert.equal(new URL(call.url).searchParams.get('language'), 'zh-CN');
    assert.equal(new URL(call.url).searchParams.get('include_adult'), 'false');
    assert.equal(call.options.headers.Authorization, 'Bearer test-token');
  }
  h.advance(16 * 60 * 1000);
  await h.get();
  assert.equal(h.calls.filter((c) => c.url.includes('themoviedb')).length, 4);
});

test('missing TMDB Chinese fields and posters retain Bangumi data independently', async () => {
  for (const changes of [
    {name:'English Title', overview:'English description', poster_path:null},
    {name:'日本の作品', overview:'日本の作品です', poster_path:null},
    {name:'', overview:'', poster_path:null},
  ]) {
    const h = harness({token:'test-token', tmdbResult:(q) => ({results:[tmdbCandidate(q,changes)]})});
    const item = (await (await h.get()).json()).items[0];
    assert.equal(item.tmdbId,1010);
    assert.equal(item.titleZh,'新番 10');
    assert.equal(item.summaryZh,'中文简介');
    assert.equal(item.posterUrl,'https://lain.bgm.tv/pic/cover/l/test.jpg');
  }
  const h = harness({token:'test-token', tmdbResult:(q) => ({results:[tmdbCandidate(q,{overview:''})]})});
  const item = (await (await h.get()).json()).items[0];
  assert.equal(item.titleZh, 'TMDB 中文片名');
  assert.equal(item.summaryZh,'中文简介');
  assert.equal(item.posterUrl,'https://image.tmdb.org/t/p/w342/tmdb.jpg');
});

test('matching rejects live action, people, remakes, other names, absent dates, adult and ambiguous entries', async () => {
  for (const changes of [
    {genre_ids:[18]}, {media_type:'person'}, {first_air_date:'2000-01-01'},
    {original_name:'Different Anime'}, {first_air_date:''}, {adult:true},
  ]) {
    const h = harness({token:'test-token', tmdbResult:(q) => ({results:[tmdbCandidate(q,changes)]})});
    assert.equal((await (await h.get()).json()).items[0].tmdbId,undefined);
  }
  const h = harness({token:'test-token', tmdbResult:(q) => ({results:[tmdbCandidate(q),tmdbCandidate(q,{id:9999})]})});
  assert.equal((await (await h.get()).json()).items[0].tmdbId,undefined);
});

test('original-name miss retries Chinese title, supports movies and normalizes full-width punctuation', async () => {
  const h = harness({token:'test-token', tmdbResult:(q) => ({results:q.startsWith('Anime') ? [] : [tmdbCandidate(q,{id:888,media_type:'movie',original_name:undefined,original_title:q,name:undefined,title:'新番：１０',release_date:'2026-10-01'})]})});
  const item = (await (await h.get()).json()).items[0];
  assert.equal(item.tmdbId,888);
  assert.equal(item.tmdbMediaType,'movie');
  assert.equal(item.titleZh,'新番：１０');
  assert.equal(item.category,'anime');
});

test('TMDB misses retain all shows and are retried after the short negative cache expires', async () => {
  const h = harness({token:'test-token'});
  const initial = await (await h.get()).json();
  assert.deepEqual(initial.items.map((i) => i.bangumiId),[10,11]);
  assert.equal(h.calls.filter((c) => c.url.includes('themoviedb')).length,8);
  h.advance(61000); await h.get(true);
  assert.equal(h.calls.filter((c) => c.url.includes('themoviedb')).length,8);
  h.advance(15 * 60 * 1000); await h.get();
  assert.equal(h.calls.filter((c) => c.url.includes('themoviedb')).length,16);
});

test('TMDB failures do not fail Bangumi lists or get cached as permanent misses', async () => {
  let offline = true;
  const h = harness({token:'test-token', tmdbResult:(q) => { if (offline) throw new Error('offline'); return {results:[tmdbCandidate(q)]}; }});
  const first = await (await h.get()).json();
  assert.equal(first.ok,true);
  assert.equal(first.items.length,2);
  assert.match(first.metadataNote,/部分 TMDB/);
  offline=false; h.advance(61000);
  assert.equal((await (await h.get(true)).json()).items[0].tmdbId,1010);
});

test('TMDB concurrency and total enrichment deadline are bounded without dropping queued cards', async () => {
  let active = 0, peak = 0;
  const signals = { any:AbortSignal.any, timeout:(ms) => AbortSignal.timeout(ms === 12000 ? 30 : ms === 2500 ? 10 : ms) };
  const h = harness({token:'test-token', signals, tmdbResult:async (_, options) => {
    active++; peak=Math.max(peak,active);
    try {
      await new Promise((resolve,reject) => {
        const timer=setTimeout(resolve,100);
        const abort=() => {clearTimeout(timer);reject(options.signal.reason);};
        if(options.signal.aborted) abort();
        else options.signal.addEventListener('abort',abort,{once:true});
      });
      return {results:[]};
    } finally {active--;}
  }});
  const sections=[{id:'animeHot',items:Array.from({length:100},(_,i) => ({bangumiId:i+1,bangumiName:`Anime ${i+1}`,year:'2026'}))}];
  const note = await h.api.enrichWithTmdb(sections);
  assert.equal(peak,8);
  assert.equal(active,0);
  assert.ok(h.calls.length < 100);
  assert.equal(sections[0].items.length,100);
  assert.equal(sections[0].items[99].bangumiId,100);
  assert.match(note,/部分 TMDB/);
});

function helper(name) {
  const start = page.indexOf(`function ${name}(`);
  return page.slice(start, page.indexOf('\n}', start) + 2);
}

test('frontend replaces anime lists, keeps empty results, and preserves freshness metadata', () => {
  const context = vm.createContext({ normalizeTvmazeRecommendation: (i) => i });
  vm.runInContext(['recommendationItemKey', 'sourceMediaKind', 'mergeRecommendationItems', 'mergeRecommendationSources'].map(helper).join('\n') + '\nthis.merge = mergeRecommendationSources;', context);
  const data = context.merge([{ id: 'animeToday', items: [{ title: '昨天的排期' }] }, { id: 'animeHot', items: [{ title: '老推荐' }] }, { id: 'movieHot', items: [{ title: '电影' }] }], null, { sections: [
    { id: 'animeToday', generatedAt: 'new', items: [] },
    { id: 'animeHot', generatedAt: 'new', items: [{ title: '新番', bangumiId: 1 }] },
  ] });
  assert.equal(data[0].items.length, 0);
  assert.equal(data[0].generatedAt, 'new');
  assert.equal(data[1].items.length, 1);
  assert.equal(data[1].items[0].title, '新番');
  assert.equal(data[2].items[0].title, '电影');
});

test('TVMaze supplements cannot contaminate the current-season anime ranking', () => {
  const context = vm.createContext({ normalizeTvmazeRecommendation: (i) => i });
  vm.runInContext(['recommendationItemKey', 'sourceMediaKind', 'mergeRecommendationItems', 'mergeRecommendationSources'].map(helper).join('\n') + '\nthis.merge = mergeRecommendationSources;', context);
  const data = context.merge([{ id: 'animeHot', items: [{ title: '当季新番' }] }], { days: [{ items: [{ title: '旧动画', category: 'anime' }] }] }, null);
  assert.equal(data[0].items.length, 1);
  assert.equal(data[0].items[0].title, '当季新番');
});

async function importAnime(candidate) {
  let saved;
  const start = page.indexOf('  async function importTmdb(item) {');
  const end = page.indexOf('  async function syncTmdbRating(', start);
  const context = vm.createContext({
    AbortSignal, crypto: {randomUUID: () => 'new-id'}, consultations: [],
    setTmdbStatus: () => {}, setConsultations: () => {},
    clearDeletedTmdbId: () => {}, syncDeletedTmdbWatchlistToCloud: () => {},
    tmdbMediaType: (i) => i.tmdbMediaType || 'tv',
    inferMediaCategory: () => 'anime', dedupeConsultations: (items) => items,
    nowText: () => '22:00', persist: (_, items) => {saved = items;},
    fetch: async (url) => url.includes('/search?') ? Response.json({results: candidate ? [candidate] : []}) : url.includes('/watchlist') ? Response.json({ok:true}) : Response.json({error:'unavailable'}, {status:503}),
    input: {bangumiId:10, title:'新番', titleZh:'新番', originalTitle:'Anime 10', year:'2026', summary:'Bangumi 简介', posterUrl:'poster.jpg', type:'动漫', ...candidate},
  });
  await vm.runInContext(page.slice(start,end)+'\nimportTmdb(input)',context);
  return saved[0];
}

test('unmatched new anime can still be saved with Bangumi metadata', async () => {
  const item = await importAnime(null);
  assert.equal(item.bangumiId, 10);
  assert.equal(item.summary, 'Bangumi 简介');
  assert.equal(item.posterUrl, 'poster.jpg');
  assert.equal(item.tmdbId, undefined);
});

test('adding a matched card retains its TMDB display metadata and Bangumi identity', async () => {
  const saved = await importAnime({tmdbId:99, category:'anime', tmdbMediaType:'tv', title:'TMDB 中文名', titleZh:'TMDB 中文名', summary:'TMDB 中文介绍'});
  assert.equal(saved.tmdbId, 99);
  assert.equal(saved.bangumiId, 10);
  assert.equal(saved.title, 'TMDB 中文名');
  assert.equal(saved.summary, 'TMDB 中文介绍');
});

test('anime appears while TMDB is still pending and remains available when TMDB fails', async () => {
  let resolveTmdb;
  let sections = [];
  let info = {};
  const calls = [];
  const update = (current, next) => typeof next === 'function' ? next(current) : next;
  const context = vm.createContext({AbortSignal,
    recommendationRequestRef: {current:0},
    animeRequestRef: {current:0},
    setTmdbSections: (next) => {sections = update(sections,next);},
    setAnimeRecommendationInfo: (next) => {info = update(info,next);},
    setTmdbRecommendationStatus: () => {},
    normalizeTvmazeRecommendation: (i) => i,
    fetch: (url) => {
      calls.push(url);
      if(url.includes('/anime-updates')) return Promise.resolve(Response.json({ok:true,generatedAt:'2026-10-19T10:00:00Z',sections:[{id:'animeHot',items:[{title:'已加载新番'}]}]}));
      return new Promise((resolve) => {resolveTmdb=resolve;});
    },
  });
  const start = page.indexOf('  async function loadTmdbRecommendations(');
  const end = page.indexOf('  function syncDeletedTmdbWatchlistToCloud(',start);
  vm.runInContext(['recommendationItemKey','sourceMediaKind','mergeRecommendationItems','mergeRecommendationSources'].map(helper).join('\n')+page.slice(start,end)+'\nthis.load = loadTmdbRecommendations;',context);
  const pending = context.load();
  await new Promise(setImmediate);
  assert.equal(sections[0].items[0].title,'已加载新番');
  assert.equal(info.loading,false);
  resolveTmdb(Response.json({error:'TMDB offline'},{status:503}));
  await pending;
  assert.equal(sections[0].items[0].title,'已加载新番');
  calls.length=0;
  await context.load({animeOnly:true,refreshAnime:true});
  assert.deepEqual(calls,['/api/anime-updates?refresh=1']);
});
