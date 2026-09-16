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

export function createSession() {
  if (!sessionSecret()) throw new Error("未配置至少 32 位的 WORKBENCH_SESSION_SECRET");
  const payload = `${Date.now()}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidSession(token, now = Date.now()) {
  if (!token || !sessionSecret()) return false;
  const parts = String(token).split(".");
  if (parts.length !== 3) return false;
  const [createdAt, nonce, provided] = parts;
  const timestamp = Number(createdAt);
  if (!/^\d{13}$/.test(createdAt) || !/^[a-f0-9]{32}$/i.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(provided)) return false;
  if (!Number.isSafeInteger(timestamp) || timestamp > now || now - timestamp > sessionMaxAge * 1000) return false;
  const expected = signature(`${createdAt}.${nonce}`);
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
  return isValidSession(requestSessionToken(request));
}

export function unauthorizedResponse() {
  return Response.json({ error: "请先在工作台设置中解锁访问" }, { status: 401 });
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
  const origin = request?.headers?.get?.("origin");
  const referer = request?.headers?.get?.("referer");
  if (!origin && !referer) return true;
  let requestUrl;
  try { requestUrl = new URL(request.url); } catch { return false; }
  for (const value of [origin, referer].filter(Boolean)) {
    try { if (new URL(value).origin !== requestUrl.origin) return false; } catch { return false; }
  }
  return true;
}

export async function readJson(request, limit = maxBodyBytes) {
  const declared = Number(request?.headers?.get?.("content-length") || 0);
  if (declared > limit) throw new Error("请求体过大");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) throw new Error("请求体过大");
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
