import { NextResponse } from "next/server";
import { StockSDK } from "stock-sdk";

const defaultSymbols = "hf_GC,sh603629,sh688507";
const symbolNames = {
  hf_GC: "COMEX黄金",
  sh600584: "长电科技",
  sh603629: "利通电子",
  sh688507: "索辰科技",
};

const stockSdk = new StockSDK();
const sdkSourceNames = { tencent: "腾讯行情", eastmoney: "东方财富", sina: "新浪财经" };

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
    change: current - previousClose,
    changePercent,
    open: Number(fields[1]),
    high: Number(fields[4]),
    low: Number(fields[5]),
    previousClose,
    volume: Number(fields[8]),
    amount: Number(fields[9]),
    market: "A股",
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
    change: Number(fields[7] || 0),
    changePercent: Number(fields[8] || 0),
    open: Number(fields[2]),
    previousClose: Number(fields[3]),
    high: Number(fields[4]),
    low: Number(fields[5]),
    volume: Number(fields[12]),
    amount: Number(fields[11]),
    market: "港股",
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
    change: Number(fields[1]) * Number(fields[2] || 0) / 100,
    changePercent: Number(fields[2] || 0),
    market: "美股",
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

function sdkCode(symbol) {
  return symbol.replace(/^s_/, "").replace(/^hk/, "").replace(/^gb_/, "");
}

function sdkMarket(symbol) {
  if (/^(?:s_)?(?:sh|sz|bj)\d{6}$/.test(symbol)) return "cn";
  if (/^hk\d{5}$/.test(symbol)) return "hk";
  if (/^gb_[a-z0-9.-]+$/i.test(symbol)) return "us";
  return "";
}

function comparableCode(value) {
  return String(value || "").toLowerCase().replace(/^s_/, "").replace(/^(sh|sz|bj|hk|gb_)/, "");
}

function normalizeSdkQuote(quote, symbol, market) {
  const currencies = { cn: "¥", hk: quote.currency || "HK$", us: "$" };
  const marketNames = { cn: "A股", hk: "港股", us: "美股" };
  return {
    symbol,
    name: symbolNames[symbol] || quote.name || symbol,
    price: Number(quote.price),
    currency: currencies[market],
    change: Number(quote.change || 0),
    changePercent: Number(quote.changePercent || 0),
    open: Number.isFinite(Number(quote.open)) ? Number(quote.open) : null,
    high: Number.isFinite(Number(quote.high)) ? Number(quote.high) : null,
    low: Number.isFinite(Number(quote.low)) ? Number(quote.low) : null,
    previousClose: Number.isFinite(Number(quote.prevClose)) ? Number(quote.prevClose) : null,
    volume: Number.isFinite(Number(quote.volume)) ? Number(quote.volume) : null,
    amount: Number.isFinite(Number(quote.amount)) ? Number(quote.amount) * (market === "cn" ? 10000 : 1) : null,
    turnoverRate: Number.isFinite(Number(quote.turnoverRate)) ? Number(quote.turnoverRate) : null,
    market: marketNames[market],
    updatedAt: quote.timestamp ? new Date(quote.timestamp).toISOString() : new Date().toISOString(),
    source: `${sdkSourceNames[quote.source] || quote.source || "公开行情"} · stock-sdk`,
  };
}

async function loadSdkGroup(symbols, market) {
  if (!symbols.length) return { quotes: [], missing: [] };
  try {
    const requestedCodes = symbols.map(sdkCode);
    const data = await stockSdk.quotes[market](requestedCodes);
    const quotes = [];
    const missing = [];
    symbols.forEach((symbol) => {
      const code = comparableCode(symbol);
      const quote = data.find((item) => comparableCode(item.code) === code);
      if (quote && Number.isFinite(Number(quote.price))) quotes.push(normalizeSdkQuote(quote, symbol, market));
      else missing.push(symbol);
    });
    return { quotes, missing };
  } catch {
    return { quotes: [], missing: symbols };
  }
}

async function loadSinaQuotes(symbols) {
  if (!symbols.length) return [];
  const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;
  const response = await fetch(url, {
    headers: { Referer: "https://finance.sina.com.cn" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  return parseSina(await decodeSinaResponse(response), symbols);
}

async function decodeSinaResponse(response) {
  return new TextDecoder("gb18030").decode(await response.arrayBuffer());
}

export async function GET(request) {
  const symbols = (request.nextUrl.searchParams.get("symbols") || defaultSymbols)
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean);

  const groups = {
    cn: symbols.filter((symbol) => sdkMarket(symbol) === "cn"),
    hk: symbols.filter((symbol) => sdkMarket(symbol) === "hk"),
    us: symbols.filter((symbol) => sdkMarket(symbol) === "us"),
  };
  const [cn, hk, us] = await Promise.all([
    loadSdkGroup(groups.cn, "cn"),
    loadSdkGroup(groups.hk, "hk"),
    loadSdkGroup(groups.us, "us"),
  ]);
  const sdkQuotes = [...cn.quotes, ...hk.quotes, ...us.quotes];
  const fallbackSymbols = [...symbols.filter((symbol) => !sdkMarket(symbol)), ...cn.missing, ...hk.missing, ...us.missing];
  let sinaQuotes = [];
  try {
    sinaQuotes = await loadSinaQuotes(fallbackSymbols);
  } catch {}

  const quoteMap = new Map([...sdkQuotes, ...sinaQuotes].map((quote) => [quote.symbol, quote]));
  const quotes = symbols.map((symbol) => quoteMap.get(symbol)).filter(Boolean);
  if (!quotes.length) {
    return NextResponse.json({ error: "行情源暂时不可用", quotes: [] }, { status: 503 });
  }
  const missingCount = symbols.length - quotes.length;
  return NextResponse.json({
    quotes,
    warning: missingCount > 0 ? `${missingCount} 只自选暂时没有行情` : "",
  });
}
