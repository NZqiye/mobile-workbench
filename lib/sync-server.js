import { createClient } from "@supabase/supabase-js";

// 访问码解锁后，所有云端读写都在服务端用 service_role 完成，
// 浏览器不再直连数据库（anon key 因此不再是数据入口）。
export const syncUserId = "personal-workbench";
export const syncPage = "app_state";
export const syncBodyLimit = 4 * 1024 * 1024;

export function syncConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return {
    userId: syncUserId,
    page: syncPage,
    supabase: createClient(url, serviceKey, { auth: { persistSession: false } }),
  };
}

// 与前端原本的 meta 文案保持一致（北京时间 M/D HH:MM）
export function nowText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${Number(get("month"))}/${Number(get("day"))} ${get("hour")}:${get("minute")}`;
}
