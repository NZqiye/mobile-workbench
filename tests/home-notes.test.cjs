const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  const indent = source.slice(source.lastIndexOf("\n", start) + 1, start).match(/^\s*/)[0];
  const end = `\n${indent}}`;
  return source.slice(start, source.indexOf(end, start) + end.length);
}

function capture(title, fails = false) {
  const saved = [], statuses = [], states = [];
  const input = { value: title };
  const context = vm.createContext({
    notes: [{ id: "old", type: "life", title: "previous idea", tags: ["闪念"] }],
    crypto: { randomUUID: () => "new" }, todayKey: () => "2026-11-07", nowText: () => "18:30",
    persist: (name, value) => { if (fails) throw new Error("Storage full"); saved.push({ name, value }); },
    setNotes: value => states.push(value), setQuickNoteStatus: value => statuses.push(value),
    rewardPetOnce: () => {},
  });
  vm.runInContext(functionSource("addQuickNote"), context);
  context.addQuickNote({ preventDefault() {}, currentTarget: { elements: { note: input } } });
  return { saved, statuses, states, input };
}

test("Enter saves an idea to notes, keeps old ideas, and confirms the destination", () => {
  const result = capture("  a new idea  ");
  assert.equal(result.saved[0].name, "notes");
  assert.equal(result.saved[0].value[0].title, "a new idea");
  assert.equal(result.saved[0].value[0].type, "idea");
  assert.equal(result.saved[0].value[1].id, "old");
  assert.equal(result.states.length, 1);
  assert.equal(result.input.value, "");
  assert.match(result.statuses[0], /本机.*想法笔记/);
});

test("failed local persistence retains the draft and does not pretend it was saved", () => {
  const result = capture("keep this idea", true);
  assert.equal(result.input.value, "keep this idea");
  assert.equal(result.states.length, 0);
  assert.match(result.statuses[0], /保存失败.*重试/);
  assert.equal(capture("   ").saved.length, 0);
});

test("missing air time is hidden and Sci-Fi tags are filtered without changing source data", () => {
  const context = vm.createContext({});
  vm.runInContext(["visibleMediaTags", "hasLiveClock"].map(functionSource).join("\n"), context);
  for (const value of [undefined, "", "--:--", "--:--:--"]) assert.equal(context.hasLiveClock(value), false);
  assert.equal(context.hasLiveClock("20:30"), true);
  const tags = ["动画", "Sci-Fi & Fantasy", "Sci-Fi", "sci fi", "动作冒险"];
  assert.deepEqual(Array.from(context.visibleMediaTags(tags)), ["动画", "动作冒险"]);
  assert.equal(tags.length, 5);
});
