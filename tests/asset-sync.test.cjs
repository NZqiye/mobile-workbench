const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in page.jsx`);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

test("asset merge prefers the cloud record when legacy timestamps tie", () => {
  const context = vm.createContext({ Map, Array, Number, crypto: { randomUUID: () => "generated" } });
  vm.runInContext(`${functionSource("itemUpdatedAt")}\n${functionSource("mergeById")}`, context);
  const local = [{ id: "asset-1", icon: "old-icon", updatedAt: 100 }];
  const cloud = [{ id: "asset-1", icon: "new-icon", updatedAt: 100 }];

  assert.equal(context.mergeById(local, cloud, true)[0].icon, "new-icon");
  assert.equal(context.mergeById(local, cloud)[0].icon, "old-icon");
});

test("asset mutations refresh timestamps and record deletions", () => {
  const addAsset = functionSource("addAsset");
  const updateAsset = functionSource("updateAsset");
  const deleteAsset = functionSource("deleteAsset");

  assert.match(addAsset, /const item = stampItem\(\{/);
  assert.match(updateAsset, /stampItem\(\{ \.\.\.item, \.\.\.updates/);
  assert.match(deleteAsset, /markDeleted\("assetRecords", id\)/);
});

test("asset icon clears its failed-load state when the icon changes", () => {
  assert.match(functionSource("AssetIcon"), /useEffect\(\(\) => setErr\(false\), \[name\]\)/);
});

test("subscription records use the same timestamped sync and deletion flow", () => {
  assert.match(source, /subscriptionRecords: mergeSyncedItems\("subscriptionRecords"/);
  assert.match(functionSource("addSubscription"), /stampItem\(\{/);
  assert.match(functionSource("updateSubscription"), /stampItem\(\{ \.\.\.item, \.\.\.updates/);
  assert.match(functionSource("deleteSubscription"), /markDeleted\("subscriptionRecords", id\)/);
});

test("subscription end date is only stored for recurring memberships", () => {
  const component = functionSource("SubscriptionBoard");
  assert.match(component, /billingCycle: purchaseType === "订阅会员" \? billingCycle : ""/);
  assert.match(component, /endDate: purchaseType === "订阅会员" \? endDate : ""/);
  assert.match(component, /purchaseType === "订阅会员" &&/);
});
