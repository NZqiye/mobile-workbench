import { hasSessionSecret, isAuthorized, isSameOrigin } from "./access-auth";

export function isVoiceAuthorized(request) {
  if (!isSameOrigin(request)) return false;
  if (isAuthorized(request)) return true;
  // 仅未配置访问控制的本机开发允许直接使用语音；部署后仍需有效会话。
  return process.env.NODE_ENV === "development" && !hasSessionSecret()
    && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
}
