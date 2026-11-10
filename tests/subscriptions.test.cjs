const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/subscriptions.js"), "utf8").replaceAll("export function", "function"), context);

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

const phone = (updates = {}) => ({ id: "phone", purchaseType: "手机话费", price: 59, balance: 120, billingDay: 1, purchaseDate: "2026-11-10", ...updates });

test("phone balance covers whole bills, then needs recharge before the first unaffordable bill", () => {
  const projection = context.phoneFeeProjection(phone(), "2026-11-10");
  assert.equal(projection.rechargeDate, "2027-02-01");
  assert.equal(projection.estimatedBalance, 120);
  assert.equal(context.phoneFeeProjection(phone({ balance: 118 }), "2026-11-10").rechargeDate, "2027-02-01");
  assert.equal(context.phoneFeeProjection(phone({ balance: 58.99 }), "2026-11-10").rechargeDate, "2026-12-01");
});

test("estimated balance ages with monthly bills and overdue recharge stays visible", () => {
  assert.equal(context.phoneFeeProjection(phone(), "2026-12-01").estimatedBalance, 61);
  assert.equal(context.phoneFeeProjection(phone(), "2027-01-10").estimatedBalance, 2);
  assert.equal(context.phoneFeeProjection(phone(), "2027-02-02").estimatedBalance, 0);
  assert.equal(context.upcomingSubscriptions([phone()], "2027-02-02")[0].daysRemaining, -1);
  assert.equal(context.upcomingSubscriptions([phone()], "2027-01-10")[0].endDate, "2027-02-01");
  assert.equal(context.upcomingSubscriptions([phone()], "2026-11-10").length, 0);
});

test("31st billing dates clamp to month-end without drifting, including leap years", () => {
  const record = phone({ purchaseDate: "2027-01-31", billingDay: 31, balance: 59 });
  assert.equal(context.phoneFeeProjection(record, "2027-02-28").estimatedBalance, 0);
  assert.equal(context.phoneFeeProjection(record, "2027-02-28").rechargeDate, "2027-03-31");
  assert.equal(context.phoneFeeProjection(phone({ purchaseDate: "2028-01-31", billingDay: 31, balance: 0 }), "2028-02-01").rechargeDate, "2028-02-29");
});

test("confirmed-day fees are already settled and decimal yuan calculations use cents", () => {
  assert.equal(context.phoneFeeProjection(phone({ purchaseDate: "2026-11-01", balance: 0 }), "2026-11-01").rechargeDate, "2026-12-01");
  assert.equal(context.phoneFeeProjection(phone({ price: 0.1, balance: 0.3 }), "2026-11-10").rechargeDate, "2027-03-01");
  assert.equal(context.phoneFeeProjection(phone({ purchaseDate: "2026-12-01", balance: 200 }), "2026-12-01").rechargeDate, "2027-04-01");
});

test("incomplete or invalid phone information does not invent a recharge date", () => {
  for (const updates of [{ price: 0 }, { price: "bad" }, { balance: -1 }, { balance: undefined }, { billingDay: 32 }, { billingDay: 1.5 }, { purchaseDate: "" }, { purchaseDate: "2027-01-01" }]) {
    assert.equal(context.phoneFeeProjection(phone(updates), "2026-11-10"), null);
    assert.equal(context.upcomingSubscriptions([phone(updates)], "2026-11-10").length, 0);
  }
});
