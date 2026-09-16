import { createSession, hasSessionSecret, isSameOrigin, readJson, sessionSetCookie } from "../../../lib/access-auth";

const attempts = new Map();
const attemptWindowMs = 10 * 60 * 1000;
const maxAttempts = 10;

function pruneAttempts(now) {
  for (const [ip, record] of attempts) if (now - record.startedAt >= attemptWindowMs) attempts.delete(ip);
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
  const code = body?.code;
  const expectedCode = process.env.WORKBENCH_ACCESS_CODE;

  if (!expectedCode) {
    return Response.json({ error: "尚未配置固定访问码" }, { status: 500 });
  }

  if (typeof code !== "string" || code.length > 256 || code !== expectedCode) {
    return Response.json({ error: "访问码不正确" }, { status: 401 });
  }

  attempts.delete(ip);
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", sessionSetCookie(createSession()));
  return response;
}
