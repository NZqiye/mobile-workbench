import { isSameOrigin, unauthorizedResponse } from "../../../../lib/access-auth";
import { isVoiceAuthorized } from "../../../../lib/voice-access";
import { readVoiceFile, transcribeVoice, voiceConfig } from "../../../../lib/voice-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  if (!isVoiceAuthorized(request)) return unauthorizedResponse();
  return Response.json({ configured: Boolean(voiceConfig()) });
}

export async function POST(request) {
  if (!isSameOrigin(request)) return Response.json({ error: "来源不受信任" }, { status: 403 });
  if (!isVoiceAuthorized(request)) return unauthorizedResponse();
  const config = voiceConfig();
  if (!config) return Response.json({ error: "语音服务尚未配置，请先设置服务端的 Cloudflare 账号和 API Token" }, { status: 503 });
  let file;
  try { file = await readVoiceFile(request); }
  catch (error) { return Response.json({ error: error.message || "录音文件无效" }, { status: 400 }); }
  try { return Response.json({ text: await transcribeVoice(file, config) }); }
  catch (error) {
    const message = ["TimeoutError", "AbortError"].includes(error.name) ? "语音识别超时，请缩短录音后重试" : error.message?.startsWith("语音") || error.message?.startsWith("没有识别") ? error.message : "语音服务连接失败，请稍后重试或使用输入法语音";
    return Response.json({ error: message }, { status: 502 });
  }
}
