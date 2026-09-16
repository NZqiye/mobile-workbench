import { pushConfig, validSubscription } from "../../../../lib/push-server";
import { isAuthorized, readJson, unauthorizedResponse } from "../../../../lib/access-auth";

export async function POST(request) {
  const config = pushConfig();
  if (!config) return Response.json({ error: "推送服务尚未配置" }, { status: 503 });
  if (!isAuthorized(request)) return unauthorizedResponse();
  let body;
  try { body = await readJson(request, 32768); } catch (error) {
    return Response.json({ error: error.message || "请求格式无效" }, { status: error.message === "请求体过大" ? 413 : 400 });
  }
  if (!validSubscription(body.subscription)) return Response.json({ error: "推送订阅无效" }, { status: 400 });
  const { error } = await config.supabase.from("push_subscriptions").upsert({
    endpoint: body.subscription.endpoint,
    subscription: body.subscription,
    user_id: "personal-workbench",
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
