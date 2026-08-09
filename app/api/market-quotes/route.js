import { NextResponse } from "next/server";

const defaultSymbols = "hf_GC,sh603629,sh688507";
const symbolNames = {
  hf_GC: "COMEX黄金",
  sh600584: "长电科技",
  sh603629: "利通电子",
  sh688507: "索辰科技",
};

const fallbackQuotes = [
  { symbol: "hf_GC", name: "COMEX黄金", price: 4096.38, currency: "$", changePercent: -1.54, source: "示例" },
  { symbol: "sh603629", name: "利通电子", price: 20.16, currency: "¥", changePercent: -0.35, source: "示例" },
  { symbol: "sh688507", name: "索辰科技", price: 66.5, currency: "¥", changePercent: 1.18, source: "示例" },
];

function withTime(quote) {
  return { ...quote, updatedAt: new Date().toISOString() };
}

function normalizeSymbol(symbol) {
  const raw = symbol.trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  if (["GC", "COMEX", "COMEX黄金", "COMEX黃金", "HF_GC"].includes(upper)) return "hf_GC";
  if (["AU9999", "AU99.99", "SGE_AU9999"].includes(upper)) return "SGE_AU9999";
  if (["000001.SH", "SH000001", "上证指数"].includes(upper)) return "s_sh000001";
  if (["399001.SZ", "SZ399001", "深证成指"].includes(upper)) return "s_sz399001";
  if (/^hk\d{5}$/i.test(raw)) return lower;
  if (/^rt_hk\d{5}$/i.test(raw)) return lower.replace(/^rt_/, "");
  if (/^\d{1,5}\.HK$/i.test(raw)) return `hk${raw.split(".")[0].padStart(5, "0")}`;
  if (/^(sh|sz|bj)\d{6}$/i.test(raw)) return lower;
  if (/^(gb_|usr_)[a-z0-9.-]+$/i.test(raw)) return `gb_${lower.replace(/^(gb_|usr_)/, "")}`;
  if (/^[a-z][a-z0-9.-]{0,9}$/i.test(raw)) return `gb_${lower}`;
  if (/^\d{1,5}$/.test(raw)) return `hk${raw.padStart(5, "0")}`;
  if (/^6\d{5}$/.test(raw)) return `sh${raw}`;
  if (/^[03]\d{5}$/.test(raw)) return `sz${raw}`;
  if (/^\d{6}\.SH$/i.test(raw)) return `sh${raw.slice(0, 6)}`;
  if (/^\d{6}\.SZ$/i.test(raw)) return `sz${raw.slice(0, 6)}`;
  return raw;
}

function parseSimpleIndex(symbol, fields) {
  return {
    symbol,
    name: symbolNames[symbol] || fields[0] || symbol,
    price: Number(fields[1]),
    currency: "",
    changePercent: Number(fields[3] || 0),
    updatedAt: new Date().toISOString(),
    source: "新浪财经",
  };
}

function parseStock(symbol, fields) {
  const current = Number(fields[3]);
  const previousClose = Number(fields[2]);
  const changePercent = previousClose ? ((current - previousClose) / previousClose) * 100 : 0;
  return {
    symbol,
    name: symbolNames[symbol] || fields[0] || symbol,
    price: current,
    currency: "¥",
    changePercent,
    updatedAt: fields[30] && fields[31] ? `${fields[30]}T${fields[31]}+08:00` : new Date().toISOString(),
    source: "新浪财经",
  };
}

function parseGold(symbol, fields) {
  return {
    symbol,
    name: symbolNames[symbol] || fields[2] || fields[1] || symbol,
    price: Number(fields[3]),
    currency: "¥",
    changePercent: Number(String(fields[17] || "0").replace("%", "")),
    updatedAt: fields[16] ? fields[16].replace(" ", "T") + "+08:00" : new Date().toISOString(),
    source: "新浪财经",
  };
}

function parseGlobalFuture(symbol, fields) {
  const current = Number(fields[0]);
  const previousClose = Number(fields[7]);
  const changePercent = previousClose ? ((current - previousClose) / previousClose) * 100 : 0;
  return {
    symbol,
    name: symbolNames[symbol] || fields[13] || symbol,
    price: current,
    currency: "$",
    changePercent,
    updatedAt: fields[12] && fields[6] ? `${fields[12]}T${fields[6]}+08:00` : new Date().toISOString(),
    source: "新浪财经",
  };
}

function parseHongKongStock(symbol, fields) {
  return {
    symbol,
    name: symbolNames[symbol] || fields[1] || fields[0] || symbol,
    price: Number(fields[6]),
    currency: "HK$",
    changePercent: Number(fields[8] || 0),
    updatedAt: fields[16] && fields[17] ? `${fields[16].replaceAll("/", "-")}T${fields[17]}+08:00` : new Date().toISOString(),
    source: "新浪财经",
  };
}

function parseUsStock(symbol, fields) {
  return {
    symbol,
    name: symbolNames[symbol] || fields[0] || symbol.replace(/^gb_/, "").toUpperCase(),
    price: Number(fields[1]),
    currency: "$",
    changePercent: Number(fields[2] || 0),
    updatedAt: fields[3] ? fields[3].replace(" ", "T") + "+08:00" : new Date().toISOString(),
    source: "新浪财经",
  };
}

function parseSina(text, symbols) {
  return symbols.map((symbol) => {
    const match = text.match(new RegExp(`hq_str_${symbol}="([^"]*)"`));
    if (!match || !match[1]) return null;
    const fields = match[1].split(",");
    if (symbol.startsWith("s_")) return parseSimpleIndex(symbol, fields);
    if (symbol.startsWith("SGE_")) return parseGold(symbol, fields);
    if (symbol.startsWith("hf_")) return parseGlobalFuture(symbol, fields);
    if (symbol.startsWith("hk")) return parseHongKongStock(symbol, fields);
    if (symbol.startsWith("gb_")) return parseUsStock(symbol, fields);
    return parseStock(symbol, fields);
  }).filter((quote) => quote && Number.isFinite(quote.price));
}

async function decodeSinaResponse(response) {
  return new TextDecoder("gb18030").decode(await response.arrayBuffer());
}

export async function GET(request) {
  const symbols = (request.nextUrl.searchParams.get("symbols") || defaultSymbols)
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean);

  try {
    const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;
    const response = await fetch(url, {
      headers: { Referer: "https://finance.sina.com.cn" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());
    const quotes = parseSina(await decodeSinaResponse(response), symbols);
    if (!quotes.length) throw new Error("行情接口没有返回可用数据");
    return NextResponse.json({ quotes });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "行情读取失败", quotes: fallbackQuotes.map(withTime) },
      { status: 200 },
    );
  }
}
