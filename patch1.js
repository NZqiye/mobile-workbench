const fs=require('fs');
const path='app/page.jsx';
let s=fs.readFileSync(path,'utf8');
console.log(s.length);