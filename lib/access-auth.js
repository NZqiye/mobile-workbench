import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const sessionCookieName = "workbench_session";
export const sessionMaxAge = 7 * 24 * 60 * 60;
const maxBodyBytes = 64 * 1024;

function sessionSecret() {
  const value = process.env.WORKBENCH_SESSION_SECRET || "";
  return value.length >= 32 ? value : "";
}

export function hasSessionSecret() {
  return Boolean(sessionSecret());
}

function signature(payload) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSession(accountId = "personal-workbench") {
  if (!sessionSecret()) throw new Error("未配置至少 32 位的 WORKBENCH_SESSION_SECRET");
  if (!["personal-workbench", "test-workbench"].includes(accountId)) throw new Error("账号不存在");
  const payload = `${Date.now()}.${randomBytes(16).toString("hex")}${accountId === "personal-workbench" ? "" : `.${accountId}`}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidSession(token, now = Date.now()) {
  if (!token || !sessionSecret()) return false;
  const parts = String(token).split(".");
  if (parts.length !== 3 && parts.length !== 4) return false;
  const [createdAt, nonce] = parts;
  const provided = parts.at(-1);
  if (parts.length === 4 && parts[2] !== "test-workbench") return false;
  const timestamp = Number(createdAt);
  if (!/^\d{13}$/.test(createdAt) || !/^[a-f0-9]{32}$/i.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(provided)) return false;
  if (!Number.isSafeInteger(timestamp) || timestamp > now || now - timestamp > sessionMaxAge * 1000) return false;
  const expected = signature(parts.slice(0, -1).join("."));
  const left = Buffer.from(provided, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookieValue(request, name) {
  const header = request?.headers?.get?.("cookie") || "";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!item) return "";
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return ""; }
}

export function requestSessionToken(request) {
  return request?.cookies?.get?.(sessionCookieName)?.value || cookieValue(request, sessionCookieName);
}

export function isAuthorized(request) {
  const accountId = requestAccountId(request);
  const expected = request?.headers?.get?.("x-workbench-account");
  return Boolean(accountId && (!expected || expected === accountId));
}

export function requestAccountId(request) {
  const token = requestSessionToken(request);
  if (!isValidSession(token)) return null;
  const parts = token.split(".");
  return parts.length === 4 ? parts[2] : "personal-workbench";
}

export function isPrimaryAccount(request) {
  return isAuthorized(request) && requestAccountId(request) === "personal-workbench";
}

export function unauthorizedResponse() {
  return Response.json({ error: "请先在工作台设置中登录账号" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}

export function sessionSetCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}${secure}`;
}

export function sessionClearCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function isSameOrigin(request) {
  if (request?.headers?.get?.("sec-fetch-site") === "cross-site") return false;
  const origin = request?.headers?.get?.("origin");
  const referer = request?.headers?.get?.("referer");
  if (!origin && !referer) return true;
  let requestUrl;
  try { requestUrl = new URL(request.url); } catch { return false; }
  if (["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname)) {
    try {
      const localUrl = new URL(`${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`);
      if (["localhost", "127.0.0.1", "[::1]"].includes(localUrl.hostname) && localUrl.port === requestUrl.port) requestUrl = localUrl;
    } catch { return false; }
  }
  for (const value of [origin, referer].filter(Boolean)) {
    try { if (new URL(value).origin !== requestUrl.origin) return false; } catch { return false; }
  }
  return true;
}

export async function readJson(request, limit = maxBodyBytes) {
  if (!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) throw new Error("请使用 JSON 请求");
  const declared = Number(request?.headers?.get?.("content-length") || 0);
  if (declared > limit) throw new Error("请求体过大");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("请求体不能为空");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("请求体过大"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw new Error("请求体不能为空");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求 JSON 无效");
  return value;
}

export function parseMediaInput(body) {
  const mediaId = Number(body?.mediaId);
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0) throw new Error("TMDB mediaId 无效");
  if (body?.mediaType !== "movie" && body?.mediaType !== "tv") throw new Error("TMDB 类型无效");
  return { mediaId, mediaType: body.mediaType };
}
