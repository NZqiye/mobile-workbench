const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function animeRoute({tmdb = true, matches = true, posterPath = '/tmdb.jpg', year = '2026'} = {}) {
  const subject = {id:10,name:'Anime',name_cn:'动画作品',date:'2026-10-01',type:2,images:{large:'https://lain.bgm.tv/pic/cover/l/large.jpg',common:'https://lain.bgm.tv/pic/cover/c/common.jpg'},rating:{score:8},collection:{}};
  const source=fs.readFileSync(path.join(__dirname,'../app/api/anime-updates/route.js'),'utf8').replace(/^import .*;\r?\n/,'').replace('export const maxDuration','const maxDuration').replace('export async function GET','async function GET');
  const context=vm.createContext({URL,Response,AbortSignal,Intl,Date,tmdbToken:tmdb?'test':'',
    fetch:async url=>({ok:true,json:async()=>String(url).endsWith('/calendar')?[]:{data:[subject]}}),
    fetchTmdb:async url=>({ok:true,json:async()=>String(url).includes('/search/multi')?({results:matches?[{id:90,name:'Anime',original_name:'Anime',first_air_date:`${year}-10-01`,media_type:'tv',genre_ids:[16],poster_path:posterPath}]:[]}):({poster_path:null,images:{posters:[{file_path:'/localized-poster.jpg',iso_639_1:'ja'}]}})}),
    mapTmdbResult:item=>({tmdbId:item.id,tmdbMediaType:'tv',title:'动画作品',posterUrl:item.poster_path?`https://image.tmdb.org/t/p/w342${item.poster_path}`:'',summary:'中文简介'}),
  });
  vm.runInContext(source,context);
  return {get:async()=>(await context.GET({url:'http://localhost/api/anime-updates'})).json(),normalize:context.normalizeSubject};
}

test('anime recommendations do not use Bangumi images as posters',()=>{
  const route=animeRoute();
  assert.equal(route.normalize({id:1,name:'作品',images:{large:'large',common:'common'}},0).posterUrl,'');
  assert.equal(route.normalize({id:1,name:'作品',images:{large:'large'}},0).posterUrl,'');
  assert.equal(route.normalize({id:1,name:'作品'},0).posterUrl,'');
});

test('TMDB enrichment supplies the matching work poster without a Bangumi fallback',async()=>{
  const data=await animeRoute().get();
  const item=data.sections.find(section=>section.id==='animeHot').items[0];
  assert.equal(item.bangumiId,10);
  assert.equal(item.tmdbId,90);
  assert.equal(item.posterUrl,'https://image.tmdb.org/t/p/w342/tmdb.jpg');
  assert.equal(item.posterFallbackUrl,undefined);
});

test('a unique exact TMDB title is matched despite a different franchise premiere year',async()=>{
  const data=await animeRoute({year:'2021'}).get();
  const item=data.sections.find(section=>section.id==='animeHot').items[0];
  assert.equal(item.tmdbId,90);
  assert.equal(item.posterUrl,'https://image.tmdb.org/t/p/w342/tmdb.jpg');
});

test('TMDB poster images are checked when the search result omits poster_path',async()=>{
  const data=await animeRoute({posterPath:null}).get();
  const item=data.sections.find(section=>section.id==='animeHot').items[0];
  assert.equal(item.posterUrl,'https://image.tmdb.org/t/p/w342/localized-poster.jpg');
});

test('unmatched anime and an unconfigured TMDB show no non-TMDB poster',async()=>{
  for(const options of [{matches:false},{tmdb:false}]){
    const data=await animeRoute(options).get();
    const item=data.sections.find(section=>section.id==='animeHot').items[0];
    assert.equal(item.posterUrl,'');
    assert.equal(item.tmdbId,undefined);
  }
});
