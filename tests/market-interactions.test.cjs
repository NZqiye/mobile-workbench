const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../app/page.jsx"), "utf8");
const HOUR = 60 * 60 * 1000;
const START = Date.parse("2026-09-08T01:00:00Z");
const A = "sh600001", B = "sz000002", C = "sh600003", D = "sz000004";
const symbols = [A, B, C];
const quotes = (order = symbols, price = 10) => order.map((symbol) => ({ symbol, name: symbol, price, changePercent: 1 }));
const orderOf = (items) => Array.from(items, (item) => item.symbol);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in page.jsx`);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

const boards = {
  MarketBoard: { load: "loadQuotes", expose: "quotes, status, loading, loadQuotes, setStockInput, addStock, deleteStock, startQuoteDrag, moveDraggedQuote, finishQuoteDrag, moveQuoteWithKeyboard" },
  IndexTrackerBoard: { load: "loadTracker", expose: "trackerData, status, loadTracker, saveIndexItems" },
  FundBoard: { load: "loadFunds", expose: "funds, status, loadFunds" },
};

// Run the real component logic before its JSX. Only hooks, IO and unrelated
// display/portfolio helpers are replaced; loaders, sorting and timers are not copied.
function harness(name = "MarketBoard", { storage = new Map(), cached = false } = {}) {
  let now = START, cursor = 0, hover = "", mounted = false;
  const slots = [], effects = [], timers = [], requests = [], savedOrders = [];
  const key = (value) => `qiyeworkbench:${value}`;
  const localStorage = {
    getItem: (value) => storage.get(value) ?? null,
    setItem: (value, data) => storage.set(value, String(data)),
    removeItem: (value) => storage.delete(value),
  };
  const readStorage = (name, fallback) => JSON.parse(localStorage.getItem(key(name)) ?? JSON.stringify(fallback));
  const writeStorage = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  if (!storage.has(key("assets"))) localStorage.setItem(key("assets"), symbols.join(","));
  if (!storage.has(key("fundPortfolio"))) writeStorage("fundPortfolio", [{ code: "000001", trades: [] }]);
  const versions = {};
  for (const value of ["marketCacheVersion", "indexTrackerCacheVersion", "fundCacheVersion"]) {
    versions[value] = Number(source.match(new RegExp(`const ${value} = (\\d+)`))[1]);
  }
  if (cached) writeStorage("marketCache", { version: versions.marketCacheVersion, savedAt: START, quotes: quotes() });
  const context = vm.createContext({
    ...versions, localStorage, readStorage, writeStorage, key, URLSearchParams, console,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useEffect(callback) { if (!mounted) effects.push(callback); },
    useMemo(callback) { return callback(); },
    setInterval(callback, delay) { const timer = { callback, delay, next: now + delay }; timers.push(timer); return timer; },
    clearInterval(timer) { timer.active = false; },
    fetch(url) { return new Promise((resolve, reject) => requests.push({ url, resolve, reject })); },
    document: { elementFromPoint: () => hover ? { closest: () => ({ dataset: { marketSymbol: hover } }) } : null },
    marketRefreshInterval: HOUR, marketSymbolNames: {}, defaultAssets: symbols.join(","), legacyDefaultAssets: "legacy", stockDefaultAssets: "legacy-stocks",
    nowText: () => String(now), touchItems: (items) => items, itemUpdatedAt: () => 0,
    indexTrackerItems: [{ id: "one", name: "One", marketSymbol: A }], defaultIndexTrackerDraft: {}, indexTrackerPresets: [], buildIndexTrackerRows: () => [],
    defaultFundCodes: "000001", normalizeFundPortfolio: (items) => items,
    buildFundPortfolioFromCodes: (codes) => (codes || "").split(",").filter(Boolean).map((code) => ({ code, trades: [] })),
    mergeFundBoardData: (data, portfolio) => portfolio.map((item) => ({ ...item, ...data.find((quote) => quote.code === item.code) })),
  });
  for (const helper of ["normalizeSavedAssets", "normalizeStockSymbol", "normalizeMarketQuote", "normalizeIndexTrackerItems", "buildIndexTrackerUrl"]) {
    vm.runInContext(functionSource(helper), context);
  }
  const component = functionSource(name);
  const jsx = component.indexOf("\n  return (");
  assert.ok(jsx > 0, `${name} JSX boundary must be found`);
  const renderComponent = vm.runInContext(`(${component.slice(0, jsx)}\nreturn { ${boards[name].expose} };\n})`, context);
  function render() { cursor = 0; return renderComponent({ onAssetsChange: (value) => savedOrders.push(value) }); }
  render();
  mounted = true;
  effects.forEach((effect) => effect());
  return {
    render, requests, storage, savedOrders, readStorage, writeStorage, timers,
    assets: () => localStorage.getItem(key("assets")),
    hover(symbol) { hover = symbol; },
    async respond(index, data, ok = true) { requests[index].resolve({ ok, json: async () => data }); await flush(); },
    setTime(time) { now = time; },
    tick(time) { now = time; for (const timer of timers) if (timer.active !== false && now >= timer.next) { timer.next += timer.delay; timer.callback(); } },
    event: { button: 0, isPrimary: true, pointerId: 1, clientX: 1, clientY: 1, preventDefault() {}, currentTarget: { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}, closest() { return this; } } },
  };
}

for (const name of Object.keys(boards)) {
  test(`${name}: hourly callback fetches with a younger cache; manual refresh bypasses cache`, async () => {
    const h = harness(name);
    assert.equal(h.requests.length, 1);
    h.setTime(START + 250);
    const data = name === "IndexTrackerBoard" ? { markets: quotes(), funds: [] } : { quotes: name === "FundBoard" ? [{ code: "000001", nav: 1 }] : quotes() };
    await h.respond(0, data);
    h.tick(START + HOUR);
    assert.equal(h.requests.length, 2, "first hourly tick must fetch rather than wait another hour");
    await h.respond(1, data);
    h.render()[boards[name].load](true);
    assert.equal(h.requests.length, 3, "manual refresh must bypass a just-written cache");
    await h.respond(2, data);
  });
}

test("rapid repeated drag target and immediate pointer-up persist the latest order", () => {
  const h = harness("MarketBoard", { cached: true });
  const view = h.render();
  view.startQuoteDrag(h.event, A);
  h.hover(B);
  view.moveDraggedQuote(h.event, A);
  view.moveDraggedQuote(h.event, A);
  view.moveDraggedQuote(h.event, A);
  view.finishQuoteDrag(h.event);
  assert.deepEqual(orderOf(h.render().quotes), [B, A, C]);
  assert.equal(h.assets(), [B, A, C].join(","));
  assert.equal(h.savedOrders.at(-1), [B, A, C].join(","));
});

for (const completion of ["during", "after"]) {
  test(`in-flight refresh completing ${completion} drag cannot restore the old order`, async () => {
    const h = harness("MarketBoard", { cached: true });
    let view = h.render();
    view.loadQuotes(true);
    view = h.render();
    view.startQuoteDrag(h.event, A);
    h.hover(C);
    view.moveDraggedQuote(h.event, A);
    if (completion === "after") view.finishQuoteDrag(h.event);
    await h.respond(0, { quotes: quotes(symbols, 20) });
    assert.deepEqual(orderOf(h.render().quotes), [B, C, A]);
    if (completion === "during") h.render().finishQuoteDrag(h.event);
    assert.equal(h.assets(), [B, C, A].join(","));
    assert.deepEqual(orderOf(h.readStorage("marketCache").quotes), [B, C, A]);
  });
}

test("re-entering the market uses the saved drag order without a network request", () => {
  const h = harness("MarketBoard", { cached: true });
  const view = h.render();
  view.startQuoteDrag(h.event, C);
  h.hover(A);
  view.moveDraggedQuote(h.event, C);
  view.finishQuoteDrag(h.event);
  const reopened = harness("MarketBoard", { storage: h.storage });
  assert.equal(reopened.requests.length, 0);
  assert.deepEqual(orderOf(reopened.render().quotes), [C, A, B]);
});

test("adding then deleting while requests overlap accepts only the newest response", async () => {
  const h = harness("MarketBoard", { cached: true });
  h.render().setStockInput(D);
  h.render().addStock(h.event);
  h.render().deleteStock(A);
  assert.equal(h.requests.length, 2);
  assert.match(decodeURIComponent(h.requests[1].url), new RegExp([B, C, D].join(",")));
  await h.respond(1, { quotes: quotes([B, C, D], 20) });
  await h.respond(0, { quotes: quotes([A, B, C, D], 10) });
  assert.deepEqual(orderOf(h.render().quotes), [B, C, D]);
  assert.ok(h.render().quotes.every((quote) => quote.price === 20));
  assert.deepEqual(orderOf(h.readStorage("marketCache").quotes), [B, C, D]);
});

test("obsolete response does not re-enable refresh while newest request is pending", async () => {
  const h = harness("MarketBoard", { cached: true });
  h.render().loadQuotes(true);
  h.render().loadQuotes(true);
  await h.respond(0, { quotes: quotes() });
  assert.equal(h.render().loading, true);
  await h.respond(1, { quotes: quotes(symbols, 20) });
  assert.equal(h.render().loading, false);
  assert.equal(h.render().quotes[0].price, 20);
});
