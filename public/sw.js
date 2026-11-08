const CACHE_NAME = "qiyeworkbench-v20";
const APP_SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/avatar-cultivation.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

async function cacheResponse(request, response) {
  if (response.status === 200 && response.headers.get("X-Qiye-Asset") !== "bundled") {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  }
}

async function loadNavigation(request, event) {
  const network = fetch(new Request(request, { cache: "no-store" }));
  event.waitUntil(network.then((response) => cacheResponse(request, response)).catch(() => {}));
  const cached = await caches.match(request);
  if (!cached) return network;
  let timer;
  try {
    const response = await Promise.race([
      network,
      new Promise((resolve) => { timer = setTimeout(() => resolve(cached), 2000); }),
    ]);
    return response.ok ? response : cached;
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(loadNavigation(event.request, event));
    return;
  }

  // Partial video responses cannot be stored as complete files in Cache API.
  if (event.request.headers.has("range")) return;
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|webp|jpg|jpeg|svg|ico|webm|woff2?)$/i.test(url.pathname) || APP_SHELL.includes(url.pathname)) {
    const response = caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      const loaded = await fetch(event.request);
      await cacheResponse(event.request, loaded).catch(() => {});
      return loaded;
    });
    event.respondWith(response);
    event.waitUntil(response.then(() => {}).catch(() => {}));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || "工作台提醒", {
    body: data.body || "有一项任务需要处理",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
