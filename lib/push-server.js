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
  if (typeof value?.endpoint !== "string" || value.endpoint.length > 2048) return false;
  let url;
  try { url = new URL(value.endpoint); } catch { return false; }
  const host = url.hostname;
  const provider = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(host)
    || host.endsWith(".notify.windows.com");
  if (!provider || url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
  const publicKey = value?.keys?.p256dh;
  const auth = value?.keys?.auth;
  if (typeof publicKey !== "string" || !/^[A-Za-z0-9_-]{87}=?$/.test(publicKey)
    || typeof auth !== "string" || !/^[A-Za-z0-9_-]{22}(?:==)?$/.test(auth)) return false;
  const decodedKey = Buffer.from(publicKey, "base64url");
  const decodedAuth = Buffer.from(auth, "base64url");
  return decodedKey.length === 65 && decodedKey[0] === 4 && decodedAuth.length === 16
    && decodedKey.toString("base64url") === publicKey.replace(/=+$/, "")
    && decodedAuth.toString("base64url") === auth.replace(/=+$/, "");
}
