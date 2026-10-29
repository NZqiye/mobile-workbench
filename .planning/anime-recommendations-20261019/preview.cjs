// Local UI verification only: deterministic sample data; no cloud writes.
const http = require('node:http');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').resolve(__dirname, '../../app/api/anime-updates/route.js'), 'utf8');
const tmdb = fs.readFileSync(require('node:path').resolve(__dirname, '../../lib/tmdb.js'), 'utf8');
const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai'}).format(new Date());
const weekday = new Date(`${today}T12:00:00+08:00`).getUTCDay() || 7;
const year = today.slice(0,4);
const month = String(Math.floor((Number(today.slice(5,7))-1)/3)*3+1).padStart(2,'0');
const sample = (id, title) => ({id, type:2, name:title, name_cn:title, date:`${year}-${month}-01`, summary:'本地界面验证示例，用于检查标题、简介、评分与放送排期显示。', rating:{score:8.1}, images:{}});
const fixtures = [sample(99001,'本地验证示例：这是一部标题很长的新番，用于检查手机端换行与卡片布局'),sample(99002,'新番界面验证示例二')];
const context = vm.createContext({Date, Intl, Response, URL, AbortSignal, process:{env:{TMDB_ACCESS_TOKEN:'local-preview-token'}}, fetch:async (url) => {
  url = String(url);
  if(url.startsWith('https://api.themoviedb.org/')) {
    const query = new URL(url).searchParams.get('query');
    const item = fixtures.find((item) => item.name === query);
    return Response.json({results:item ? [{id:item.id,media_type:'tv',genre_ids:[16],name:`TMDB 中文资料示例：${item.name}`,original_name:item.name,first_air_date:item.date,overview:'本地 TMDB 中文简介样例，仅用于验证显示，不是真实线上资料。',vote_average:8}] : []});
  }
  return Response.json(url.endsWith('/calendar') ? [{weekday:{id:weekday},items:fixtures}] : {data:fixtures});
}});
vm.runInContext(tmdb.replace(/^export /gm,'')+'\n'+source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nthis.GET = GET;',context);
http.createServer(async(req,res)=>{
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(401); return res.end('{"error":"local preview blocks writes"}'); }
    if (req.url.startsWith('/api/anime-updates')) {
      const result = await context.GET(new Request('http://127.0.0.1:3117'+req.url));
      res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(await result.text());
    }
    if(req.url.startsWith('/api/')) {res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"ok":false,"error":"Local isolated preview: other sources unavailable"}');}
    const upstream = await fetch('http://127.0.0.1:3116'+req.url);
    const headers=Object.fromEntries([...upstream.headers].filter(([k])=>!['content-encoding','content-length','transfer-encoding','connection','set-cookie'].includes(k)));
    res.writeHead(upstream.status,headers);res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch(error){res.writeHead(502);res.end(error.message);}
}).listen(3117,'127.0.0.1',()=>console.log('Isolated sample preview: http://127.0.0.1:3117'));
