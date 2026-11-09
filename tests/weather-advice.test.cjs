const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/page.jsx'), 'utf8');
const context = vm.createContext({ Date });
for (const name of ['weatherLabel', 'toDateKey', 'outfitAdvice', 'tomorrowWeatherAdvice']) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}
const day = (date, min = 15, max = 23, code = 0, rain = 0) => ({ date, min, max, code, rain });

test('tomorrow advice uses the actual calendar date, including year boundaries and unordered cached days', () => {
  const advice = context.tomorrowWeatherAdvice({ forecast: [day('2027-01-02'), day('2027-01-01', 3, 8), day('2026-12-31')] }, '2026-12-31');
  assert.equal(advice.date, '2027-01-01');
  assert.match(advice.outfit.items.join(' '), /羽绒服|厚外套/);
  assert.equal(context.tomorrowWeatherAdvice({ forecast: [day('2026-11-07'), day('2026-11-08')] }, '2026-11-09'), null);
});

test('cooling and rain reminders use forecast temperature differences and rain probability', () => {
  const advice = context.tomorrowWeatherAdvice({ forecast: [day('2026-11-09', 15, 23), day('2026-11-10', 9, 16, 3, 70)] }, '2026-11-09');
  assert.match(advice.alerts.join(' '), /降温约 7°/);
  assert.match(advice.alerts.join(' '), /带伞/);
  assert.match(advice.outfit.items.join(' '), /卫衣|毛衣/);
});

test('rain codes, snow and thunder provide reminders even when probability is missing or low', () => {
  for (const [code, message] of [[61, /带伞/], [95, /雷雨/], [71, /路滑/]]) {
    const advice = context.tomorrowWeatherAdvice({ forecast: [day('2026-11-10', 8, 14, code, null)] }, '2026-11-09');
    assert.match(advice.alerts.join(' '), message);
    assert.match(advice.outfit.note, /降水概率暂缺/);
  }
});

test('missing temperatures do not turn into a made-up winter forecast; warmer days do not show cooling alerts', () => {
  for (const missing of [undefined, null, NaN, 'bad']) {
    assert.equal(context.tomorrowWeatherAdvice({ forecast: [{ ...day('2026-11-10'), min: missing }] }, '2026-11-09'), null);
  }
  const advice = context.tomorrowWeatherAdvice({ forecast: [day('2026-11-09', 15, 23), day('2026-11-10', 18, 28)] }, '2026-11-09');
  assert.equal(advice.alerts.length, 0);
  assert.match(advice.outfit.items.join(' '), /短袖/);
});

test('outfit row labels match the recommended clothes across temperature ranges', () => {
  for (const [max, labels] of [[34, ['上装', '下装', '防晒']], [28, ['上装', '下装', '鞋履']], [23, ['内搭', '外套', '下装']], [13.5, ['内搭', '外套', '下装']], [7, ['内搭', '外套', '搭配']]]) {
    const advice = context.outfitAdvice(day('2026-11-10', 6.5, max), '明天');
    assert.deepEqual(Array.from(advice.labels), labels);
    assert.equal(advice.items.slice(0, 3).length, labels.length);
  }
});
