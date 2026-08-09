import { NextResponse } from "next/server";

const defaultCodes = "161725,003096,110011";

function normalizeCode(code) {
  const raw = String(code || "").trim();
  return /^\d{6}$/.test(raw) ? raw : "";
}

function mapFund(data) {
  return {
    code: data.FCODE,
    name: data.SHORTNAME,
    navDate: data.PDATE,
    nav: Number(data.NAV),
    estimate: Number(data.GSZ || data.NAV),
    estimateRate: Number(data.GSZZL || 0),
    estimateTime: data.GZTIME,
    source: "天天基金",
  };
}

async function fetchFunds(codes) {
  const response = await fetch(`https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast?FCODES=${codes.join(",")}&FIELDS=FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE`, {
    headers: {
      Referer: "https://h5.1234567.com.cn",
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("基金估值读取失败");
  const data = await response.json();
  return Array.isArray(data.data) ? data.data.map(mapFund) : [];
}

export async function GET(request) {
  const codes = (request.nextUrl.searchParams.get("codes") || defaultCodes)
    .split(",")
    .map(normalizeCode)
    .filter(Boolean);

  try {
    const quotes = await fetchFunds(codes);
    const returnedCodes = new Set(quotes.map((item) => item.code));
    const errors = codes.filter((code) => !returnedCodes.has(code)).map((code) => `${code} 没有可用估值`);
    return NextResponse.json({ quotes, errors });
  } catch (error) {
    return NextResponse.json({ quotes: [], errors: [error.message || "基金读取失败"] }, { status: 200 });
  }
}
