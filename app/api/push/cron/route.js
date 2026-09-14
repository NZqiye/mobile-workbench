import webpush from "web-push";
import { pushConfig } from "../../../../lib/push-server";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  const config = pushConfig();
  if (!config) return Response.json({ error: "推送服务尚未配置" }, { status: 503 });
  const now = Date.now();
  const { data: rows, error: rowError } = await config.supabase.from("workbench_records")
    .select("id,title,note").eq("page", "app_state").like("title", "%:plans");
  if (rowError) return Response.json({ error: rowError.message }, { status: 500 });
  const { data: subscriptions, error: subError } = await config.supabase.from("push_subscriptions").select("endpoint,subscription,user_id");
  if (subError) return Response.json({ error: subError.message }, { status: 500 });
  let sent = 0;
  for (const row of rows || []) {
    const userId = String(row.title || "").slice(0, -":plans".length);
    const targets = (subscriptions || []).filter((item) => item.user_id === userId);
    let plans;
    try { plans = JSON.parse(row.note || "[]"); } catch { continue; }
    let changed = false;
    for (const plan of Array.isArray(plans) ? plans : []) {
      const due = plan.reminderAt && !plan.reminderSentAt && new Date(plan.reminderAt).getTime() <= now;
      if (!due || plan.status === "已完成") continue;
      const payload = JSON.stringify({ title: "工作台提醒", body: plan.title || "有一项任务到时间了", url: "/" });
      let delivered = false;
      for (const item of targets) {
        try { await webpush.sendNotification(item.subscription, payload); sent += 1; delivered = true; }
        catch (error) {
          if ([404, 410].includes(error.statusCode)) await config.supabase.from("push_subscriptions").delete().eq("endpoint", item.endpoint);
        }
      }
      if (delivered) { plan.reminderSentAt = new Date().toISOString(); changed = true; }
    }
    if (changed) await config.supabase.from("workbench_records").update({ note: JSON.stringify(plans), created_at: new Date().toISOString() }).eq("id", row.id);
  }
  return Response.json({ ok: true, sent });
}
