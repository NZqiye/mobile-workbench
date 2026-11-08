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
  assert.equal(JSON.stringify(data).includes('private note'),false);assert.deepEqual(Object.keys(data).sort(),['assetCount','assetTotal','date','pendingCount','recentAssets','targetMl','tasks','watchDays','waterMl']);
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
