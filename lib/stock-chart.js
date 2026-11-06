export function stockChartMarket(symbol) {
  if (/^(?:s_)?(?:sh|sz|bj)\d{6}$/.test(symbol)) return 'cn';
  if (/^hk\d{5}$/.test(symbol)) return 'hk';
  if (/^gb_[a-z0-9.-]{1,12}$/i.test(symbol)) return 'us';
  if (symbol === 'hf_GC') return 'gold';
  return null;
}

const positive = (value) => value != null && value !== '' && Number(value) > 0 && Number.isFinite(Number(value)) ? Number(value) : null;
const nonnegative = (value) => value != null && value !== '' && Number(value) >= 0 && Number.isFinite(Number(value)) ? Number(value) : null;
const dateText = (value) => String(value || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');

export function tradingMinute(time, market) {
  const [hour, minute] = time.split(':').map(Number);
  const value = hour * 60 + minute;
  if (value < 570 || !Number.isFinite(value)) return null;
  if (market === 'cn') return value <= 690 ? value - 570 : value >= 780 && value <= 900 ? value - 660 : null;
  if (market === 'hk') return value <= 720 ? value - 570 : value >= 780 && value <= 960 ? value - 630 : null;
  return value <= 960 ? value - 570 : null;
}

export function normalizeStockChart(raw, market, mode, history = []) {
  const rows = (Array.isArray(raw) ? raw : raw?.data || []).map((item) => {
    const time = String(item.time || '');
    const date = dateText(item.date || (time.length > 5 ? time.slice(0, 10) : raw.date));
    const price = positive(item.price ?? item.close);
    const changePercent = item.changePercent != null && item.changePercent !== '' && Number.isFinite(Number(item.changePercent)) ? Number(item.changePercent) : null;
    return { date, time: mode === 'intraday' ? time.slice(-5) : date, price, open: positive(item.open), high: positive(item.high), low: positive(item.low), avgPrice: positive(item.avgPrice), volume: nonnegative(item.volume), changePercent };
  }).filter((point) => point.price != null && /^\d{4}-\d{2}-\d{2}$/.test(point.date));
  rows.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const date = rows.at(-1)?.date || dateText(raw?.date);
  const relevant = mode === 'intraday' ? rows.filter((point) => point.date === date && tradingMinute(point.time, market) != null) : rows.filter((point) => point.open && point.high && point.low);
  const unique = [...new Map(relevant.map((point) => [`${point.date} ${point.time}`, point])).values()];
  let cumulative = 0;
  const points = unique.map((point) => {
    const volume = mode === 'intraday' && market === 'cn' ? point.volume == null ? null : Math.max(0, point.volume - cumulative) : point.volume;
    if (point.volume != null) cumulative = point.volume;
    return { ...point, volume: mode === 'daily' && market === 'cn' && volume != null ? volume * 100 : volume };
  });
  const previousDaily = history.filter((point) => dateText(point.date) < date).sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1);
  return {
    date,
    points: mode === 'daily' ? points.slice(-60) : points,
    previousClose: mode === 'intraday' ? positive(raw?.preClose) || positive(previousDaily?.close) : null,
    timezone: { cn: 'Asia/Shanghai', hk: 'Asia/Hong_Kong', us: 'America/New_York', gold: 'America/New_York' }[market],
    volumeUnit: market === 'gold' ? '手' : '股',
  };
}
