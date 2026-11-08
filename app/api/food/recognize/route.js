import { isSameOrigin, unauthorizedResponse } from "../../../../lib/access-auth";
import { isVoiceAuthorized } from "../../../../lib/voice-access";
import { voiceConfig } from "../../../../lib/voice-server";
import { readFoodPhoto, recognizeFoodPhoto } from "../../../../lib/food-photo-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  if (!isSameOrigin(request)) return Response.json({ error: "来源不受信任" }, { status: 403 });
  if (!isVoiceAuthorized(request)) return unauthorizedResponse();
  const config = voiceConfig();
  if (!config) return Response.json({ error: "食物识别服务尚未配置，请先设置服务端 Cloudflare 凭据" }, { status: 503 });
  let image;
  try { image = await readFoodPhoto(request); }
  catch (error) { return Response.json({ error: error.message || "照片无法读取" }, { status: 400 }); }
  try { return Response.json(await recognizeFoodPhoto(image, config)); }
  catch (error) {
    const message = ["TimeoutError", "AbortError"].includes(error.name) ? "食物识别超时，请重试" : /^(食物|没有识别|估算)/.test(error.message) ? error.message : "食物识别连接失败，请稍后重试";
    return Response.json({ error: message }, { status: 502 });
  }
}
