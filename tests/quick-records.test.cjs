const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({ Intl, Date });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/quick-records.js"), "utf8").replace(/export /g, ""), context);
const now = new Date("2026-11-04T01:00:00Z");
const parse = (text, date = now) => JSON.parse(JSON.stringify(context.parseQuickRecords(text, date)));

test("offline parsing warns about other record types instead of silently dropping them", () => {
  const result = parse("喝了一杯水，今天体重65公斤");
  assert.equal(result.records.length, 1);
  assert.match(result.issues[0], /体重65公斤.*在线/);
});

test("one utterance records a timed cup of water and an unclassified 30-minute exercise without invented calories", () => {
  const result = parse("我今天早上9点半喝了一杯水，晚上运动了半个小时");
  assert.equal(result.issues.length, 0);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0].value, { type: "water", cups: 1, amount: 250, date: "2026-11-04", time: "09:30" });
  assert.deepEqual(result.records[1].value, { type: "activity", label: "运动", duration: 30, calories: null, date: "2026-11-04", time: "晚上" });
});

test("a period change splits speech even without a comma", () => {
  const result = parse("今天早上9点喝了一杯水晚上健身半小时");
  assert.equal(result.records.length, 2);
  assert.equal(result.records[1].value.type, "gym");
});

test("relative dates use Shanghai time, including just after midnight", () => {
  const result = parse("昨天喝了两杯水，晚上8点健身半小时", new Date("2026-11-03T16:10:00Z"));
  assert.equal(result.records[0].value.date, "2026-11-03");
  assert.equal(result.records[0].value.amount, 500);
  assert.equal(result.records[0].value.time, "");
  assert.equal(result.records[1].value.date, "2026-11-03");
  assert.equal(result.records[1].value.time, "20:00");
});

test("volume units, half cups, Chinese numbers and mixed exercise units are preserved", () => {
  assert.equal(parse("喝了三百毫升水").records[0].value.amount, 300);
  assert.equal(parse("喝了1.5升水").records[0].value.amount, 1500);
  assert.equal(parse("喝了半杯水").records[0].value.amount, 125);
  assert.equal(parse("喝了一杯半水").records[0].value.amount, 375);
  assert.equal(parse("健身一个半小时").records[0].value.duration, 90);
  assert.equal(parse("跑步一小时半").records[0].value.duration, 90);
  assert.equal(parse("跑步一小时三十分钟").records[0].value.duration, 90);
});

test("ambiguous clock values remain unsaved instead of guessing morning", () => {
  const result = parse("今天9点半喝了一杯水");
  assert.equal(result.records.length, 0);
  assert.match(result.issues[0], /早晚/);
  assert.equal(parse("今天21:30喝了一杯水").records[0].value.time, "21:30");
});

test("negations, future plans and cancellation are not stored as completed events", () => {
  for (const text of ["我没有喝一杯水", "我还没运动半小时", "晚上打算跑步30分钟", "明天喝两杯水", "不要记录喝两杯水", "取消昨天健身30分钟", "我想喝一杯水", "待会健身30分钟", "今天不跑步30分钟", "我要跑步30分钟", "下周跑步30分钟", "明年11月3日跑步30分钟"]) {
    assert.equal(parse(text).records.length, 0, text);
  }
});

test("Chinese dates preserve explicit years; unsupported relative dates are not silently assigned to today", () => {
  assert.equal(parse("2025年11月3日跑步30分钟").records[0].value.date, "2025-11-03");
  assert.equal(parse("2027年11月3日跑步30分钟").records.length, 0);
  for (const text of ["上周跑步30分钟", "三小时前跑步半小时", "去年11月3日跑步30分钟"]) {
    assert.equal(parse(text).records.length, 0, text);
    assert.ok(parse(text).issues.length, text);
  }
});

test("noon and midnight are distinguished", () => {
  assert.equal(parse("今天上午十二点喝一杯水").records[0].value.time, "12:00");
  assert.equal(parse("今天凌晨十二点喝一杯水").records[0].value.time, "00:00");
  assert.equal(parse("今天晚上十二点喝一杯水").records[0].value.time, "00:00");
});

test("missing quantities and invalid dates or times remain unsaved", () => {
  for (const text of ["喝了一瓶水", "今天运动了", "2026-02-30喝了一杯水", "2027-01-01喝了一杯水", "今天25:00喝了一杯水", "喝了0杯水"]) {
    const result = parse(text);
    assert.equal(result.records.length, 0, text);
    assert.ok(result.issues.length, text);
  }
});

test("multiple water records are retained and valid records survive alongside incomplete ones", () => {
  const result = parse("上午8点喝一杯水，上午10点喝一杯水，健身");
  assert.equal(result.records.length, 2);
  assert.equal(result.issues.length, 1);
});
