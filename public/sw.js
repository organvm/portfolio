// Service Worker — network-first HTML, cache-first assets
const CACHE_VERSION = 'v2';
const CACHE_NAME = `portfolio-${CACHE_VERSION}`;
const BASE = '';

// Assets to precache on install
const PRECACHE_URLS = [
	`${BASE}/`,
	`${BASE}/404.html`,
	`${BASE}/fonts/syne-latin.woff2`,
	`${BASE}/fonts/plus-jakarta-sans-latin.woff2`,
	`${BASE}/fonts/jetbrains-mono-latin.woff2`,
	`${BASE}/favicon.svg`,
];

// Install: precache critical assets
self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
	self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
			),
	);
	self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Only handle same-origin requests
	if (url.origin !== self.location.origin) return;

	// HTML pages: network-first with cache fallback
	if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					return response;
				})
				.catch(() =>
					caches.match(request).then((cached) => cached || caches.match(`${BASE}/404.html`)),
				),
		);
		return;
	}

	// Static assets: cache-first with network fallback
	if (
		url.pathname.match(/\.(css|js|woff2?|png|jpg|jpeg|svg|ico|webp)$/) ||
		url.pathname.includes('/pagefind/')
	) {
		event.respondWith(
			caches.match(request).then(
				(cached) =>
					cached ||
					fetch(request).then((response) => {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
						return response;
					}),
			),
		);
		return;
	}
});
