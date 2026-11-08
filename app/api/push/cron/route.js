import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";
import { pushConfig, validSubscription } from "../../../../lib/push-server";

const cronState = globalThis.__workbenchPushCronState || { running: false };
globalThis.__workbenchPushCronState = cronState;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  const config = pushConfig();
  if (!config) return Response.json({ error: "推送服务尚未配置" }, { status: 503 });
  if (cronState.running) return Response.json({ error: "提醒任务正在执行" }, { status: 409 });
  cronState.running = true;
  try {
    const now = Date.now();
    const { data: rows, error: rowError } = await config.supabase.from("workbench_records")
      .select("id,title,note").eq("page", "app_state").like("title", "%:plans");
    if (rowError) return Response.json({ error: "提醒记录读取失败" }, { status: 500 });
    const { data: subscriptions, error: subError } = await config.supabase.from("push_subscriptions").select("endpoint,subscription,user_id");
    if (subError) return Response.json({ error: "推送订阅读取失败" }, { status: 500 });
    let sent = 0;
    for (const row of rows || []) {
      const userId = String(row.title || "").slice(0, -":plans".length);
      const targets = (subscriptions || []).filter((item) => item.user_id === userId && validSubscription(item.subscription));
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
  } finally {
    cronState.running = false;
  }
}
