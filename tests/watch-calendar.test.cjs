const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");
const context = vm.createContext({});
const functions = ["hasChineseText", "mediaTitle", "tmdbMediaType", "tmdbItemKey", "consultationKey", "normalizeSeriesTitle", "watchStatsKey", "countUniqueWatchItems", "dayUpdateSummary"];
for (const name of functions) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in page.jsx`);
  vm.runInContext(source.slice(start, source.indexOf("\n}", start) + 2), context);
}

for (const [shows, level] of [[0, "none"], [1, "low"], [2, "medium"], [4, "medium"], [5, "high"]]) {
  test(`${shows} updating shows use the ${level} calendar indicator`, () => {
    const entries = Array.from({ length: shows }, (_, index) => ({ id: `show-${index}`, title: `Show ${index}`, updateEpisode: 1 }));
    assert.deepEqual({ ...context.dayUpdateSummary(entries) }, { shows, episodes: shows, level });
  });
}

test("six episodes released by one show still use a green indicator", async () => {
  const { watchEntriesForDate } = await import("../lib/watch-schedule.js");
  const entries = watchEntriesForDate([{ id: "one", title: "One show", nextAirDate: "2026-11-26", updateEpisodes: "1-6" }], "2026-11-26");
  assert.deepEqual({ ...context.dayUpdateSummary(entries) }, { shows: 1, episodes: 6, level: "low" });
});

test("separate season records for the same series count as one updating show", () => {
  const entries = [
    { id: "season-1", title: "Example Season 1", updateEpisode: 5 },
    { id: "season-2", title: "Example Season 2", updateEpisode: 1 },
    { id: "other", title: "Another show", updateEpisode: 1 },
  ];
  assert.deepEqual({ ...context.dayUpdateSummary(entries) }, { shows: 2, episodes: 3, level: "medium" });
});
