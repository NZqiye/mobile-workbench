const test = require('node:test');
const assert = require('node:assert/strict');

test('desktop widget snapshot shows only today unfinished tasks and counts all of them',async()=>{
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const plans=[{title:'昨天',date:'2026-11-07'},{title:'已完成',date:'2026-11-08',status:'已完成'},...Array.from({length:4},(_,i)=>({title:'待办'+i,date:'2026-11-08',time:'20:30',status:'未完成'}))];
  const data=widgetSnapshot(plans,[],2000,'2026-11-08');
  assert.equal(data.pendingCount,4);assert.equal(data.tasks.length,3);assert.equal(data.tasks[0],'20:30 待办0');
  assert.equal(data.date,'2026-11-08');assert.equal(data.waterMl,0);
});
test('water progress excludes old days and meals, retains target and sends no full private records',async()=>{
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const data=widgetSnapshot([{title:'x'.repeat(100),content:'private note'}],[{type:'water',date:'2026-11-08',amount:500},{type:'water',date:'2026-11-08',amount:250},{type:'water',date:'2026-11-07',amount:1000},{type:'meal',date:'2026-11-08',amount:800}],2500,'2026-11-08');
  assert.equal(data.waterMl,750);assert.equal(data.targetMl,2500);assert.equal(data.tasks[0].length,40);
  assert.equal(JSON.stringify(data).includes('private note'),false);assert.deepEqual(Object.keys(data).sort(),['assetCount','assetDetails','assetTotal','completedCount','date','pendingCount','recentAssets','targetMl','tasks','watchDays','waterMl']);
});

test('film widget groups same-day episodes, deduplicates and excludes stopped or finished shows', async () => {
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const items = [
    {id:'a',title:'Original',titleZh:'追剧甲',status:'正在看',season:1,airTime:'20:00',episodeSchedule:[{date:'2026-11-08',episode:2},{date:'2026-11-08',episode:3},{date:'2026-11-08',episode:3},{date:'2026-11-09',episode:4}]},
    {id:'b',title:'追剧乙',status:'想看的剧',nextAirDate:'2026-11-08',updateEpisodes:'7-8',season:2,airTime:'18:00'},
    ...['看过的剧','暂停/弃剧','已归档'].map((status,i)=>({id:'stopped'+i,title:'不应显示',status,nextAirDate:'2026-11-08',updateEpisodes:'1'})),
  ];
  const data=widgetSnapshot([],[],2000,'2026-11-08',items);
  assert.equal(data.watchDays[0].count,2);
  assert.equal(data.watchDays[0].episodeCount,4);
  assert.deepEqual(data.watchDays[0].lines,['18:00 追剧乙 · 第2季 7/8集','20:00 追剧甲 · 第1季 2/3集']);
  assert.deepEqual(data.watchDays[1].lines,['20:00 追剧甲 · 第1季 4集']);
  assert.equal(JSON.stringify(data).includes('不应显示'),false);
});

test('cached film days cross year boundaries and keep all counts while showing at most three titles', async () => {
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const items=Array.from({length:5},(_,i)=>({id:'show'+i,title:'剧'+i,nextAirDate:'2027-01-01',updateEpisodes:'1',summary:'private review',posterUrl:'https://private.invalid'}));
  const data=widgetSnapshot([],[],2000,'2026-12-31',items);
  assert.equal(data.watchDays.length,14);
  assert.equal(data.watchDays[1].date,'2027-01-01');
  assert.equal(data.watchDays[1].count,5);assert.equal(data.watchDays[1].episodeCount,5);
  assert.equal(data.watchDays[1].lines.length,3);
  assert.deepEqual(data.watchDays[0].lines,[]);
  assert.equal(data.watchDays[13].date,'2027-01-13');
  assert.equal(JSON.stringify(data).includes('private'),false);
});

test('film widget respects dated schedules and only uses the next-episode fallback without a schedule', async () => {
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const data=widgetSnapshot([],[],2000,'2026-11-08',[
    {title:'有排期',nextAirDate:'2026-11-08',updateEpisodes:'99',episodeSchedule:[{date:'2026-11-09',episode:5}]},
    {title:'无排期',nextAirDate:'2026-11-08',currentEpisode:7,airTime:'--:--'},
  ]);
  assert.deepEqual(data.watchDays[0].lines,['无排期 · 第1季 8集']);
  assert.deepEqual(data.watchDays[1].lines,['有排期 · 第1季 5集']);
});

test('asset widget matches in-use purchase totals and newest items, without exporting notes or retired prices', async () => {
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const data=widgetSnapshot([],[],2000,'2026-11-08',[],[
    {name:'旧相机',status:'服役中',price:1000.25,purchaseDate:'2024-01-01',notes:'private serial number'},
    {name:'新手机',status:'服役中',price:2500.1,purchaseDate:'2026-11-07',notes:'private warranty'},
    {name:'新耳机',status:'服役中',price:99.9,purchaseDate:'2026-11-08'},
    {name:'已卖电脑',status:'已出售',price:9000,salePrice:7000},
    {name:'退役电脑',status:'退役',price:2000},
  ]);
  assert.equal(data.assetCount,3);assert.equal(data.assetTotal,3600.25);
  assert.deepEqual(data.recentAssets,['新耳机','新手机']);
  assert.equal(JSON.stringify(data).includes('private'),false);
  const empty=widgetSnapshot([],[],2000,'2026-11-08',[],[]);
  assert.equal(empty.assetCount,0);assert.equal(empty.assetTotal,0);assert.deepEqual(empty.recentAssets,[]);
});

test('poster list retains all visible shows, season groups and only trusted thumbnail URLs', async () => {
  const {widgetSnapshot,widgetPosterUrl}=await import('../lib/native-widgets.js');
  const items=Array.from({length:8},(_,i)=>({id:'show'+i,title:'剧'+i,season:2,nextAirDate:'2026-11-08',updateEpisodes:'3,4',posterUrl:'https://image.tmdb.org/t/p/original/a.jpg',review:'private review'}));
  const data=widgetSnapshot([],[],2000,'2026-11-08',items);
  assert.equal(data.watchDays[0].shows.length,8);
  assert.equal(data.watchDays[0].shows[0].episodes,'3/4');
  assert.equal(data.watchDays[0].shows[0].poster,'https://image.tmdb.org/t/p/w185/a.jpg');
  assert.equal(data.watchDays[0].shows[0].season,'2');
  assert.equal(data.watchDays[0].shows[0].id,'show0:2');
  for(const url of ['http://image.tmdb.org/a','https://image.tmdb.org.evil.test/a','https://user@image.tmdb.org/a','https://image.tmdb.org:444/a','http://127.0.0.1/a','https://private.invalid/a','data:image/png;base64,a'])assert.equal(widgetPosterUrl(url),'');
  assert.equal(widgetPosterUrl('https://lain.bgm.tv/pic/cover/c/a.jpg'),'https://lain.bgm.tv/pic/cover/c/a.jpg');
  assert.equal(JSON.stringify(data).includes('private review'),false);
});

test('individual asset choices preserve identity, date and bundled icon without exporting full records', async () => {
  const {widgetSnapshot}=await import('../lib/native-widgets.js');
  const data=widgetSnapshot([],[],2000,'2026-11-08',[],[
    {id:'mat',name:'瑜伽垫',price:74,purchaseDate:'2026-10-31',status:'服役中',icon:'thiings:yoga-mat',notes:'private warranty'},
    {id:'old',name:'电脑',price:10,purchaseDate:'2026-01-01',status:'服役中',icon:'legacy'},
    {id:'sold',name:'已出售',price:800,status:'已出售'},
  ],{legacy:'/assets-icons/thiings/digital/laptop.webp'});
  assert.equal(data.assetDetails.length,2);
  assert.deepEqual(Object.keys(data.assetDetails[0]).sort(),['icon','id','name','price','purchaseDate']);
  assert.equal(data.assetDetails[0].id,'mat');assert.equal(data.assetDetails[0].price,74);
  assert.equal(data.assetDetails[0].icon,'/assets-icons/thiings/sport/yoga-mat.webp');
  assert.equal(data.assetDetails[1].icon,'/assets-icons/thiings/digital/laptop.webp');
  assert.equal(JSON.stringify(data).includes('private warranty'),false);
});

test('real Java widget policy calculates inclusive days and daily costs and rejects unsafe poster origins', () => {
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'qiye-widget-policy-'));
  const javaRoot='C:/Program Files/ojdkbuild/java-17-openjdk-17.0.3.0.6-1/bin';
  const source=`package cc.qiyeonline.workbench;
public final class WidgetPolicyCheck {
  static void check(boolean value) { if(!value)throw new AssertionError(); }
  public static void main(String[] args) {
    check(WidgetPolicy.days("2026-10-31","2026-11-08")==9);
    check(WidgetPolicy.days("2026-11-08","2026-11-08")==1);
    check(WidgetPolicy.days("2026-11-10","2026-11-08")==0);
    check(WidgetPolicy.days("bad","2026-11-08")==-1);
    check(Math.abs(WidgetPolicy.daily(74,9)-8.2222222222)<0.00001);
    check(Math.abs(WidgetPolicy.drop(74,9)-0.8222222222)<0.00001);
    check(WidgetPolicy.daily(74,0)==0 && WidgetPolicy.drop(74,-1)==0);
    check(WidgetPolicy.remaining("2027-01-01","2026-12-31")==1);
    check(WidgetPolicy.remaining("2026-11-08","2026-11-08")==0);
    check(WidgetPolicy.remaining("2026-11-07","2026-11-08")==-1);
    check(!WidgetPolicy.posterUrl("https://image.tmdb.org/t/p/w185/a.jpg").isEmpty());
    check(!WidgetPolicy.posterUrl("https://lain.bgm.tv/pic/a.jpg").isEmpty());
    for(String url:new String[]{"http://image.tmdb.org/a","https://image.tmdb.org.evil.test/a","https://user@image.tmdb.org/a","https://image.tmdb.org:444/a","http://127.0.0.1/a","https://private.invalid/a"})check(WidgetPolicy.posterUrl(url).isEmpty());
  }
}`;
  try {
    fs.writeFileSync(path.join(folder,'WidgetPolicyCheck.java'),source);
    cp.execFileSync(path.join(javaRoot,'javac.exe'),['-encoding','UTF-8','-d',folder,'android/src/cc/qiyeonline/workbench/WidgetPolicy.java',path.join(folder,'WidgetPolicyCheck.java')]);
    cp.execFileSync(path.join(javaRoot,'java.exe'),['-cp',folder,'cc.qiyeonline.workbench.WidgetPolicyCheck']);
  }finally{assert.ok(path.resolve(folder).startsWith(path.join(path.resolve(os.tmpdir()),'qiye-widget-policy-')));fs.rmSync(folder,{recursive:true,force:true});}
});
