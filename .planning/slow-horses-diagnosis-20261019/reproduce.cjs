const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.resolve(__dirname, '../../app/page.jsx'), 'utf8');
const names = ['hasChineseText', 'mediaTitle', 'mediaKind', 'tmdbMediaType', 'tmdbItemKey', 'mediaAliasKeys', 'itemUpdatedAt', 'watchStatusRank', 'mergeConsultationRecord', 'canMergeConsultations', 'dedupeConsultations', 'inferMediaCategory'];
const helpers = names.map(name => {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}).join('\n');
const start = source.indexOf('  async function importTmdb(item) {');
const end = source.indexOf('  async function syncTmdbRating(', start);
assert.ok(start >= 0 && end > start);
const item = {tmdbId:95480,tmdbMediaType:'tv',title:'Slow Horses',originalTitle:'Slow Horses',category:'tv',type:'电视剧'};
const oldItem = {...item,id:'existing-slow-horses',status:'看过的剧',updatedAt:100};
const active = {id:'another-active-show',tmdbId:123,title:'Other Show',status:'正在看'};
let saved;
let message;
const context = {
  consultations:[active,oldItem],
  animeTitleHints:[],
  input:item,
  crypto:{randomUUID:()=> 'new-import-id'},
  nowText:()=> '10/19 20:00',
  setTmdbStatus:value=>{message=value;},
  clearDeletedTmdbId:()=>{},
  syncDeletedTmdbWatchlistToCloud:()=>{},
  setConsultations:()=>{},
  persist:(name,value)=>{if(name==='consultations')saved=value;},
  fetch:async url=>({
    ok:!String(url).includes('/watchlist'),
    text:async()=>JSON.stringify(String(url).includes('/watchlist') ? {error:'请先在工作台设置中解锁访问'} : {}),
  }),
};
(async()=>{
  const returned = await vm.runInNewContext(helpers+'\n'+source.slice(start,end)+'\nimportTmdb(input)',context);
  const stored = saved.find(entry=>entry.tmdbId===95480);
  assert.equal(saved.filter(entry=>entry.tmdbId===95480).length,1);
  assert.equal(stored.status,'看过的剧');
  assert.equal(stored.id,'existing-slow-horses');
  assert.equal(returned.id,'new-import-id');
  assert.equal(saved.some(entry=>entry.id===returned.id),false);
  const filtered = saved.filter(entry=>entry.title.toLowerCase().includes('slow'));
  const visible = filtered.filter(entry=>entry.status!=='看过的剧');
  assert.equal(filtered.length,1);
  assert.equal(visible.length,0);
  const activeWatchItems = saved.filter(entry=>entry.status!=='看过的剧');
  const resetSelectedId = activeWatchItems[0]?.id || saved[0]?.id || '';
  assert.equal(resetSelectedId,'another-active-show');
  console.log(JSON.stringify({
    duplicateCount:1,storedId:stored.id,returnedId:returned.id,
    returnedIdExists:false,status:stored.status,
    searchMatches:filtered.length,defaultVisible:visible.length,
    selectionAfterEffect:resetSelectedId,
    localSavedDespiteMock401:Boolean(stored),message,
  },null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
