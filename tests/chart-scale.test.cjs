const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/chart-scale.js"), "utf8").replace("export function", "function"), context);
const scale = context.chartScale;

test("water above the goal stays within the scale and keeps proportional heights", () => {
  const result = scale([0, 500, 2000, 3500], { target: 2000, integer: true });
  assert.equal(result.min, 0);
  assert.ok(result.max >= 3500);
  assert.equal((3500 / result.max) / (2000 / result.max), 1.75);
  assert.ok(result.ticks.includes(0));
});

test("empty charts have finite scales, and the water goal is still visible", () => {
  for (const values of [[], [0, 0, 0], [null, null]]) {
    const result = scale(values);
    assert.ok(Number.isFinite(result.min) && Number.isFinite(result.max));
    assert.ok(result.max > result.min);
  }
  assert.ok(scale([0, 0], { target: 2500 }).max >= 2500);
});

test("weight scale excludes missing days and reveals small real changes", () => {
  const result = scale([null, 65.5, null, 65.2, 65.1], { fromZero: false });
  assert.ok(result.min > 64);
  assert.ok(result.min < 65.1);
  assert.ok(result.max > 65.5);
  assert.ok(result.max - result.min < 2);
});

test("a single or constant weight reading has a usable padded scale", () => {
  for (const values of [[65.5], [65.5, 65.5], [0.01]]) {
    const result = scale(values, { fromZero: false });
    assert.ok(result.min >= 0);
    assert.ok(result.min < values[0] && result.max > values[0]);
  }
});

test("match counts use whole numbers and leave room for stacked totals", () => {
  const result = scale([0, 1, 2, 7], { integer: true });
  assert.equal(result.min, 0);
  assert.ok(result.max >= 7);
  assert.ok(result.ticks.every(Number.isInteger));
});
