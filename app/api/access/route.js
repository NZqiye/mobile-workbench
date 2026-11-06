import { timingSafeEqual } from "node:crypto";
import { createSession, hasSessionSecret, isAuthorized, isSameOrigin, readJson, sessionSetCookie } from "../../../lib/access-auth";

const attempts = new Map();
const attemptWindowMs = 10 * 60 * 1000;
const maxAttempts = 10;

function pruneAttempts(now) {
  for (const [ip, record] of attempts) if (now - record.startedAt >= attemptWindowMs) attempts.delete(ip);
}

function accountUser() {
  return { id: "personal-workbench", name: process.env.WORKBENCH_USERNAME || "qiye" };
}

export async function GET(request) {
  const authenticated = isAuthorized(request);
  return Response.json({ authenticated, username: accountUser().name, user: authenticated ? accountUser() : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  if (!isSameOrigin(request)) return Response.json({ error: "来源不受信任" }, { status: 403 });
  if (!hasSessionSecret()) return Response.json({ error: "尚未配置高熵会话密钥" }, { status: 500 });
  const now = Date.now();
  pruneAttempts(now);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const recent = attempts.get(ip);
  if (recent && now - recent.startedAt < attemptWindowMs && recent.count >= maxAttempts) return Response.json({ error: "尝试次数过多，请 10 分钟后再试" }, { status: 429 });
  const record = recent && now - recent.startedAt < attemptWindowMs ? recent : { startedAt: now, count: 0 };
  record.count += 1;
  attempts.set(ip, record);
  let body;
  try { body = await readJson(request, 4096); } catch (error) { return Response.json({ error: error.message || "请求格式无效" }, { status: 400 }); }
  const legacy = typeof body?.code === "string" && body?.username === undefined && body?.password === undefined;
  const password = legacy ? body.code : body?.password;
  const username = legacy ? accountUser().name : body?.username;
  const expectedCode = process.env.WORKBENCH_ACCESS_CODE;

  if (!expectedCode) {
    return Response.json({ error: "尚未配置固定访问码" }, { status: 500 });
  }

  const supplied = Buffer.from(typeof password === "string" ? password : "");
  const expected = Buffer.from(expectedCode);
  const passwordMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  if (typeof password !== "string" || password.length > 256 || username !== accountUser().name || !passwordMatches) {
    return Response.json({ error: "账号或密码不正确" }, { status: 401 });
  }

  attempts.delete(ip);
  const response = Response.json({ ok: true, user: accountUser() }, { headers: { "Cache-Control": "no-store" } });
  response.headers.set("Set-Cookie", sessionSetCookie(createSession()));
  return response;
}
