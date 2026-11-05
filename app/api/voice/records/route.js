import { isSameOrigin, unauthorizedResponse } from "../../../../lib/access-auth";
import { isVoiceAuthorized } from "../../../../lib/voice-access";
import { readLimitedBody, voiceConfig } from "../../../../lib/voice-server";
import { extractRecordDrafts } from "../../../../lib/record-extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  if (!isSameOrigin(request)) return Response.json({ error: "来源不受信任" }, { status: 403 });
  if (!isVoiceAuthorized(request)) return unauthorizedResponse();
  const config = voiceConfig();
  if (!config) return Response.json({ error: "记录理解服务尚未配置，请先设置服务端 Cloudflare 凭据" }, { status: 503 });
  let text, now;
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("请提交文字内容");
    const data = JSON.parse((await readLimitedBody(request, 16000, "内容过长，请分几次记录")).toString("utf8"));
    if (typeof data.text !== "string" || !data.text.trim() || data.text.length > 2000) throw new Error("请填写2000字以内的记录内容");
    text = data.text.trim();
    now = data.recordedAt ? new Date(data.recordedAt) : new Date();
    if (!Number.isFinite(now.getTime())) throw new Error("输入时间无效，请重试");
  } catch (error) { return Response.json({ error: error instanceof SyntaxError ? "文字内容格式无效" : error.message }, { status: 400 }); }
  try { return Response.json(await extractRecordDrafts(text, config, now)); }
  catch (error) {
    const message = ["TimeoutError", "AbortError"].includes(error.name) ? "记录理解超时，请缩短内容后重试" : error.message?.startsWith("记录") ? error.message : "记录理解服务连接失败，请稍后重试";
    return Response.json({ error: message }, { status: 502 });
  }
}
