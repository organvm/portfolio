import type p5 from 'p5';

declare global {
	interface IdleDeadline {
		readonly didTimeout: boolean;
		timeRemaining(): number;
	}
	interface Window {
		requestIdleCallback(
			callback: (deadline: IdleDeadline) => void,
			options?: { timeout: number },
		): number;
		cancelIdleCallback(handle: number): void;
	}
}

const sketchModules: Record<
	string,
	() => Promise<{ default: (p: p5, container: HTMLElement) => void }>
> = {
	// Existing (10)
	hero: () => import('./hero-sketch'),
	'organ-system': () => import('./organ-system-sketch'),
	'recursive-tree': () => import('./recursive-tree-sketch'),
	counterpoint: () => import('./counterpoint-sketch'),
	pipeline: () => import('./pipeline-sketch'),
	'token-stream': () => import('./token-stream-sketch'),
	'network-graph': () => import('./network-graph-sketch'),
	'flow-diagram': () => import('./flow-diagram-sketch'),
	'data-bars': () => import('./data-bars-sketch'),
	'particle-field': () => import('./particle-field-sketch'),
	// New (19)
	terrain: () => import('./terrain-sketch'),
	conductor: () => import('./conductor-sketch'),
	octagon: () => import('./octagon-sketch'),
	waveform: () => import('./waveform-sketch'),
	swarm: () => import('./swarm-sketch'),
	deliberation: () => import('./deliberation-sketch'),
	blocks: () => import('./blocks-sketch'),
	constellation: () => import('./constellation-sketch'),
	scatter: () => import('./scatter-sketch'),
	spiral: () => import('./spiral-sketch'),
	orbits: () => import('./orbits-sketch'),
	atoms: () => import('./atoms-sketch'),
	kaleidoscope: () => import('./kaleidoscope-sketch'),
	lenses: () => import('./lenses-sketch'),
	routing: () => import('./routing-sketch'),
	hierarchy: () => import('./hierarchy-sketch'),
	typewriter: () => import('./typewriter-sketch'),
	ticker: () => import('./ticker-sketch'),
	weave: () => import('./weave-sketch'),
	// Background (always-on)
	background: () => import('./background-sketch'),
};

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let prefersReducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', (e) => {
	prefersReducedMotion = e.matches;
	// Re-apply to already-running instances — the persistent #bg-canvas survives
	// navigations and would otherwise keep animating after reduced-motion is enabled.
	for (const inst of instances.values()) {
		if (!inst.draw) continue;
		if (prefersReducedMotion) {
			inst.noLoop();
		} else {
			inst.loop();
		}
	}
});

// Defer background sketch boot on the heaviest interactive routes.
const BACKGROUND_DEFER_ROUTES = new Set([
	`${import.meta.env.BASE_URL}architecture`,
	`${import.meta.env.BASE_URL}gallery`,
]);

// Track p5 instances for teardown (Map replaces former Set for VT readiness)
const instances = new Map<HTMLElement, p5>();
let sketchObserver: IntersectionObserver | null = null;

// Concurrency throttle: max 4 simultaneous sketch initializations
const MAX_CONCURRENT = 4;
let activeInits = 0;
const initQueue: HTMLElement[] = [];

function isMobile(): boolean {
	return window.innerWidth < 768;
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let resizeHandler: (() => void) | null = null;
let observedContainers: HTMLElement[] = [];

function normalizePath(pathname: string): string {
	if (pathname === '/') return '/';
	return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function shouldBootBackground(pathname = window.location.pathname): boolean {
	return !BACKGROUND_DEFER_ROUTES.has(normalizePath(pathname));
}

function showFallback(container: HTMLElement, sketchId: string) {
	const fallback = container.querySelector('.sketch-noscript');
	if (fallback) {
		(fallback as HTMLElement).style.display = 'flex';
	} else {
		const el = document.createElement('div');
		el.style.cssText =
			'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.8rem;opacity:0.6;';
		el.textContent = `[${sketchId}]`;
		container.appendChild(el);
	}
}

function processQueue() {
	while (activeInits < MAX_CONCURRENT && initQueue.length > 0) {
		const next = initQueue.shift()!;
		doInitSketch(next);
	}
}

function initSketch(container: HTMLElement) {
	if (instances.has(container)) return;

	if (activeInits >= MAX_CONCURRENT) {
		if (!initQueue.includes(container)) initQueue.push(container);
		return;
	}

	doInitSketch(container);
}

function doInitSketch(container: HTMLElement) {
	if (instances.has(container)) return;
	activeInits++;

	const sketchId = container.dataset.sketch;
	const height = container.dataset.height || '500px';
	const mobileHeight = container.dataset.mobileHeight || '350px';

	if (!sketchId || !sketchModules[sketchId]) {
		console.error('[sketch] unknown sketch id:', sketchId);
		showFallback(container, sketchId || 'unknown');
		activeInits--;
		processQueue();
		return;
	}

	container.style.height = isMobile() ? mobileHeight : height;

	const loader = sketchModules[sketchId];

	Promise.all([import('p5'), loader()])
		.then(([p5Module, sketchModule]) => {
			const P5 = p5Module.default;
			const sketchFn = sketchModule.default;

			try {
				const instance = new P5((p: p5) => {
					sketchFn(p, container);

					// For reduced motion: render a fully-grown static frame then stop
					if (prefersReducedMotion && p.draw) {
						const originalDraw = p.draw.bind(p);
						let warmupFrames = 60;
						p.draw = () => {
							originalDraw();
							warmupFrames--;
							if (warmupFrames <= 0) {
								p.noLoop();
							}
						};

						const originalMousePressed = p.mousePressed?.bind(p);
						if (originalMousePressed) {
							p.mousePressed = () => {
								originalMousePressed();
								p.redraw();
							};
						}
					}
				}, container);
				instances.set(container, instance);
			} catch (err) {
				console.error('[sketch]', sketchId, 'p5 constructor error:', err);
				showFallback(container, sketchId!);
			}
		})
		.catch((err) => {
			console.error('[sketch]', sketchId, 'load error:', err);
			showFallback(container, sketchId!);
		})
		.finally(() => {
			activeInits--;
			processQueue();
		});
}

function deferInit(container: HTMLElement) {
	const rect = container.getBoundingClientRect();
	const aboveFold = rect.top < window.innerHeight;

	if (aboveFold && 'requestIdleCallback' in window) {
		window.requestIdleCallback(() => initSketch(container), { timeout: 2000 });
	} else {
		initSketch(container);
	}
}

function observeSketches() {
	observedContainers = Array.from(
		document.querySelectorAll<HTMLElement>('.sketch-container[data-sketch]'),
	);
	const containers = observedContainers;

	if ('IntersectionObserver' in window) {
		sketchObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						deferInit(entry.target as HTMLElement);
						sketchObserver?.unobserve(entry.target);
					}
				});
			},
			{ rootMargin: '200px' },
		);
		containers.forEach((c) => sketchObserver!.observe(c));
	} else {
		containers.forEach(deferInit);
	}

	if (!resizeHandler) {
		resizeHandler = () => {
			if (resizeTimer) clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				observedContainers.forEach((container) => {
					const height = container.dataset.height || '500px';
					const mobileHeight = container.dataset.mobileHeight || '350px';
					container.style.height = isMobile() ? mobileHeight : height;
				});
			}, 100);
		};
		window.addEventListener('resize', resizeHandler);
	}
}

function initBackground() {
	const bg = document.getElementById('bg-canvas');
	if (!bg || instances.has(bg)) return;

	const loader = sketchModules['background'];
	if (!loader) return;

	Promise.all([import('p5'), loader()])
		.then(([p5Module, sketchModule]) => {
			const P5 = p5Module.default;
			const sketchFn = sketchModule.default;

			try {
				const instance = new P5((p: p5) => {
					sketchFn(p, bg);

					if (prefersReducedMotion && p.draw) {
						const originalDraw = p.draw.bind(p);
						let warmupFrames = 60;
						p.draw = () => {
							originalDraw();
							warmupFrames--;
							if (warmupFrames <= 0) {
								p.noLoop();
							}
						};
					}
				}, bg);
				instances.set(bg, instance);
			} catch (err) {
				console.error('[bg-sketch] p5 constructor error:', err);
			}
		})
		.catch((err) => {
			console.error('[bg-sketch] load error:', err);
		});
}

function scheduleBackgroundInit() {
	const startInit = () => {
		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(() => initBackground(), { timeout: 3000 });
		} else {
			setTimeout(initBackground, 100);
		}
	};

	if ('PerformanceObserver' in window) {
		const po = new PerformanceObserver(() => {
			po.disconnect();
			startInit();
		});
		try {
			po.observe({ type: 'largest-contentful-paint', buffered: true });
		} catch {
			startInit();
		}
	} else {
		setTimeout(initBackground, 200);
	}
}

/** Remove all active p5 instances and reset state. */
export function teardown() {
	if (resizeTimer) {
		clearTimeout(resizeTimer);
		resizeTimer = null;
	}
	if (resizeHandler) {
		window.removeEventListener('resize', resizeHandler);
		resizeHandler = null;
	}
	observedContainers = [];
	instances.forEach((instance) => {
		try {
			instance.remove();
		} catch {
			/* already removed */
		}
	});
	instances.clear();
	initQueue.length = 0;
	activeInits = 0;
	if (sketchObserver) {
		sketchObserver.disconnect();
		sketchObserver = null;
	}
}

/** Tear down per-page sketches but preserve the #bg-canvas instance. */
export function teardownPage() {
	if (resizeTimer) {
		clearTimeout(resizeTimer);
		resizeTimer = null;
	}
	if (resizeHandler) {
		window.removeEventListener('resize', resizeHandler);
		resizeHandler = null;
	}
	observedContainers = [];
	const bg = document.getElementById('bg-canvas');
	const bgInstance = bg ? instances.get(bg) : undefined;

	// Remove all non-background instances
	instances.forEach((instance, el) => {
		if (el !== bg) {
			try {
				instance.remove();
			} catch {
				/* already removed */
			}
		}
	});
	instances.clear();

	// Preserve background instance
	if (bg && bgInstance) {
		instances.set(bg, bgInstance);
	}

	initQueue.length = 0;
	activeInits = 0;
	if (sketchObserver) {
		sketchObserver.disconnect();
		sketchObserver = null;
	}
}

/** Re-observe per-page sketch containers after a View Transition swap. */
export function reinitPage() {
	if (shouldBootBackground()) {
		scheduleBackgroundInit();
	}
	observeSketches();
}

/** Get the p5 instance for a sketch container. */
export function getSketchInstance(el: HTMLElement): p5 | undefined {
	return instances.get(el);
}

/** Pause (noLoop) a sketch in the given container. */
export function pauseSketch(el: HTMLElement) {
	const inst = instances.get(el);
	if (inst) {
		inst.noLoop();
		el.setAttribute('data-paused', '');
	}
}

/** Resume (loop) a sketch in the given container. */
export function resumeSketch(el: HTMLElement) {
	const inst = instances.get(el);
	if (inst) {
		inst.loop();
		el.removeAttribute('data-paused');
	}
}

/** Full init: background + per-page sketches. Called once on first load. */
export function initSketches() {
	if (shouldBootBackground()) {
		scheduleBackgroundInit();
	}
	observeSketches();
}
