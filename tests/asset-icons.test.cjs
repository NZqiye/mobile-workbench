const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const catalogSource = fs.readFileSync(path.join(root, "lib/thiings-icons.js"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "app/page.jsx"), "utf8");
const iconContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "lib/thiings-icon-additions.js"), "utf8").replaceAll("export const", "var"), iconContext);
vm.runInContext(catalogSource.replace(/^import .*;$/gm, "").replaceAll("export const", "var"), iconContext);
const categories = iconContext.thiingsIconCategories;
const pairs = JSON.parse(catalogSource.match(/Object.fromEntries\((.*)\);/)[1]);
const icons = iconContext.thiingsIconByKey;

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
  assert.equal(pairs.length + iconContext.thiingsIconAdditions.length, Object.keys(icons).length, "icon mapping keys must be unique");
  for (const category of categories) {
    assert.equal(new Set(category.icons).size, category.icons.length);
    for (const key of category.icons) assert.ok(icons[key], `${key} must resolve`);
  }
});

test("common shortcuts resolve to real asset categories and camping has its own category", () => {
  const context = vm.createContext({ thiingsIconCategories: categories, thiingsIconLabels: iconContext.thiingsIconLabels });
  const start = pageSource.indexOf("const assetIconCategories =");
  const end = pageSource.indexOf("function AssetBoard", start);
  vm.runInContext(pageSource.slice(start, end), context);
  assert.equal(context.assetCategory({ category: "常用图标", icon: "thiings:laptop" }), "数码科技");
  assert.equal(context.assetCategory({ category: "常用图标", icon: "thiings:camp-chair" }), "户外露营");
  assert.equal(context.assetCategory({ category: "家居日用", icon: "thiings:camp-chair" }), "家居日用");
  assert.equal(context.assetCategory({ icon: "thiings:sleeping-bag" }), "户外露营");
  assert.equal(context.assetCategory({ icon: "thiings:credit-card" }), "财务办公");
  assert.equal(context.assetCategory({ icon: "thiings:payroll-check" }), "财务办公");
  assert.match(context.assetIconLabel("thiings:payroll-check"), /发薪日/);
  assert.match(context.assetIconLabel("thiings:dental-floss"), /牙线/);
});

test("additions keep existing categories and Chinese names with distinct compact images", async () => {
  assert.deepEqual(Array.from(categories, category => category.id), ["digital", "home", "food", "fashion", "sport", "outdoor", "leisure", "finance", "health"]);
  const hashes = new Set();
  for (const icon of iconContext.thiingsIconAdditions) {
    assert.match(icon.label, /[\u4e00-\u9fff]/);
    assert.ok(categories.find(category => category.id === icon.category).icons.includes(`thiings:${icon.slug}`));
    const file = path.join(root, "public", icon.image);
    const metadata = await sharp(file).metadata();
    assert.ok(metadata.width <= 144 && metadata.height <= 144 && metadata.hasAlpha);
    const hash = require("node:crypto").createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    assert.ok(!hashes.has(hash), icon.slug + " duplicates another new image");
    hashes.add(hash);
  }
});
