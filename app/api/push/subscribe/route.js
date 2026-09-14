import { pushConfig, validSubscription } from "../../../../lib/push-server";

export async function POST(request) {
  const config = pushConfig();
  if (!config) return Response.json({ error: "推送服务尚未配置" }, { status: 503 });
  const body = await request.json();
  if (!process.env.WORKBENCH_ACCESS_CODE || String(body.accessCode || "") !== process.env.WORKBENCH_ACCESS_CODE) {
    return Response.json({ error: "访问码不正确" }, { status: 401 });
  }
  if (!validSubscription(body.subscription)) return Response.json({ error: "推送订阅无效" }, { status: 400 });
  const { error } = await config.supabase.from("push_subscriptions").upsert({
    endpoint: body.subscription.endpoint,
    subscription: body.subscription,
    user_id: String(body.userId || "personal-workbench"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
