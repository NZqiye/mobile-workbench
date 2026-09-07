import { NextResponse } from "next/server";

const defaultMarketSymbols = ["hf_GC", "gb_ndx", "gb_inx"];
const defaultFundCodes = ["515100", "513500"];

function splitQueryList(value, fallback) {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : fallback;
}

function marketNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseSina(text, symbol) {
  const match = text.match(new RegExp(`hq_str_${symbol}="([^"]*)"`));
  if (!match || !match[1]) return null;
  const fields = match[1].split(",");
  if (symbol.startsWith("s_")) {
    return {
      symbol,
      name: fields[0] || symbol,
      price: marketNumber(fields[1]),
      change: marketNumber(fields[2]),
      changePercent: marketNumber(fields[3]) || 0,
      updatedAt: new Date().toISOString(),
      source: "新浪财经",
    };
  }
  if (symbol.startsWith("gb_")) {
    const price = marketNumber(fields[1]);
    const change = marketNumber(fields[4]);
    return {
      symbol,
      name: fields[0] || symbol,
      price,
      change,
      changePercent: marketNumber(fields[2]) || 0,
      open: marketNumber(fields[5]),
      high: marketNumber(fields[6]),
      low: marketNumber(fields[7]),
      previousClose: price !== null && change !== null ? price - change : null,
      updatedAt: fields[3] || new Date().toISOString(),
      source: "新浪财经",
    };
  }
  const current = marketNumber(fields[0]);
  const previousClose = marketNumber(fields[7]);
  return {
    symbol,
    name: fields[13] || symbol,
    price: current,
    change: current !== null && previousClose !== null ? current - previousClose : null,
    changePercent: previousClose && current !== null ? ((current - previousClose) / previousClose) * 100 : 0,
    open: marketNumber(fields[8]),
    high: marketNumber(fields[4]),
    low: marketNumber(fields[5]),
    previousClose,
    updatedAt: fields[12] && fields[6] ? `${fields[12]} ${fields[6]}` : new Date().toISOString(),
    source: "新浪财经",
  };
}

async function fetchMarkets(symbols) {
  if (!symbols.length) return [];
  const response = await fetch(`https://hq.sinajs.cn/list=${symbols.join(",")}`, {
    headers: { Referer: "https://finance.sina.com.cn" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("指数行情读取失败");
  const text = new TextDecoder("gb18030").decode(await response.arrayBuffer());
  return symbols.map((symbol) => parseSina(text, symbol)).filter((item) => item && Number.isFinite(item.price));
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
  if (!codes.length) return [];
  const response = await fetch(`https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast?FCODES=${codes.join(",")}&FIELDS=FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE`, {
    headers: {
      Referer: "https://h5.1234567.com.cn",
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("指数代理基金读取失败");
  const data = await response.json();
  return Array.isArray(data.data) ? data.data.map(mapFund) : [];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const marketSymbols = splitQueryList(searchParams.get("symbols"), defaultMarketSymbols);
  const fundCodes = splitQueryList(searchParams.get("funds"), defaultFundCodes);
  const errors = [];
  let markets = [];
  let funds = [];

  try {
    markets = await fetchMarkets(marketSymbols);
  } catch (error) {
    errors.push(error.message || "指数行情读取失败");
  }

  try {
    funds = await fetchFunds(fundCodes);
  } catch (error) {
    errors.push(error.message || "指数代理基金读取失败");
  }

  return NextResponse.json({
    markets,
    funds,
    errors,
    updatedAt: new Date().toISOString(),
  });
}
