const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const sharp = require('sharp');

function load(route = false, env = {}) {
  const context = vm.createContext({ ...crypto, Buffer, Response, URL, AbortSignal, sharp, process: { env: {
    NODE_ENV: 'production', WORKBENCH_SESSION_SECRET: 's'.repeat(32), CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-token', ...env,
  } } });
  const files = ['lib/access-auth.js','lib/voice-access.js','lib/voice-server.js','lib/food-photo-server.js'];
  if (route) files.push('app/api/food/recognize/route.js');
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,''),context);
  return context;
}
function upload(buffer, type = 'image/jpeg', headers = {}) {
  const form = new FormData(); form.append('photo',new Blob([buffer],{type}),'food.jpg');
  return new Request('https://workbench.test/api/food/recognize',{method:'POST',body:form,headers});
}
const estimate = { isFood:true,items:[{name:'米饭',portion:'约150克',calories:174.4},{name:'炒鸡蛋',portion:'约100克',calories:205}],note:'用油和份量为估算。' };

test('real images are decoded, resized and stripped of camera metadata before sending',async()=>{
  const source=await sharp({create:{width:1800,height:1200,channels:3,background:'#eee'}}).jpeg().withExif({IFD0:{Artist:'private-location-metadata'}}).toBuffer();
  const result=await load().readFoodPhoto(upload(source));
  const metadata=await sharp(result).metadata();
  assert.equal(metadata.width,1024);assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);
});
test('empty, spoofed, SVG, oversized and animated uploads are rejected',async()=>{
  const c=load();
  await assert.rejects(c.readFoodPhoto(upload(Buffer.alloc(0))),/请选择/);
  await assert.rejects(c.readFoodPhoto(upload(Buffer.from('not an image'))),/无法读取/);
  await assert.rejects(c.readFoodPhoto(upload(Buffer.from('<svg/>'),'image/svg+xml')),/JPG/);
  await assert.rejects(c.readFoodPhoto(upload(Buffer.alloc(2*1024*1024+1))),/过大/);
  const request=new Request('https://workbench.test/api/food/recognize',{method:'POST',duplex:'half',headers:{'Content-Type':'multipart/form-data; boundary=a'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(2200000));}})});
  await assert.rejects(c.readFoodPhoto(request),/过大/);
});
test('per-food calories are summed locally; model totals cannot override them',()=>{
  const value=load().normalizeFoodEstimate({...estimate,totalCalories:9999});
  assert.equal(value.totalCalories,379);assert.match(value.title,/米饭（约150克）/);
});
test('non-food, missing portions, negative numbers and malformed JSON cannot become records',()=>{
  const c=load();
  for(const value of ['invalid','{}',{isFood:false,items:[]},{items:[{name:'米饭',calories:200}]},{items:[{name:'米饭',portion:'一碗',calories:-100}]},{items:[{name:'米饭',portion:'一碗',calories:'200'}]}])assert.throws(()=>c.normalizeFoodEstimate(value));
  assert.equal(c.normalizeFoodEstimate('```json\n'+JSON.stringify(estimate)+'\n```').totalCalories,379);
});
test('vision request uses a fixed provider, cleaned image bytes and no user-supplied URL',async()=>{
  const result=await load().recognizeFoodPhoto(Buffer.from('clean-jpeg'),{accountId:'a'.repeat(32),token:'test-token'},async(url,options)=>{
    assert.match(url,/\/ai\/run\/@cf\/meta\/llama-4-scout-17b-16e-instruct$/);
    const body=JSON.parse(options.body),image=body.messages[0].content[1].image_url.url;
    assert.equal(image,'data:image/jpeg;base64,'+Buffer.from('clean-jpeg').toString('base64'));
    assert.equal(options.headers.Authorization,'Bearer test-token');
    return Response.json({success:true,result:{response:JSON.stringify(estimate)}});
  });
  assert.equal(result.totalCalories,379);
});
test('provider failures do not expose credentials or an invented estimate',async()=>{
  const c=load();
  for(const status of [403,429,500])await assert.rejects(c.recognizeFoodPhoto(Buffer.from('image'),{},async()=>new Response('secret-provider-details',{status})),error=>!error.message.includes('secret')&&/食物识别/.test(error.message));
});
test('production recognition requires login and same-origin even with a valid cookie',async()=>{
  const c=load(true),source=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).jpeg().toBuffer();
  assert.equal((await c.POST(upload(source))).status,401);
  const cookie='workbench_session='+c.createSession();
  assert.equal((await c.POST(upload(source,'image/jpeg',{Cookie:cookie,Origin:'https://other.test'}))).status,403);
  c.recognizeFoodPhoto=async()=>c.normalizeFoodEstimate(estimate);
  const response=await c.POST(upload(source,'image/jpeg',{Cookie:cookie,Origin:'https://workbench.test'}));
  assert.equal(response.status,200);assert.equal((await response.json()).totalCalories,379);
  const unavailable=load(true,{CLOUDFLARE_API_TOKEN:''});
  assert.equal((await unavailable.POST(upload(source,'image/jpeg',{Cookie:'workbench_session='+unavailable.createSession()}))).status,503);
});
