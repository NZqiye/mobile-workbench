const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib/stock-chart.js'), 'utf8').replaceAll('export function', 'function'), context);
const { tradingMinute, normalizeStockChart, stockChartMarket } = context;

test('market symbols are restricted to the supported markets', () => {
  assert.equal(stockChartMarket('sh603629'), 'cn');
  assert.equal(stockChartMarket('hk00700'), 'hk');
  assert.equal(stockChartMarket('gb_aapl'), 'us');
  assert.equal(stockChartMarket('hf_GC'), 'gold');
  assert.equal(stockChartMarket('https://example.com'), null);
});

test('intraday axes omit lunch breaks and reject non-trading minutes', () => {
  assert.equal(tradingMinute('09:30', 'cn'), 0);
  assert.equal(tradingMinute('11:30', 'cn'), tradingMinute('13:00', 'cn'));
  assert.equal(tradingMinute('12:30', 'cn'), null);
  assert.equal(tradingMinute('15:30', 'cn'), null);
  assert.equal(tradingMinute('15:00', 'cn'), 240);
  assert.equal(tradingMinute('16:00', 'hk'), 330);
  assert.equal(tradingMinute('16:00', 'us'), 390);
});

test('Tencent cumulative volume becomes minute volume and compact dates are normalized', () => {
  const value = normalizeStockChart({ date: '20261106', preClose: 10, data: [
    { time: '09:30', price: 9.8, avgPrice: 9.8, volume: 100 },
    { time: '09:31', price: 9.9, avgPrice: 9.85, volume: 150 },
    { time: '15:30', price: 10.1, volume: 300 },
  ] }, 'cn', 'intraday');
  assert.equal(value.date, '2026-11-06');
  assert.equal(value.previousClose, 10);
  assert.deepEqual(Array.from(value.points, (point) => point.volume), [100, 50]);
});

test('US timeline uses the preceding close for its own trading date', () => {
  const value = normalizeStockChart([
    { time: '2026-11-04 16:00', close: 99, volume: 20 },
    { time: '2026-11-05 09:30', close: 100, volume: 50 },
    { time: '2026-11-05 09:31', close: 101, volume: 70 },
  ], 'us', 'intraday', [{ date: '2026-11-04', close: 98 }, { date: '2026-11-05', close: 101 }, { date: '2026-11-06', close: 102 }]);
  assert.equal(value.previousClose, 98);
  assert.equal(value.date, '2026-11-05');
  assert.equal(value.timezone, 'America/New_York');
  assert.deepEqual(Array.from(value.points, (point) => point.volume), [50, 70]);
});

test('null prices are omitted without invented zero points; duplicate minutes use the latest quote', () => {
  const value = normalizeStockChart({ date: '20261106', data: [{ time: '09:30', price: null }, { time: '09:31', price: 10, volume: 100 }, { time: '09:31', price: 11, volume: 120 }] }, 'cn', 'intraday');
  assert.equal(value.points.length, 1);
  assert.equal(value.points[0].price, 11);
  assert.equal(value.previousClose, null);
});

test('A-share daily volume is converted from lots to shares and OHLC is preserved', () => {
  const value = normalizeStockChart([{ date: '2026-11-06', open: 10, high: 12, low: 9, close: 11, volume: 80, changePercent: -2.5 }], 'cn', 'daily');
  assert.equal(value.points[0].volume, 8000);
  assert.equal(value.points[0].open, 10);
  assert.equal(value.points[0].high, 12);
  assert.equal(value.points[0].low, 9);
  assert.equal(value.points[0].price, 11);
  assert.equal(value.volumeUnit, '股');
  assert.equal(value.points[0].changePercent, -2.5);
});
