const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const catalogSource = fs.readFileSync(path.join(root, "lib/thiings-icons.js"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "app/page.jsx"), "utf8");
const categories = JSON.parse(catalogSource.match(/thiingsIconCategories = (.*);/)[1]);
const pairs = JSON.parse(catalogSource.match(/Object.fromEntries\((.*)\);/)[1]);
const icons = Object.fromEntries(pairs);

test("every selectable and legacy asset icon resolves to a decodable local image", async () => {
  const paths = new Set(Object.values(icons));
  const legacy = pageSource.slice(pageSource.indexOf("const assetIconImageMap"), pageSource.indexOf("const subscriptionIconCategories"));
  for (const match of legacy.matchAll(/"(\/assets-icons\/[^\"]+)"/g)) paths.add(match[1]);
  const subscriptions = pageSource.slice(pageSource.indexOf("const subscriptionIconCategories"), pageSource.indexOf("const subscriptionIconByKey"));
  const subscriptionKeys = [...subscriptions.matchAll(/"thiings-subscribe:([^\"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(subscriptionKeys).size, subscriptionKeys.length, "subscription icons must not repeat");
  for (const key of subscriptionKeys) paths.add(`/assets-icons/thiings/subscribe/${key}.webp`);
  const failures = [];
  for (const url of paths) {
    try {
      await sharp(path.join(root, "public", url)).raw().toBuffer();
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.equal(pairs.length, Object.keys(icons).length, "icon mapping keys must be unique");
  for (const category of categories) {
    assert.equal(new Set(category.icons).size, category.icons.length);
    for (const key of category.icons) assert.ok(icons[key], `${key} must resolve`);
  }
});

test("common shortcuts resolve to real asset categories and camping has its own category", () => {
  const context = vm.createContext({ thiingsIconCategories: categories });
  const start = pageSource.indexOf("const assetIconCategories =");
  const end = pageSource.indexOf("function AssetBoard", start);
  vm.runInContext(pageSource.slice(start, end), context);
  assert.equal(context.assetCategory({ category: "常用图标", icon: "thiings:laptop" }), "数码科技");
  assert.equal(context.assetCategory({ category: "常用图标", icon: "thiings:camp-chair" }), "户外露营");
  assert.equal(context.assetCategory({ category: "家居日用", icon: "thiings:camp-chair" }), "家居日用");
  assert.equal(context.assetCategory({ icon: "thiings:sleeping-bag" }), "户外露营");
  assert.equal(context.assetCategory({ icon: "thiings:credit-card" }), "财务办公");
});
