import { sessionClearCookie } from "../../../../lib/access-auth";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", sessionClearCookie());
  return response;
}
