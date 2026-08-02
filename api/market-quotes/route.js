import { NextResponse } from "next/server";

const defaultSymbols = "SGE_AU9999,s_sh000001,s_sz399001,sh600519,sz300750";
const symbolNames = {
  SGE_AU9999: "沪金 Au99.99",
  s_sh000001: "上证指数",
  s_sz399001: "深证成指",
  sh600519: "贵州茅台",
  sz300750: "宁德时代",
};

const fallbackQuotes = [
  { symbol: "SGE_AU9999", name: "沪金 Au99.99", price: 877.5, currency: "¥", changePercent: -0.51, source: "示例" },
  { symbol: "s_sh000001", name: "上证指数", price: 3828.47, currency: "", changePercent: 0.4, source: "示例" },
  { symbol: "s_sz399001", name: "深证成指", price: 13658.44, currency: "", changePercent: 1.1, source: "示例" },
  { symbol: "sh600519", name: "贵州茅台", price: 1333.83, currency: "¥", changePercent: 1.05, source: "示例" },
  { symbol: "sz300750", name: "宁德时代", price: 396.84, currency: "¥", changePercent: 1.53, source: "示例" },
];

function withTime(quote) {
  return { ...quote, updatedAt: new Date().toISOString() };
}

function normalizeSymbol(symbol) {
  const raw = symbol.trim();
  const upper = raw.toUpperCase();
  if (["AU9999", "AU99.99", "SGE_AU9999"].includes(upper)) return "SGE_AU9999";
  if (["000001.SH", "SH000001", "上证指数"].includes(upper)) return "s_sh000001";
  if (["399001.SZ", "SZ399001", "深证成指"].includes(upper)) return "s_sz399001";
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

function parseSina(text, symbols) {
  return symbols.map((symbol) => {
    const match = text.match(new RegExp(`hq_str_${symbol}="([^"]*)"`));
    if (!match || !match[1]) return null;
    const fields = match[1].split(",");
    if (symbol.startsWith("s_")) return parseSimpleIndex(symbol, fields);
    if (symbol.startsWith("SGE_")) return parseGold(symbol, fields);
    return parseStock(symbol, fields);
  }).filter((quote) => quote && Number.isFinite(quote.price));
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
    const quotes = parseSina(await response.text(), symbols);
    if (!quotes.length) throw new Error("行情接口没有返回可用数据");
    return NextResponse.json({ quotes });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "行情读取失败", quotes: fallbackQuotes.map(withTime) },
      { status: 200 },
    );
  }
}