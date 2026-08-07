import { NextResponse } from "next/server";

const fallbackQuote = {
  text: "人生没有白走的路，每一步都算数。",
  from: "本地备用",
  author: "",
};

export async function GET() {
  try {
    const response = await fetch("https://v1.hitokoto.cn/?c=d&c=i&encode=json", {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) throw new Error("quote request failed");

    const data = await response.json();
    return NextResponse.json({
      text: data.hitokoto || fallbackQuote.text,
      from: data.from || "一言",
      author: data.from_who || "",
      source: "Hitokoto",
    });
  } catch {
    return NextResponse.json({ ...fallbackQuote, source: "fallback" });
  }
}
