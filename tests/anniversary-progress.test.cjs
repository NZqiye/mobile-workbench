const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/anniversary-progress.js"), "utf8").replace("export function", "function"), context);
const progress = context.anniversaryProgress;

test("countdown progress uses the actual start and target dates", () => {
  const item = { type: "countdown", startDate: "2026-10-21" };
  const value = progress(item, "2026-11-27", "2026-10-31");
  assert.equal(value.total, 37);
  assert.equal(value.elapsed, 10);
  assert.equal(value.percent, 27);
  assert.equal(progress(item, "2026-11-27", "2026-11-27").percent, 100);
  assert.equal(progress(item, "2026-11-27", "2026-12-01").elapsed, 37);
});

test("legacy countdowns and unsupported lunar cycles do not invent percentages", () => {
  assert.equal(progress({ type: "countdown" }, "2026-11-27", "2026-10-31"), null);
  assert.equal(progress({ type: "birthday", calendarType: "lunar" }, "2026-11-27", "2026-10-31"), null);
  assert.equal(progress({ type: "countdown", startDate: "2026-12-01" }, "2026-11-27", "2026-10-31"), null);
  assert.equal(progress({ type: "countdown", startDate: "2026-11-01" }, "2026-11-27", "2026-10-31"), null);
});

test("annual solar dates use their actual cycle, including leap years", () => {
  const value = progress({ type: "birthday", date: "2000-03-01" }, "2024-03-01", "2024-02-29");
  assert.equal(value.total, 366);
  assert.equal(value.elapsed, 365);
  assert.equal(progress({ type: "memory" }, "", "2026-10-31"), null);
});
