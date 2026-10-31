const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/anniversary-icons.js"), "utf8").replaceAll("export const", "var").replaceAll("export function", "function"), context);

test("date icon library covers requested occasions with unique IDs and decodable local assets", async () => {
  const sharp = require("sharp");
  const icons = context.anniversaryIcons;
  assert.equal(new Set(icons.map((icon) => icon.id)).size, icons.length);
  for (const id of ["wedding", "birthday", "memorial", "defense", "promotion", "travel"]) assert.ok(icons.some((icon) => icon.id === id));
  for (const icon of icons) {
    assert.ok(context.anniversaryIconGroups.includes(icon.group));
    await sharp(path.join(__dirname, "../public", icon.image)).raw().toBuffer();
  }
});

test("saved icon wins over category defaults and legacy or unknown icons still render", () => {
  assert.equal(context.anniversaryIcon({ type: "birthday" }).id, "birthday");
  assert.equal(context.anniversaryIcon({ type: "countdown", icon: "travel" }).id, "travel");
  assert.equal(context.anniversaryIcon({ type: "memory", icon: "missing" }).id, "wedding");
  assert.equal(context.anniversaryIcon({}).id, "wedding");
});

test("Chinese holiday titles get relevant defaults while explicit choices take priority", () => {
  for (const [title, id] of [["2026 春节假期", "spring-festival"], ["元宵节", "lantern-festival"], ["清明节", "qingming"], ["端午节", "dragon-boat"], ["七夕", "qixi"], ["中秋节", "mid-autumn"], ["国庆节", "national-day"], ["重阳节", "double-ninth"], ["冬至", "winter-solstice"], ["元旦", "new-year"]]) {
    assert.equal(context.anniversaryIcon({ type: "festival", title }).id, id);
  }
  assert.equal(context.anniversaryIcon({ type: "festival", title: "中秋节", icon: "dinner" }).id, "dinner");
  assert.equal(context.anniversaryIcon({ type: "festival", title: "其他节日" }).id, "festival");
  for (const id of ["camping", "picnic", "dinner", "barbecue"]) assert.ok(context.anniversaryIcons.some((icon) => icon.id === id));
});

test("changing an existing date icon preserves fields and persists a fresh sync timestamp", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");
  const start = source.indexOf("  function updateAnniversaryIcon(");
  const end = source.indexOf("\n  }", start) + 4;
  const records = [{ id: "a", title: "答辩日", date: "2026-11-01", type: "countdown", calendarType: "solar", updatedAt: 1 }, { id: "b", title: "生日", icon: "birthday" }];
  let saved;
  const state = vm.createContext({ anniversaries: records, anniversaryIcons: context.anniversaryIcons, stampItem: (item) => ({ ...item, updatedAt: 10 }), setAnniversaries: (items) => { saved = items; }, persist: (name, items) => { assert.equal(name, "anniversaries"); assert.equal(items, saved); } });
  vm.runInContext(source.slice(start, end), state);
  state.updateAnniversaryIcon("a", "defense");
  assert.equal(saved[0].icon, "defense");
  assert.equal(saved[0].updatedAt, 10);
  for (const key of ["title", "date", "type", "calendarType"]) assert.equal(saved[0][key], records[0][key]);
  assert.equal(saved[1], records[1]);
});
