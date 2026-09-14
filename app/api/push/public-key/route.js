import { pushConfig } from "../../../../lib/push-server";

export async function GET() {
  const config = pushConfig();
  if (!config) return Response.json({ error: "推送服务尚未配置" }, { status: 503 });
  return Response.json({ publicKey: config.publicKey });
}
