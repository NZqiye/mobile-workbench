export const voiceModel = "@cf/openai/whisper-large-v3-turbo";
export const voiceFileLimit = 3 * 1024 * 1024;

export function voiceConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !token) return null;
  return { accountId, token };
}

export async function readVoiceFile(request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new Error("请上传录音文件");
  const limit = voiceFileLimit + 64 * 1024;
  const body = await readLimitedBody(request, limit, "录音过大，请控制在60秒以内");
  const form = await new Response(body, { headers: { "content-type": request.headers.get("content-type") } }).formData();
  const file = form.get("audio");
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) throw new Error("录音不能为空");
  if (file.size > voiceFileLimit) throw new Error("录音过大，请控制在60秒以内");
  if (!/^(audio\/(webm|mp4|ogg|wav|x-wav|mpeg)|video\/(webm|mp4))(;|$)/i.test(file.type)) throw new Error("不支持这种录音格式，请使用手机输入法语音录入文字");
  return file;
}

export async function readLimitedBody(request, limit, message) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error(message);
  const reader = request.body?.getReader();
  if (!reader) throw new Error("输入不能为空");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error(message); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function transcribeVoice(file, config, fetcher = fetch) {
  const audio = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${voiceModel}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audio, language: "zh", task: "transcribe", vad_filter: true }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const message = response.status === 429 ? "语音免费额度或请求频率达到上限，请稍后重试或使用输入法语音" : [401, 403].includes(response.status) ? "语音服务权限不足，请检查服务端配置" : "语音服务暂时不可用，请稍后重试";
    throw new Error(message);
  }
  const data = await response.json();
  const text = data.success !== false && typeof data.result?.text === "string" ? data.result.text.trim() : "";
  if (!text) throw new Error("没有识别到清晰的语音，请靠近麦克风重试");
  return text;
}
