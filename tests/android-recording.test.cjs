const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = readFileSync(path.join(__dirname, '../android/assets/native-shell.js'), 'utf8');

function bridge() {
  const listeners = new Map(), sent = [], events = [], classes = [];
  const port = { postMessage: message => sent.push(JSON.parse(message)), close() {} };
  const context = vm.createContext({
    Blob, Uint8Array, atob, DOMException, Event,
    window: { addEventListener: (name, callback) => listeners.set(name, callback), dispatchEvent: event => events.push(event.type) },
    document: { documentElement: { classList: { add: name => classes.push(name) } } },
  });
  vm.runInContext(script, context);
  const connect = () => listeners.get('message')({ data: 'qiye-native-port', ports: [port] });
  return { native: context.window.QiyeNative, connect, sent, events, classes, receive: data => port.onmessage({ data: JSON.stringify(data) }) };
}

test('native recording waits for start acknowledgement and returns an AAC blob', async () => {
  const h = bridge();
  h.connect();
  let started = 0;
  const result = h.native.recordAudio(() => started++);
  const request = h.sent[0];
  assert.equal(request.action, 'audio-start');
  assert.equal(started, 0);
  h.receive({ id: request.id, started: true });
  assert.equal(started, 1);
  h.native.stopRecording();
  assert.equal(h.sent[1].action, 'audio-stop');
  h.receive({ id: request.id, audio: Buffer.from('aac-fixture').toString('base64') });
  const blob = await result;
  assert.equal(blob.type, 'audio/mp4');
  assert.equal(await blob.text(), 'aac-fixture');
});

test('permission denial retains its cause and can open Android permission settings', async () => {
  const h = bridge();
  h.connect();
  const result = h.native.recordAudio();
  h.receive({ id: h.sent[0].id, error: 'Permission denied', name: 'NotAllowedError' });
  await assert.rejects(result, { name: 'NotAllowedError' });
  h.native.openPermissions();
  assert.equal(h.sent[1].action, 'permissions');
  const retry = h.native.recordAudio();
  h.receive({ id: h.sent[2].id, audio: Buffer.from('retry').toString('base64') });
  assert.equal(await (await retry).text(), 'retry');
});

test('duplicate recordings are rejected and cancellation never produces an audio blob', async () => {
  const h = bridge();
  h.connect();
  const result = h.native.recordAudio();
  await assert.rejects(h.native.recordAudio(), /已有录音/);
  h.native.cancelRecording();
  assert.equal(h.sent[1].action, 'audio-cancel');
  h.receive({ id: h.sent[0].id, error: 'Canceled', name: 'AbortError' });
  await assert.rejects(result, { name: 'AbortError' });
});

test('native channel reset cancels pending work and an unconnected shell reports a recoverable error', async () => {
  const h = bridge();
  await assert.rejects(h.native.recordAudio(), /尚未就绪/);
  h.connect();
  const result = h.native.recordAudio();
  h.connect();
  await assert.rejects(result, { name: 'AbortError' });
  assert.ok(h.events.includes('qiye-native-ready'));
  assert.ok(h.classes.includes('android-app'));
});

const source = readFileSync(path.join(__dirname, '../app/components/voice-quick-record.jsx'), 'utf8');
const component = source.slice(source.indexOf('export default function') + 'export default '.length, source.indexOf('\n  return ('));
const flush = () => new Promise(resolve => setImmediate(resolve));

async function voiceHarness({ service = 'ready', nativeError, native = true, holdRecords = false, holdTranscription = false, draft = '' } = {}) {
  const slots = [], effects = [], sent = [], statuses = [], saved = [], timers = [];
  let cursor = 0, mounted = false, audioResolve, audioReject, onStarted, settings = 0, canceled = 0, releaseResponse;
  const context = vm.createContext({
    useId: () => 'voice',
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useEffect(callback) { if (!mounted) effects.push(callback); },
    localStorage: { getItem: () => draft, setItem() {}, removeItem() {} },
    navigator: { mediaDevices: { getUserMedia() { throw new Error('Web microphone should not be used for native recordings'); } } },
    window: { addEventListener() {}, removeEventListener() {}, QiyeNative: native ? {
      recordAudio(callback) { onStarted = callback; return new Promise((resolve, reject) => { audioResolve = resolve; audioReject = reject; if (nativeError) reject(nativeError); }); },
      stopRecording() { audioResolve(new Blob(['native-audio'], { type: 'audio/mp4' })); },
      cancelRecording() { canceled++; audioReject(new DOMException('录音已取消', 'AbortError')); },
    } : undefined },
    AbortController, AbortSignal, FormData, Blob, Date, console,
    setInterval(callback) { const timer = { callback, active: true }; timers.push(timer); return timer; },
    clearInterval(timer) { if (timer) timer.active = false; },
    fetch: async (url, options = {}) => {
      sent.push({ url, options });
      if (url === '/api/voice/transcribe' && !options.method) return { status: service === 'locked' ? 401 : 200, ok: true, json: async () => ({ configured: service === 'ready' }) };
      if (url === '/api/voice/transcribe') return { status: 200, ok: true, json: async () => { if (holdTranscription) await new Promise(resolve => { releaseResponse = resolve; }); return { text: '喝了300毫升水' }; } };
      if (holdRecords) return { status: 200, ok: true, json: async () => { await new Promise(resolve => { releaseResponse = resolve; }); return { records: [{ kind: 'water', value: { amount: 300 } }], issues: [] }; } };
      return { status: 200, ok: true, json: async () => ({ records: [{ kind: 'water', value: { amount: 300 } }], issues: [] }) };
    },
  });
  const renderFn = vm.runInContext(`(${component}\nreturn {phase, status, text, native, micDenied, seconds, startRecording, stopRecording, cancelRecording, cancelProcessing};\n})`, context);
  const props = { onSettings: () => settings++, onPrepare: records => ({ records, issues: [] }), onSave: result => { saved.push(result); return {}; }, onSaved() {} };
  const render = () => { cursor = 0; const result = renderFn(props); statuses.push(result.status); return result; };
  render(); mounted = true; effects.forEach(effect => effect()); await flush();
  return { render, sent, saved, timers, settings: () => settings, canceled: () => canceled, started: () => onStarted(), releaseResponse: () => releaseResponse() };
}

test('the real voice component uses native audio, transcribes m4a and writes the result once', async () => {
  const h = await voiceHarness();
  const recording = h.render().startRecording();
  assert.equal(h.render().phase, 'permission');
  h.started();
  assert.equal(h.render().phase, 'recording');
  h.timers.at(-1).callback();
  assert.equal(h.render().seconds, 1);
  h.render().stopRecording();
  await recording;
  assert.equal(h.render().phase, 'idle');
  assert.equal(h.saved.length, 1);
  const request = h.sent.find(item => item.options.method === 'POST' && item.url === '/api/voice/transcribe');
  assert.equal(request.options.body.get('audio').name, 'recording.m4a');
  assert.equal(request.options.body.get('audio').type, 'audio/mp4');
  assert.ok(h.timers.every(timer => !timer.active));
});

test('native permission denial enables recovery and does not write a record', async () => {
  const error = new Error('麦克风权限未开启'); error.name = 'NotAllowedError';
  const h = await voiceHarness({ nativeError: error });
  await h.render().startRecording();
  assert.equal(h.render().phase, 'idle');
  assert.equal(h.render().micDenied, true);
  assert.equal(h.saved.length, 0);
});

test('locked service opens settings and unavailable service retries without requesting microphone permission', async () => {
  const locked = await voiceHarness({ service: 'locked' });
  await locked.render().startRecording();
  assert.equal(locked.settings(), 1);
  const unavailable = await voiceHarness({ service: 'unavailable' });
  await unavailable.render().startRecording();
  assert.equal(unavailable.sent.length, 2);
  assert.equal(unavailable.render().phase, 'idle');
});

test('canceling a native recording keeps the draft and never transcribes or saves', async () => {
  const h = await voiceHarness();
  const recording = h.render().startRecording();
  h.started();
  h.render().cancelRecording();
  await recording;
  assert.equal(h.render().phase, 'idle');
  assert.match(h.render().status, /已取消/);
  assert.equal(h.saved.length, 0);
  assert.equal(h.sent.length, 1);
});

test('canceling classification ignores a late response and retains recognized text', async () => {
  const h = await voiceHarness({ holdRecords: true, draft: '原有草稿' });
  const recording = h.render().startRecording();
  h.started();
  h.render().stopRecording();
  await flush();
  assert.equal(h.render().phase, 'extracting');
  h.render().cancelProcessing();
  h.releaseResponse();
  await recording;
  assert.equal(h.saved.length, 0);
  assert.equal(h.render().phase, 'idle');
  assert.match(h.render().text, /原有草稿/);
  assert.match(h.render().text, /300/);
  assert.match(h.render().status, /已取消处理/);
});

test('canceling transcription ignores late audio text and does not start classification', async () => {
  const h = await voiceHarness({ holdTranscription: true, draft: '原有草稿' });
  const recording = h.render().startRecording();
  h.started();
  h.render().stopRecording();
  await flush();
  assert.equal(h.render().phase, 'transcribing');
  h.render().cancelProcessing();
  h.releaseResponse();
  await recording;
  assert.equal(h.saved.length, 0);
  assert.equal(h.render().text, '原有草稿');
  assert.equal(h.render().phase, 'idle');
  assert.ok(!h.sent.some(request => request.url === '/api/voice/records'));
});
