const fs=require('fs');const pth=require('path');const sharp=require('sharp');
const root='public/assets-icons';
const MAX=128, Q=80;
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=pth.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.webp'))files.push(p);}})(root);
(async()=>{
  let before=0,after=0,skipped=0;const log=[];
  for(const f of files){
    const s0=fs.statSync(f).size;before+=s0;
    const buf=await sharp(f).resize(MAX,MAX,{fit:'inside',withoutEnlargement:true}).webp({quality:Q}).toBuffer();
    if(buf.length<s0){fs.writeFileSync(f,buf);after+=buf.length;}
    else{skipped++;after+=s0;}
    if(log.length<5)log.push(pth.relative(root,f).padEnd(46)+s0+' -> '+(buf.length<s0?buf.length:s0)+(buf.length<s0?'':' (kept)'));
  }
  console.log('files:',files.length,'skipped(no shrink):',skipped);
  console.log('before:',(before/1024).toFixed(1),'KB  after:',(after/1024).toFixed(1),'KB  saved:',((1-after/before)*100).toFixed(1)+'%');
  log.forEach(l=>console.log('  '+l));
})();
