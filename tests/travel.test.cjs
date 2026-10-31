const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const travel = {};
vm.createContext(travel);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/travel.js"), "utf8").replaceAll("export function", "function"), travel);
const source = fs.readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  const indent = source.slice(source.lastIndexOf("\n", start) + 1, start).match(/^\s*/)[0];
  const closing = `\n${indent}}`;
  return source.slice(start, source.indexOf(closing, start) + closing.length);
}

test("trip dates are inclusive and statuses change at departure and return boundaries", () => {
  const trip = { startDate: "2026-11-01", endDate: "2026-11-03" };
  assert.equal(travel.travelDays(trip), 3);
  assert.equal(travel.travelDays({ startDate: "2026-11-01" }), 1);
  assert.equal(travel.travelStatus(trip, "2026-10-31"), "待出发");
  assert.equal(travel.travelStatus(trip, "2026-11-01"), "旅途中");
  assert.equal(travel.travelStatus(trip, "2026-11-03"), "旅途中");
  assert.equal(travel.travelStatus(trip, "2026-11-04"), "已结束");
  assert.equal(travel.travelDays({ startDate: "2028-02-28", endDate: "2028-03-01" }), 3);
});

test("travel validation distinguishes unknown cost from zero and rejects invalid ranges", () => {
  const values = { destination: " 杭州 ", startDate: "2026-11-01", endDate: "2026-11-03", cost: "", notes: " 西湖 " };
  assert.equal(travel.normalizeTravelRecord(values).cost, null);
  assert.equal(travel.normalizeTravelRecord({ ...values, cost: "0" }).cost, 0);
  assert.equal(travel.normalizeTravelRecord(values).destination, "杭州");
  for (const override of [{ destination: " " }, { endDate: "2026-10-30" }, { startDate: "2026-02-30" }, { cost: "-1" }, { cost: "NaN" }]) {
    assert.throws(() => travel.normalizeTravelRecord({ ...values, ...override }));
  }
});

test("travel mutations persist timestamps and deleted records stay deleted after merging", () => {
  let records = [];
  const removed = new Set();
  const context = vm.createContext({ crypto: { randomUUID: () => "trip-1" }, stampItem: (item) => ({ ...item, updatedAt: 123 }), setTravelRecords: (items) => { records = items; context.travelRecords = items; }, persist: (name, items) => { assert.equal(name, "travelRecords"); assert.equal(items, records); }, markDeleted: (name, id) => { assert.equal(name, "travelRecords"); removed.add(id); }, travelRecords: records });
  vm.runInContext(["addTravel", "updateTravel", "deleteTravel"].map(functionSource).join("\n"), context);
  context.addTravel({ destination: "杭州" });
  assert.equal(records[0].updatedAt, 123);
  context.updateTravel("trip-1", { notes: "西湖" });
  assert.equal(records[0].notes, "西湖");
  const cloudItems = records;
  context.deleteTravel("trip-1");
  assert.equal(records.length, 0);
  context.mergeDeletedIds = () => [...removed];
  context.mergeById = (local, cloud) => [...local, ...cloud];
  context.itemUpdatedAt = (item) => item.updatedAt;
  vm.runInContext(functionSource("mergeSyncedItems"), context);
  assert.equal(context.mergeSyncedItems("travelRecords", [], cloudItems, {}).length, 0);
});

test("travel is included in startup, both cloud sync flows, backup restore, and export", () => {
  assert.match(source, /travelRecords: mergeSyncedItems\("travelRecords"/);
  assert.match(source, /setTravelRecords\(readStorage\("travelRecords", \[\]\)\)/);
  assert.equal((source.match(/saveCloudItem\(nextSession, "travelRecords", merged.travelRecords\)/g) || []).length, 2);
  assert.match(functionSource("applyCloud"), /setTravelRecords\(cloud.travelRecords\)/);
  assert.match(functionSource("exportBackup"), /\n\s+travelRecords,/);
  assert.match(functionSource("importBackup"), /persist\("travelRecords", payload.travelRecords\)/);
  assert.match(functionSource("exportMarkdown"), /travelRecords.map/);
});
