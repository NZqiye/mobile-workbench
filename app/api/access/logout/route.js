import { isSameOrigin, sessionClearCookie } from "../../../../lib/access-auth";

export async function POST(request) {
  if (!isSameOrigin(request)) return Response.json({ error: "来源不受信任" }, { status: 403 });
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", sessionClearCookie());
  return response;
}
