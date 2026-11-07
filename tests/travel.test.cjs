const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const travel = {};
vm.createContext(travel);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/travel.js"), "utf8").replaceAll("export function", "function"), travel);
const source = fs.readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");
function iconContext() {
  const context = vm.createContext({});
  const data = ["travel-icons.js", "travel-places.js"].map((file) => fs.readFileSync(path.join(__dirname, "../lib", file), "utf8").replace(/^import .*;\n/gm, "").replaceAll("export const", "const").replaceAll("export function", "function"));
  vm.runInContext(`${data.join("\n")}\nthis.cities = travelCities; this.icons = travelIcons;`, context);
  return context;
}
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

test("city check-ins keep personal reviews, validate ratings and stay inside trip dates", () => {
  const trip = { destination: "上海周末", city: "上海", startDate: "2026-11-01", endDate: "2026-11-03", checkins: [{ id: "spot-1", name: " 外滩 ", date: "2026-11-02", rating: 4, review: " 夜景不错 " }] };
  const result = travel.normalizeTravelRecord(trip);
  assert.equal(result.city, "上海");
  assert.equal(result.checkins[0].name, "外滩");
  assert.equal(result.checkins[0].review, "夜景不错");
  assert.equal(result.checkins[0].id, "spot-1");
  assert.equal(travel.normalizeTravelRecord({ ...trip, checkins: [{ ...trip.checkins[0], rating: null }] }).checkins[0].rating, null);
  assert.equal(travel.normalizeTravelRecord({ ...trip, checkins: undefined }).checkins.length, 0);
  for (const override of [{ name: " " }, { rating: 6 }, { rating: 0 }, { rating: 2.5 }, { date: "2026-11-04" }, { date: "2026-02-30" }]) {
    assert.throws(() => travel.normalizeTravelRecord({ ...trip, checkins: [{ ...trip.checkins[0], ...override }] }));
  }
});

test("preset cities have unique attraction shortcuts and valid local illustrations", async () => {
  const context = iconContext();
  const sharp = require("sharp");
  assert.equal(new Set(context.cities.map((city) => city.name)).size, context.cities.length);
  const images = new Set();
  for (const city of context.cities) {
    assert.equal(new Set(city.places).size, city.places.length);
    images.add(context.travelCityImage(city.name));
  }
  images.add(context.travelPlaceImage("北京", "八达岭长城"));
  images.add(context.travelCityImage("自定义城市"));
  for (const image of images) await sharp(path.join(__dirname, "../public", image)).raw().toBuffer();
  assert.equal(context.travelCityImage("自定义城市"), "/assets-icons/thiings/fashion/suitcase.webp");
});

test("selected trip and check-in icons survive saving and can return to automatic matching", () => {
  const trip = { destination: "杭州周末", city: "杭州", startDate: "2026-11-01", endDate: "2026-11-03", icon: "tea-plantation", checkins: [{ id: "spot-1", name: "西湖", date: "2026-11-02", icon: "sailboat" }] };
  const saved = travel.normalizeTravelRecord(trip);
  assert.equal(saved.icon, "tea-plantation");
  assert.equal(saved.checkins[0].icon, "sailboat");
  const automatic = travel.normalizeTravelRecord({ ...saved, icon: "", checkins: [{ ...saved.checkins[0], icon: "" }] });
  assert.equal(automatic.icon, "");
  assert.equal(automatic.checkins[0].icon, "");
  const legacy = travel.normalizeTravelRecord({ ...trip, icon: undefined, checkins: [{ ...trip.checkins[0], icon: undefined }] });
  assert.equal(legacy.icon, "");
  assert.equal(legacy.checkins[0].icon, "");
});

test("specific landmarks and scenery match correctly while a selected icon takes priority", () => {
  const context = iconContext();
  const expected = (id) => `/assets-icons/thiings/travel/${id}.webp`;
  assert.equal(context.travelCityImage(" 杭州 "), expected("alpine-lake"));
  assert.equal(context.travelCityImage("巴黎"), expected("paris-france"));
  assert.equal(context.travelCityImage("杭州", "tea-plantation"), expected("tea-plantation"));
  assert.equal(context.travelCityImage("杭州", "../../invalid"), expected("alpine-lake"));
  for (const [name, id] of [["八达岭长城", "great-wall-of-china"], ["富士山", "mount-fuji"], ["布达拉宫", "potala-palace"], ["清水寺", "kiyomizu-dera"], ["埃菲尔铁塔", "eiffel-tower"], ["伦敦塔桥", "london-bridge"], ["西湖", "alpine-lake"], ["灵隐寺", "pagoda"], ["苏州博物馆", "museum"], ["鼓浪屿", "island"], ["上海迪士尼乐园", "theme-park"], ["长江索道", "cableway"], ["广州塔", "skyline"]]) {
    assert.equal(context.travelPlaceImage("自定义城市", name), expected(id), name);
  }
  assert.equal(context.travelPlaceImage("杭州", "西湖", "sailboat"), expected("sailboat"));
  assert.equal(context.travelPlaceImage("杭州", "西湖", "missing"), expected("alpine-lake"));
  assert.equal(context.travelPlaceImage("无锡", "灵山胜境"), expected("pagoda"));
  assert.equal(context.travelPlaceImage("沈阳", "故宫"), expected("palace"));
  assert.equal(context.travelIconImage("missing"), "");
});

test("all 72 travel choices have real, transparent local illustrations", async () => {
  const context = iconContext();
  const sharp = require("sharp");
  assert.equal(context.icons.length, 72);
  assert.equal(new Set(context.icons.map((icon) => icon.id)).size, context.icons.length);
  for (const icon of context.icons) {
    const image = sharp(path.join(__dirname, "../public", context.travelIconImage(icon.id)));
    assert.equal((await image.metadata()).hasAlpha, true, icon.id);
    await image.raw().toBuffer();
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
  assert.match(functionSource("exportMarkdown"), /\n\s+travelRecords,/);
  assert.match(functionSource("importBackup"), /persist\("travelRecords", payload.travelRecords\)/);
  assert.match(functionSource("exportMarkdown"), /travelRecords.map/);
});
