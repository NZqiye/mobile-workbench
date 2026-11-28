const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function artworkRoute(handler, token = "test") {
  const source = fs.readFileSync(path.join(__dirname, "../app/api/media-artwork/route.js"), "utf8")
    .replace(/^import .*;\r?\n/, "").replace("export async function GET", "async function GET");
  const calls = [];
  const fetch = async (url) => { calls.push(String(url)); return { ok: true, json: async () => handler(String(url)) }; };
  const context = vm.createContext({ URL, Response, AbortSignal, tmdbToken: token, fetch, fetchTmdb: fetch });
  vm.runInContext(source, context);
  return { get: async (query) => (await context.GET({ url: `http://localhost/api/media-artwork?${query}` })).json(), calls };
}

test("missing TV backdrop falls back to same show's episode still and is cached", async () => {
  const route = artworkRoute((url) => url.includes("/season/")
    ? { episodes: [{ still_path: "/episode.jpg" }, { still_path: "/episode.jpg" }] }
    : { seasons: [{ season_number: 0 }, { season_number: 1 }] });
  const result = await route.get("id=10&type=tv");
  assert.deepEqual(result.images, ["https://image.tmdb.org/t/p/w780/episode.jpg"]);
  assert.deepEqual(await route.get("id=10&type=tv"), result);
  assert.equal(route.calls.length, 2);
  assert.ok(route.calls[1].includes("/tv/10/season/1"));
});

test("horizontal images take priority and films do not request TV episodes", async () => {
  const route = artworkRoute(() => ({ backdrop_path: "/main.jpg", images: { backdrops: [{ file_path: "/other.jpg" }] } }));
  const result = await route.get("id=20&type=movie");
  assert.deepEqual(result.images, ["https://image.tmdb.org/t/p/w780/main.jpg", "https://image.tmdb.org/t/p/w780/other.jpg"]);
  assert.equal(route.calls.length, 1);
});

test("TVMaze falls back to exact show backgrounds and episode images without a TMDB token", async () => {
  const route = artworkRoute((url) => url.endsWith("/images")
    ? [{ type: "poster", resolutions: { original: { url: "poster" } } }, { type: "background", resolutions: { original: { url: "background" } } }]
    : [{ image: { original: "still" } }, { image: null }], "");
  assert.deepEqual((await route.get("tvmazeId=30")).images, ["background", "still"]);
  assert.ok(route.calls.every((url) => url.includes("/shows/30/")));
});

test("unavailable artwork and invalid identity leave no invented replacement", async () => {
  const route = artworkRoute(() => { throw new Error("offline"); });
  assert.deepEqual((await route.get("id=40")).images, []);
  const count = route.calls.length;
  assert.deepEqual((await route.get("id=../wrong&type=tv")).images, []);
  assert.equal(route.calls.length, count);
});

test("Bangumi-only anime matches Kitsu by exact title and year without confusing seasons", async () => {
  const route = artworkRoute(() => ({ data: [
    { id: "1", attributes: { titles: { en: "Cyberpunk: Edgerunners" }, startDate: "2022-09-13", coverImage: { large: "wrong-season" } } },
    { id: "2", attributes: { titles: { en: "Cyberpunk: Edgerunners II" }, startDate: "2026-10-20", coverImage: { large: "right-season" } } },
  ] }));
  const result = await route.get("bangumiId=10&name=Cyberpunk%3A%20Edgerunners%20II&year=2026");
  assert.deepEqual(result.images, ["right-season"]);
  assert.equal(route.calls.length, 1);
  assert.ok(route.calls[0].includes("kitsu.app"));
});

test("ambiguous anime matches never borrow another show's artwork", async () => {
  const candidate = { attributes: { titles: { en: "Same Title" }, startDate: "2026-01-01", coverImage: { large: "ambiguous" } } };
  const route = artworkRoute(() => ({ data: [candidate, candidate] }));
  assert.deepEqual((await route.get("bangumiId=11&name=Same%20Title&year=2026")).images, []);
});

test("missing main poster uses the same programme's newest available season poster", async () => {
  const route = artworkRoute(() => ({ seasons: [
    { season_number: 0, poster_path: "/special.jpg" },
    { season_number: 1, poster_path: "/first.jpg" },
    { season_number: 2, poster_path: "/second.jpg" },
    { season_number: 3, poster_path: null },
  ], backdrop_path: "/backdrop.jpg" }));
  const result = await route.get("id=300&type=tv");
  assert.equal(result.posterUrl, "https://image.tmdb.org/t/p/w342/second.jpg");
  assert.deepEqual(result.images, ["https://image.tmdb.org/t/p/w780/backdrop.jpg"]);
  assert.deepEqual(await route.get("id=300&type=tv"), result);
  assert.equal(route.calls.length, 1);
});

test("poster-only image collections prefer Chinese and do not invent artwork", async () => {
  const route = artworkRoute(() => ({ images: { posters: [{ file_path: "/en.jpg", iso_639_1: "en" }, { file_path: "/zh.jpg", iso_639_1: "zh" }] } }));
  assert.equal((await route.get("id=301&type=movie")).posterUrl, "https://image.tmdb.org/t/p/w342/zh.jpg");
  const empty = artworkRoute(() => ({}));
  assert.deepEqual(await empty.get("id=302&type=tv"), { images: [], posterUrl: "" });
});
