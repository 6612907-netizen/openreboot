/* OpenReboot service worker — 运行时缓存，零构建期依赖。
 * 策略：同站 GET 走 stale-while-revalidate；其余一律直通。
 * 不做的事：不预置资源清单（构建产物名带哈希，硬编码必然过期）、
 *           不后台同步、不推送、不遥测 —— 应用完全离线可用即可。
 */
const CACHE = "openreboot-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不代理跨站请求

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
