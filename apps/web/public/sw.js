const CACHE_NAME = 'ecorota-shell-v2';
const SHELL_URL = '/';

async function cacheShell(response) {
  if (!response.ok) return;
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]);
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(['/manifest.webmanifest', '/icons/ecorota-192.png', '/icons/ecorota-512.png', ...assets].map(async (url) => {
    if (!(await cache.match(url))) await cache.add(url);
  }));
  await cache.put(SHELL_URL, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(SHELL_URL, { cache: 'reload' });
    if (!response.ok) throw new Error('Não foi possível guardar a interface offline.');
    await cacheShell(response);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('ecorota-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) event.waitUntil(cacheShell(response.clone()).catch(() => {}));
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(SHELL_URL)) || Response.error();
    }));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
