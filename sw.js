/* Kesug Slots — v18 reliable offline-first Service Worker. */
'use strict';

const VERSION = 'kesug-kate-mobile-edge-v19-2026-11-22';
const SHELL_CACHE = `${VERSION}-shell`;
const CODE_CACHE = `${VERSION}-code`;
const ASSET_CACHE = `${VERSION}-assets`;
const SCOPE_URL = self.registration.scope;
const APP_URL = new URL('./index.html', SCOPE_URL).href;
const MANIFEST_URL = new URL('./manifest.webmanifest', SCOPE_URL).href;
const CORE_ASSETS = [
  MANIFEST_URL,
  new URL('./icons/icon-192.png', SCOPE_URL).href,
  new URL('./icons/icon-512.png', SCOPE_URL).href,
  new URL('./icons/icon-maskable-512.png', SCOPE_URL).href
];
const OWN_CACHE_PREFIXES = [
  'kesug-remastered-',
  'kesug-kate-classic-',
  'kesug-kate-loading-fix-',
  'kesug-kate-windows-motion-',
  'kesug-kate-stable-tabs-',
  'kesug-slots-'
];

async function fetchWithTimeout(request, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function putIfCacheable(cache, key, response) {
  if (!response || !(response.ok || response.type === 'opaque')) return;
  try {
    await cache.put(key, response.clone());
  } catch (error) {
    // Some opaque/range/opaque-redirect responses are not cacheable; don't fail the page.
    console.debug('Kesug SW: skipped cache entry', error);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const assets = await caches.open(ASSET_CACHE);

    // Precache the app shell by its one canonical URL. Do not cache the root
    // alias independently, otherwise '/' and '/index.html' can drift apart.
    try {
      const response = await fetchWithTimeout(APP_URL, 6500);
      if (response && response.ok) await shell.put(APP_URL, response.clone());
    } catch (_) {
      // Installation can still complete; a later online visit will fill the shell.
    }

    await Promise.all(CORE_ASSETS.map(async url => {
      try {
        const response = await fetchWithTimeout(url, 3500);
        await putIfCacheable(assets, url, response);
      } catch (_) {
        // Icons/manifest are optional for SW installation.
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, CODE_CACHE, ASSET_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => OWN_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)) && !keep.has(key))
      .map(key => caches.delete(key)));
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'KESUG_SW_ACTIVATED', version: VERSION });
    }
  })());
});

function isInScope(url) {
  return url.origin === self.location.origin && url.href.startsWith(SCOPE_URL);
}

function isCodeResource(request, url) {
  return request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    /\.(?:m?js|css|webmanifest)$/i.test(url.pathname);
}

function isStaticAsset(request, url) {
  if (isCodeResource(request, url)) return true;
  return ['image', 'font'].includes(request.destination) ||
    /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);
}

async function networkFirstNavigation(request) {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response && response.ok) {
      await putIfCacheable(shell, APP_URL, response);
      return response;
    }
    throw new Error(`Navigation returned ${response ? response.status : 'no response'}`);
  } catch (_) {
    const cached = await shell.match(APP_URL);
    if (cached) return cached;
    return new Response(
      '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kesug Slots</title><main style="font:16px system-ui;padding:10vh 8vw;color:#eee;background:#111116;min-height:80vh"><h1>Kesug Slots</h1><p>Не удалось загрузить новую версию. Подключись к интернету и обнови страницу. Офлайн-копия ещё не сохранена.</p></main></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }
}

async function networkFirstStatic(request, cacheName, timeoutMs = 4500) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request, timeoutMs);
    if (response && (response.ok || response.type === 'opaque')) {
      await putIfCacheable(cache, request, response);
      return response;
    }
    throw new Error(`Static resource returned ${response ? response.status : 'no response'}`);
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Do not return an old entry from another cache generation.
    return new Response('', { status: 504, statusText: 'Kesug asset unavailable offline' });
  }
}

async function networkFirstExternal(request) {
  const cache = await caches.open(ASSET_CACHE);
  try {
    const response = await fetchWithTimeout(request, 2600);
    if (response && (response.ok || response.type === 'opaque')) {
      await putIfCacheable(cache, request, response);
      return response;
    }
    throw new Error('External asset unavailable');
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 504, statusText: 'External asset unavailable offline' });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Leave audio/video range requests and streaming untouched.
  if (request.headers.has('range') || ['audio', 'video'].includes(request.destination)) return;
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (request.mode === 'navigate' && isInScope(url)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isInScope(url) && isStaticAsset(request, url)) {
    const cacheName = isCodeResource(request, url) ? CODE_CACHE : ASSET_CACHE;
    // Same-origin JS/CSS/images are network-first, so updated files replace stale cache.
    event.respondWith(networkFirstStatic(request, cacheName, isCodeResource(request, url) ? 5000 : 3200));
    return;
  }

  // External fonts/icons are fetched fresh first; a cached copy is only an offline fallback.
  if (request.destination && !isInScope(url) && ['image', 'font', 'style', 'script'].includes(request.destination)) {
    event.respondWith(networkFirstExternal(request));
  }
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'KESUG_SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (data.type !== 'KESUG_PREPARE_OFFLINE') return;

  const port = event.ports && event.ports[0];
  event.waitUntil((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const urls = Array.isArray(data.urls)
      ? [...new Set(data.urls)].filter(value => /^https?:/i.test(value)).slice(0, 160)
      : [];
    let completed = 0;
    let failed = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < urls.length) {
        const value = urls[cursor++];
        try {
          const url = new URL(value);
          const request = new Request(url.href, { method: 'GET', credentials: 'omit' });
          const response = await fetchWithTimeout(request, 5000);
          if (response && (response.ok || response.type === 'opaque')) {
            await putIfCacheable(cache, request, response);
          } else {
            failed++;
          }
        } catch (_) {
          failed++;
        }
        completed++;
        if (port) port.postMessage({ type: 'progress', completed, total: urls.length, failed });
      }
    };

    await Promise.all(Array.from({ length: Math.min(2, urls.length) }, () => worker()));
    if (port) port.postMessage({ type: 'complete', completed, total: urls.length, failed });
  })());
});
