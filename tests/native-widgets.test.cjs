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
  assert.equal(JSON.stringify(data).includes('private note'),false);assert.deepEqual(Object.keys(data).sort(),['date','pendingCount','targetMl','tasks','waterMl']);
});
