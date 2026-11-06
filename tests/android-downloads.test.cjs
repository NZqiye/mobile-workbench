const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../android/src/cc/qiyeonline/workbench/MainActivity.java'), 'utf8');
const start = source.indexOf('web.evaluateJavascript("(() =>');
const end = source.indexOf(', value -> {', start);
const script = source.slice(start, end).match(/"(?:\\.|[^"\\])*"/g).map(value => JSON.parse(value)).join('');

function harness() {
  const messages = [], alerts = [], listeners = new Map(), blobs = new Map();
  let nativeClicks = 0, id = 0;
  class Anchor { click() { nativeClicks++; } }
  class Reader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(data => {
        this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`;
        this.onload();
      });
    }
  }
  const context = vm.createContext({
    Blob, Map, HTMLAnchorElement: Anchor, FileReader: Reader,
    URL: { createObjectURL(blob) { const url = `blob:fixture-${++id}`; blobs.set(url, blob); return url; }, revokeObjectURL(url) { blobs.delete(url); } },
    fetch: async url => { if (!blobs.has(url)) throw new Error('Blob revoked'); return { blob: async () => blobs.get(url) }; },
    alert: message => alerts.push(message),
    window: { addEventListener: (name, callback) => listeners.set(name, callback) },
    document: { addEventListener: (name, callback) => listeners.set(`document:${name}`, callback) },
  });
  vm.runInContext(script, context);
  listeners.get('message')({ data: 'qiye-download-port', ports: [{ postMessage: message => messages.push(JSON.parse(message)) }] });
  return { context, messages, alerts, listeners, nativeClicks: () => nativeClicks, script };
}

test('native backup export preserves a detached anchor download after immediate URL revocation', async () => {
  const h = harness();
  const content = JSON.stringify({ assets: 'sh603629', watchAssets: 'sh600519' });
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const anchor = new h.context.HTMLAnchorElement();
  anchor.href = h.context.URL.createObjectURL(blob);
  anchor.download = 'qiyeworkbench-backup.json';
  anchor.click();
  h.context.URL.revokeObjectURL(anchor.href);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.nativeClicks(), 0);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].name, anchor.download);
  assert.equal(Buffer.from(h.messages[0].data.split(',')[1], 'base64').toString('utf8'), content);
  assert.equal(h.alerts.length, 0);
});

test('regular link clicks continue normally and large exports report an error', async () => {
  const h = harness();
  const link = new h.context.HTMLAnchorElement();
  link.href = 'https://qiyeonline.cc.cd/';
  link.click();
  assert.equal(h.nativeClicks(), 1);
  const blob = new Blob([new Uint8Array(13 * 1024 * 1024)]);
  await h.context.window.__qiyeSaveBlob(h.context.URL.createObjectURL(blob), 'large.json');
  assert.equal(h.messages.length, 0);
  assert.match(h.alerts[0], /备份文件过大/);
});

test('native Markdown export preserves Chinese text and the full restoration block', async () => {
  const h = harness();
  const content = '# 七夜online\n\n```json\n{"notes":[{"content":"完整记录"}]}\n```';
  const anchor = new h.context.HTMLAnchorElement();
  anchor.href = h.context.URL.createObjectURL(new Blob([content], {type:'text/markdown;charset=utf-8'}));
  anchor.download = 'qiyeworkbench.md';
  anchor.click();
  h.context.URL.revokeObjectURL(anchor.href);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.messages[0].name, 'qiyeworkbench.md');
  assert.equal(Buffer.from(h.messages[0].data.split(',')[1], 'base64').toString('utf8'), content);
});

test('native download setup is idempotent and reports a missing connection', async () => {
  const h = harness();
  vm.runInContext(h.script, h.context);
  h.context.window.__qiyePort = null;
  const blob = new Blob(['# Export'], { type: 'text/markdown' });
  await h.context.window.__qiyeSaveBlob(h.context.URL.createObjectURL(blob), 'export.md');
  assert.equal(h.messages.length, 0);
  assert.match(h.alerts[0], /导出尚未就绪/);
});

test('a visible download link is routed to the native save dialog', async () => {
  const h = harness();
  const blob = new Blob(['test backup'], { type: 'application/json' });
  const anchor = { href: h.context.URL.createObjectURL(blob), download: 'visible.json' };
  let prevented = false;
  h.listeners.get('document:click')({ target: { closest: () => anchor }, preventDefault() { prevented = true; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prevented, true);
  assert.equal(h.messages[0].name, 'visible.json');
});
