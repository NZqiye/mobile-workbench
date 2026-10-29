const http = require('node:http');
const net = require('node:net');
const readable = ['/api/tmdb/search', '/api/tmdb/details', '/api/omdb/details'];
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1:3107').pathname;
  if (!['GET', 'HEAD'].includes(req.method) || (pathname.startsWith('/api/') && !readable.includes(pathname))) {
    res.writeHead(401, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({error:'本地只读预览：禁止云端写入'}));
  }
  const base = readable.includes(pathname) ? 'https://qiyeonline.cc.cd' : 'http://127.0.0.1:3106';
  try {
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-url', 'x-nextjs-data', 'accept', 'user-agent'].includes(name)));
    const upstream = await fetch(base + req.url, {headers, signal:AbortSignal.timeout(30000)});
    const responseHeaders = Object.fromEntries([...upstream.headers].filter(([name]) => !['set-cookie','content-encoding','content-length','transfer-encoding','connection','keep-alive'].includes(name)));
    responseHeaders['cache-control'] = 'no-store';
    res.writeHead(upstream.status, responseHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.writeHead(502, {'Content-Type':'application/json'});
    res.end(JSON.stringify({error:error.message}));
  }
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/_next/')) return socket.destroy();
  const upstream = net.connect(3106, '127.0.0.1', () => {
    upstream.write(req.method + ' ' + req.url + ' HTTP/1.1\r\n' + Object.entries(req.headers).map(([name, value]) => name + ': ' + value).join('\r\n') + '\r\n\r\n');
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.listen(3107, '127.0.0.1', () => console.log('Read-only UI preview: http://127.0.0.1:3107; all writes blocked'));
