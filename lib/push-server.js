import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export function pushConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !publicKey || !privateKey) return null;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:owner@example.com", publicKey, privateKey);
  return { supabase: createClient(url, serviceKey, { auth: { persistSession: false } }), publicKey };
}

export function validSubscription(value) {
  return Boolean(
    typeof value?.endpoint === "string" && value.endpoint.startsWith("https://") && value.endpoint.length <= 2048
    && typeof value?.keys?.p256dh === "string" && value.keys.p256dh.length <= 256
    && typeof value?.keys?.auth === "string" && value.keys.auth.length <= 256
  );
}
