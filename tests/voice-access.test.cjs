const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

function load(route, env = {}) {
  const context = vm.createContext({ ...crypto, Buffer, Response, URL, AbortSignal, process: { env: {
    NODE_ENV: "development", CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "test-token", ...env,
  } }, extractRecordDrafts: async () => ({ records: [{ kind: "weight", action: "add", value: { weight: 65 } }], issues: [] }) });
  for (const file of ["lib/access-auth.js", "lib/voice-access.js", "lib/voice-server.js", route]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/export /g, ""), context);
  }
  return context;
}

const transcribeRoute = "app/api/voice/transcribe/route.js";
const recordsRoute = "app/api/voice/records/route.js";
function input(url = "http://localhost:3000/api/voice/records", headers = {}) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ text: "今天体重65公斤" }) });
}

test("local development with voice credentials can classify all modules without cloud-sync setup", async () => {
  const check = await load(transcribeRoute).GET(new Request("http://localhost:3000/api/voice/transcribe"));
  assert.equal(check.status, 200);
  assert.equal((await check.json()).configured, true);
  const response = await load(recordsRoute).POST(input());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).records[0].kind, "weight");
});

test("local development access is limited to loopback and rejects cross-origin requests", async () => {
  const context = load(recordsRoute);
  assert.equal((await context.POST(input("http://192.168.1.10:3000/api/voice/records"))).status, 401);
  assert.equal((await context.POST(input(undefined, { Origin: "https://other.test" }))).status, 403);
  assert.equal(context.isVoiceAuthorized(new Request("http://localhost:3000/api/voice/transcribe", { headers: { Referer: "https://other.test/" } })), false);
});

test("configured access control and production both require a signed session, even on localhost", async () => {
  for (const env of [{ NODE_ENV: "production" }, { WORKBENCH_SESSION_SECRET: "s".repeat(32) }]) {
    assert.equal((await load(transcribeRoute, env).GET(new Request("http://localhost:3000/api/voice/transcribe"))).status, 401);
    assert.equal((await load(recordsRoute, env).POST(input())).status, 401);
  }
  const context = load(recordsRoute, { NODE_ENV: "production", WORKBENCH_SESSION_SECRET: "s".repeat(32) });
  const cookie = `workbench_session=${context.createSession()}`;
  assert.equal((await context.POST(input("https://workbench.test/api/voice/records", { Cookie: cookie }))).status, 200);
  assert.equal((await context.POST(input("https://workbench.test/api/voice/records", { Cookie: cookie, Origin: "https://other.test" }))).status, 403);
});

test("unconfigured providers report unavailable rather than claiming a record was saved", async () => {
  const context = load(recordsRoute, { CLOUDFLARE_API_TOKEN: "" });
  const response = await context.POST(input());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /尚未配置/);
});
