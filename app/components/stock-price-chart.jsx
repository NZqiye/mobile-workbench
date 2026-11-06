"use client";

import { useEffect, useState } from 'react';
import WorkbenchSelect from './workbench-select';
import { stockChartMarket, tradingMinute } from '../../lib/stock-chart';
import './stock-price-chart.css';

const priceText = (value) => value == null ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const volumeText = (value) => value == null ? '—' : value >= 1e8 ? `${(value / 1e8).toFixed(2)}亿` : value >= 1e4 ? `${(value / 1e4).toFixed(2)}万` : value.toLocaleString('zh-CN');

export default function StockPriceChart({ quotes }) {
  const [symbol, setSymbol] = useState('');
  const [mode, setMode] = useState('intraday');
  const available = quotes.filter((quote) => stockChartMarket(quote.symbol));
  const quote = available.find((item) => item.symbol === symbol) || available.find((item) => stockChartMarket(item.symbol) === 'cn') || available[0];
  if (!quote) return null;
  const market = stockChartMarket(quote.symbol);
  const activeMode = market === 'gold' ? 'daily' : mode;
  return (
    <section className="stock-chart-panel" aria-label="股价走势图">
      <div className="stock-chart-toolbar">
        <h3>股价走势</h3>
        <WorkbenchSelect value={quote.symbol} onChange={(event) => setSymbol(event.target.value)} aria-label="选择走势股票">
          {available.map((item) => <option key={item.symbol} value={item.symbol}>{item.name} · {item.symbol.toUpperCase()}</option>)}
        </WorkbenchSelect>
      </div>
      <div className="stock-chart-controls">
        <div className="stock-chart-tabs" role="group" aria-label="走势图类型">
          <button type="button" aria-pressed={activeMode === 'intraday'} disabled={market === 'gold'} onClick={() => setMode('intraday')}>分时</button>
          <button type="button" aria-pressed={activeMode === 'daily'} onClick={() => setMode('daily')}>日 K</button>
        </div>
        <span>{activeMode === 'daily' ? '最近 60 个交易日 · 不复权' : '最近交易日 · 1 分钟'}</span>
      </div>
      <PricePlot key={quote.symbol} quote={quote} mode={activeMode} />
    </section>
  );
}

function PricePlot({ quote, mode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy) return;
      busy = true;
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/market-history?symbol=${encodeURIComponent(quote.symbol)}&mode=${mode}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '走势读取失败，请重试。');
        if (controller.signal.aborted) return;
        setData(result);
        setSelected(null);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message || '走势读取失败，请重试。');
      } finally {
        busy = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    const timer = mode === 'intraday' ? setInterval(load, 60000) : null;
    return () => { controller.abort(); if (timer) clearInterval(timer); };
  }, [quote.symbol, mode, reload]);

  const current = data?.mode === mode && data?.symbol === quote.symbol ? data : null;
  const points = current?.points || [];
  const active = Math.min(selected ?? points.length - 1, points.length - 1);
  const point = points[active];
  const previous = mode === 'intraday' ? current?.previousClose : points[active - 1]?.price;
  const change = mode === 'daily' && point?.changePercent != null ? point.changePercent : point && previous > 0 ? (point.price / previous - 1) * 100 : null;
  const tone = change > 0 ? 'rise' : change < 0 ? 'fall' : 'flat';
  const prices = points.flatMap((item) => mode === 'daily' ? [item.low, item.high] : [item.price, item.avgPrice]).filter((value) => value > 0);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const center = previous > 0 && mode === 'intraday' ? previous : (low + high) / 2;
  const spread = Math.max(high - center, center - low, center * 0.005) * 1.1;
  const min = Math.max(0, center - spread);
  const max = center + spread;
  const y = (value) => 178 - (value - min) / (max - min) * 150;
  const sessionLength = current?.market === 'cn' ? 240 : current?.market === 'hk' ? 330 : 390;
  const x = (index) => 44 + (mode === 'intraday' ? tradingMinute(points[index].time, current.market) / sessionLength : index / Math.max(1, points.length - 1)) * 310;
  const maxVolume = Math.max(1, ...points.map((item) => item.volume || 0));
  const candleWidth = Math.max(2, Math.min(8, 240 / Math.max(1, points.length)));
  const path = (key) => points.map((item, index) => item[key] == null ? '' : `${index === 0 || points[index - 1][key] == null ? 'M' : 'L'}${x(index)},${y(item[key])}`).join(' ');
  const hasAverage = mode === 'intraday' && points.some((item) => item.avgPrice > 0);
  const timeLabels = !points.length ? [] : mode === 'daily'
    ? [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter((index) => index >= 0).map((index) => ({ x: x(index), label: points[index].date.slice(5).replace('-', '/') }))
    : (current?.market === 'cn' ? [[44, '09:30'], [199, '11:30/13:00'], [354, '15:00']] : current?.market === 'hk' ? [[44, '09:30'], [185, '12:00/13:00'], [354, '16:00']] : [[44, '09:30'], [199, '12:45'], [354, '16:00']]).map(([position, label]) => ({ x: position, label }));

  function inspect(event) {
    if (!points.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const location = (event.clientX - rect.left) / rect.width * 400;
    const nearest = points.reduce((best, item, index) => Math.abs(x(index) - location) < Math.abs(x(best) - location) ? index : best, 0);
    setSelected(nearest);
  }

  return (
    <div className="stock-price-plot">
      <div className="stock-chart-quote">
        <div><strong className={`stock-${tone}`}>{quote.currency || ''}{priceText(point?.price)}</strong><span className={`stock-${tone}`}>{change == null ? '涨跌幅待更新' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}</span></div>
        <button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading}>{loading ? '加载中…' : '刷新走势'}</button>
      </div>
      {point && <div className="stock-chart-readout" aria-live="polite"><time>{point.date} {mode === 'intraday' ? point.time : ''}</time>{mode === 'daily' ? <span>开 {priceText(point.open)} · 高 {priceText(point.high)} · 低 {priceText(point.low)} · 收 {priceText(point.price)}</span> : <span>价格 {priceText(point.price)}{point.avgPrice ? ` · 均价 ${priceText(point.avgPrice)}` : ''}</span>}<span>成交量 {volumeText(point.volume)}{current.volumeUnit}</span></div>}
      {error && <p className="stock-chart-error" role="status">{error}{current ? ' 当前保留上次走势。' : ''}</p>}
      {!points.length ? <div className="stock-chart-empty">{loading ? '正在读取真实走势数据…' : '暂时没有可用走势，可点击“刷新走势”重试。'}</div> : <>
        <div className="stock-chart-legend"><span>{mode === 'intraday' && <i className="stock-price-key" />}{mode === 'daily' ? '红涨绿跌' : '价格'}</span>{hasAverage && <span><i className="stock-average-key" />均价</span>}{mode === 'intraday' && previous > 0 && <span>昨收 {priceText(previous)}</span>}<span>成交量（{current.volumeUnit}）</span></div>
        <svg className="stock-chart-svg" viewBox="0 0 400 270" role="img" tabIndex={0} aria-label={`${quote.name} ${mode === 'daily' ? '日 K' : '分时'}走势图，可用左右方向键查看数据`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); inspect(event); }} onPointerMove={inspect} onPointerLeave={(event) => { if (event.pointerType === 'mouse') setSelected(null); }} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setSelected(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, active + (event.key === 'ArrowLeft' ? -1 : 1)))); } }}>
          {Array.from({ length: 5 }, (_, index) => {
            const value = max - (max - min) * index / 4;
            const percent = previous > 0 ? (value / previous - 1) * 100 : null;
            return <g key={index}><line className="stock-gridline" x1="44" x2="354" y1={y(value)} y2={y(value)} /><text className="stock-axis" x="39" y={y(value) + 4} textAnchor="end">{value.toFixed(2)}</text>{mode === 'intraday' && percent != null && <text className={percent > 0 ? 'stock-rise' : percent < 0 ? 'stock-fall' : 'stock-axis'} x="359" y={y(value) + 4}>{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</text>}</g>;
          })}
          {mode === 'intraday' ? <><path className="stock-price-line" d={path('price')} />{hasAverage && <path className="stock-average-line" d={path('avgPrice')} />}{previous > 0 && <line className="stock-previous-line" x1="44" x2="354" y1={y(previous)} y2={y(previous)} />}</> : points.map((item, index) => <g key={item.date} className={item.price >= item.open ? 'stock-rise' : 'stock-fall'}><line x1={x(index)} x2={x(index)} y1={y(item.high)} y2={y(item.low)} stroke="currentColor" /><rect x={x(index) - candleWidth / 2} y={Math.min(y(item.open), y(item.price))} width={candleWidth} height={Math.max(1, Math.abs(y(item.open) - y(item.price)))} fill="currentColor" /></g>)}
          <line className="stock-gridline" x1="44" x2="354" y1="195" y2="195" />
          <text className="stock-axis" x="44" y="207">成交量</text>
          {points.map((item, index) => item.volume != null && <rect key={`${item.date}-${item.time}`} className={item.price >= (mode === 'daily' ? item.open : points[index - 1]?.price || item.price) ? 'stock-rise' : 'stock-fall'} x={x(index) - candleWidth / 2} y={242 - item.volume / maxVolume * 30} width={mode === 'daily' ? candleWidth : 1} height={item.volume / maxVolume * 30} fill="currentColor" />)}
          {timeLabels.map((item) => <text className="stock-axis" key={item.label} x={item.x} y="261" textAnchor={item.x === 44 ? 'start' : item.x === 354 ? 'end' : 'middle'}>{item.label}</text>)}
          {selected != null && point && <g><line className="stock-crosshair" x1={x(active)} x2={x(active)} y1="24" y2="244" /><line className="stock-crosshair" x1="44" x2="354" y1={y(point.price)} y2={y(point.price)} /><circle className="stock-inspect-point" cx={x(active)} cy={y(point.price)} r="3" /></g>}
        </svg>
        {mode === 'daily' && <p className="stock-chart-hint">鼠标移动或手指横向拖动看价格；键盘可用左右方向键。</p>}
        {mode === 'daily' && <p className="stock-chart-source">{current.source} · 数据日期 {current.date}{current.market === 'us' ? ' · 时间为美东时间' : ''} · 不复权价格，成交量按源数据展示</p>}
      </>}
    </div>
  );
}
