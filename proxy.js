import { NextResponse } from "next/server";

export function proxy() {
  return NextResponse.json({ error: "未找到资源" }, { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export const config = { matcher: "/_next/image/:path*" };
