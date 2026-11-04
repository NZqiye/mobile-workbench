const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({ Buffer, Response, AbortSignal, fetch, process: { env: {} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/voice-server.js"), "utf8").replace(/export /g, ""), context);

function upload(blob) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  return new Request("https://workbench.test/api/voice/transcribe", { method: "POST", body: form });
}

test("configuration requires a valid account ID and a token", () => {
  assert.equal(context.voiceConfig(), null);
  context.process.env.CLOUDFLARE_ACCOUNT_ID = "a".repeat(32);
  context.process.env.CLOUDFLARE_API_TOKEN = "test-token";
  assert.equal(context.voiceConfig().accountId, "a".repeat(32));
});

test("valid multipart audio is accepted; empty and non-audio uploads are rejected", async () => {
  const file = await context.readVoiceFile(upload(new Blob(["audio"], { type: "audio/webm" })));
  assert.equal(file.size, 5);
  await assert.rejects(context.readVoiceFile(upload(new Blob([], { type: "audio/webm" }))), /不能为空/);
  await assert.rejects(context.readVoiceFile(upload(new Blob(["text"], { type: "text/plain" }))), /不支持/);
});

test("oversized streams are rejected even without a content-length header", async () => {
  const request = new Request("https://workbench.test/api/voice/transcribe", {
    method: "POST", duplex: "half", headers: { "content-type": "multipart/form-data; boundary=test" },
    body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3 * 1024 * 1024 + 100000)); } }),
  });
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(context.readVoiceFile(request), /过大/);
});

test("the provider receives base64 audio and the result is returned as Chinese text", async () => {
  const file = new Blob(["test-audio"], { type: "audio/webm" });
  const text = await context.transcribeVoice(file, { accountId: "a".repeat(32), token: "test-token" }, async (url, options) => {
    assert.match(url, /\/ai\/run\/@cf\/openai\/whisper-large-v3-turbo$/);
    const body = JSON.parse(options.body);
    assert.equal(Buffer.from(body.audio, "base64").toString(), "test-audio");
    assert.equal(body.language, "zh");
    assert.equal(body.task, "transcribe");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return Response.json({ success: true, result: { text: "今天喝了一杯水" } });
  });
  assert.equal(text, "今天喝了一杯水");
});

test("quota and credential failures expose useful messages without leaking provider data", async () => {
  const file = new Blob(["audio"], { type: "audio/webm" });
  await assert.rejects(context.transcribeVoice(file, {}, async () => new Response("secret-details", { status: 429 })), /免费额度/);
  await assert.rejects(context.transcribeVoice(file, {}, async () => new Response("secret-details", { status: 403 })), /权限不足/);
  await assert.rejects(context.transcribeVoice(file, {}, async () => Response.json({ success: true, result: { text: " " } })), /没有识别/);
});
