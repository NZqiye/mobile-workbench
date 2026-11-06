import { NextResponse } from 'next/server';
import { StockSDK } from 'stock-sdk';
import { normalizeStockChart, stockChartMarket } from '../../../lib/stock-chart';

const sdk = new StockSDK({ timeout: 12000, retry: { maxRetries: 0 } });

export async function GET(request) {
  const symbol = (request.nextUrl.searchParams.get('symbol') || '').toLowerCase();
  const mode = request.nextUrl.searchParams.get('mode') || 'intraday';
  const normalizedSymbol = symbol === 'hf_gc' ? 'hf_GC' : symbol;
  const market = stockChartMarket(normalizedSymbol);
  if (!market || !['intraday', 'daily'].includes(mode)) return NextResponse.json({ error: '暂不支持这个品种或走势图类型。' }, { status: 400 });
  if (market === 'gold' && mode === 'intraday') return NextResponse.json({ error: '黄金暂时提供日 K，请切换到日 K 查看。' }, { status: 400 });
  const code = normalizedSymbol.replace(/^s_/, '').replace(/^(hk|gb_)/, '');
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (mode === 'daily' ? 180 : 14));
  const options = { period: 'daily', startDate: start.toISOString().slice(0, 10).replaceAll('-', ''), adjust: '' };
  try {
    let raw;
    let history = [];
    if (mode === 'daily') raw = market === 'gold' ? await sdk.futures.globalKline('GC00Y', options) : await sdk.kline[market](code, options);
    else if (market === 'cn') raw = await sdk.quotes.timeline(code);
    else {
      const [timeline, daily] = await Promise.allSettled([sdk.kline[`${market}Minute`](code, { period: '1', ndays: 1 }), sdk.kline[market](code, options)]);
      if (timeline.status === 'rejected') throw timeline.reason;
      raw = timeline.value;
      history = daily.status === 'fulfilled' ? daily.value : [];
    }
    const data = normalizeStockChart(raw, market, mode, history);
    if (!data.points.length) return NextResponse.json({ error: '行情源暂未返回走势数据，稍后可重新加载。' }, { status: 503 });
    return NextResponse.json({ symbol: normalizedSymbol, market, mode, ...data, source: mode === 'intraday' && market === 'cn' ? '腾讯行情' : '东方财富', updatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '走势数据暂时读取失败，请稍后重试。' }, { status: 503 });
  }
}
