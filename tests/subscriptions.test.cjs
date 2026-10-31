const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/subscriptions.js"), "utf8").replace("export function", "function"), context);

test("upcoming subscriptions include today through 30 days and exclude permanent, expired and undated records", () => {
  const items = [
    { id: "later", endDate: "2026-11-30" },
    { id: "today", endDate: "2026-10-31" },
    { id: "soon", endDate: "2026-11-02" },
    { id: "expired", endDate: "2026-10-30" },
    { id: "distant", endDate: "2026-12-01" },
    { id: "permanent", endDate: "2026-11-01", purchaseType: "永久会员" },
    { id: "undated" },
  ];
  const result = context.upcomingSubscriptions(items, "2026-10-31");
  assert.equal(result.map((item) => item.id).join(","), "today,soon,later");
  assert.equal(result.map((item) => item.daysRemaining).join(","), "0,2,30");
});
