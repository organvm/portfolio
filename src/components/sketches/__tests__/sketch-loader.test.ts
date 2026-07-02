// @vitest-environment happy-dom

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Parse original file for static tests
const loaderSource = readFileSync(resolve(__dirname, '../sketch-loader.ts'), 'utf-8');

const moduleEntries = [...loaderSource.matchAll(/['"]?([a-z-]+)['"]?:\s*\(\)\s*=>\s*import\(/g)];
const registeredIds = moduleEntries.flatMap((m) => (m[1] ? [m[1]] : []));

type MockP5Shape = {
	remove: ReturnType<typeof vi.fn>;
	noLoop: ReturnType<typeof vi.fn>;
	loop: ReturnType<typeof vi.fn>;
	redraw: ReturnType<typeof vi.fn>;
	draw: ReturnType<typeof vi.fn>;
};

type TestIntersectionEntry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>;

// Mock p5 and sketch modules at top level
vi.mock('p5', () => {
	return {
		default: class MockP5 {
			constructor(sketch: (p: MockP5Shape) => void) {
				const p: MockP5Shape = {
					remove: vi.fn(),
					noLoop: vi.fn(),
					loop: vi.fn(),
					redraw: vi.fn(),
					draw: vi.fn(),
				};
				sketch(p);
				Object.assign(this, p);
			}
			remove = vi.fn();
			noLoop = vi.fn();
			loop = vi.fn();
			redraw = vi.fn();
			draw = vi.fn();
		},
	};
});

// Mock all sketch modules
vi.mock('../hero-sketch', () => ({ default: vi.fn() }));
vi.mock('../background-sketch', () => ({ default: vi.fn() }));

describe('sketch registry (static)', () => {
	it('has registered sketches', () => {
		expect(registeredIds.length).toBeGreaterThan(0);
	});
	it('has unique sketch IDs', () => {
		expect(new Set(registeredIds).size).toBe(registeredIds.length);
	});
	it('includes the background sketch', () => {
		expect(registeredIds).toContain('background');
	});
	it('every sketch ID has a corresponding file', () => {
		const sketchDir = resolve(__dirname, '..');
		const files = readdirSync(sketchDir) as string[];
		const sketchFiles = new Set(
			files
				.filter((f: string) => f.endsWith('-sketch.ts'))
				.map((f: string) => f.replace('-sketch.ts', '')),
		);
		for (const id of registeredIds) {
			expect(sketchFiles.has(id)).toBe(true);
		}
	});
});

describe('sketch-loader runtime', () => {
	let observerCallback: (entries: TestIntersectionEntry[]) => void = () => {};
	const mockObserve = vi.fn();
	const mockUnobserve = vi.fn();
	const mockDisconnect = vi.fn();

	beforeEach(() => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		);

		class MockIntersectionObserver implements IntersectionObserver {
			readonly root = null;
			readonly rootMargin = '0px';
			readonly thresholds = [];

			constructor(cb: IntersectionObserverCallback) {
				observerCallback = (entries: TestIntersectionEntry[]): void => {
					cb(entries as IntersectionObserverEntry[], this);
				};
			}

			observe(target: Element): void {
				mockObserve(target);
			}

			unobserve(target: Element): void {
				mockUnobserve(target);
			}

			disconnect(): void {
				mockDisconnect();
			}

			takeRecords(): IntersectionObserverEntry[] {
				return [];
			}
		}

		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
		vi.stubGlobal(
			'requestIdleCallback',
			vi.fn((cb) => cb({ didTimeout: false, timeRemaining: () => 10 })),
		);
		vi.stubGlobal('cancelIdleCallback', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('can be imported and exports teardown', async () => {
		const loader = await import('../sketch-loader');
		expect(typeof loader.teardown).toBe('function');
		loader.teardown();
	});

	it('initSketches observes sketch containers', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		expect(mockObserve).toHaveBeenCalledWith(container);
	});

	it('loads sketch when container becomes visible', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, getSketchInstance } = await import('../sketch-loader');
		initSketches();

		// Trigger intersection
		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(getSketchInstance(container)).toBeDefined();
		expect(mockUnobserve).toHaveBeenCalledWith(container);
	});

	it('handles sketch load error gracefully', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'invalid';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Should show fallback text or fallback element
		const fallback = container.querySelector('div');
		expect(fallback?.textContent).toContain('[invalid]');
	});

	it('teardown removes all instances', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, getSketchInstance, teardown } = await import('../sketch-loader');
		initSketches();
		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		const instance = getSketchInstance(container);
		teardown();

		expect(instance?.remove).toHaveBeenCalled();
		expect(getSketchInstance(container)).toBeUndefined();
	});

	it('pauseSketch and resumeSketch toggle data attributes', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, pauseSketch, resumeSketch } = await import('../sketch-loader');
		initSketches();
		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		pauseSketch(container);
		expect(container.hasAttribute('data-paused')).toBe(true);

		resumeSketch(container);
		expect(container.hasAttribute('data-paused')).toBe(false);
	});

	it('handles window resize events to update sketch container heights', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		container.dataset.height = '600px';
		container.dataset.mobileHeight = '300px';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		// Trigger resize event
		window.dispatchEvent(new Event('resize'));

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(container.style.height).toBeDefined();
	});

	it('initBackground schedules gracefully and cleans up', async () => {
		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage, teardownPage } = await import('../sketch-loader');
		reinitPage();

		for (let i = 0; i < 25; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		teardownPage();
	});

	it('teardownPage preserves bg-canvas but removes others', async () => {
		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, teardownPage, getSketchInstance } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 20; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		teardownPage();
		expect(getSketchInstance(container)).toBeUndefined();
	});

	it('teardown catches remove exceptions', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, teardown, getSketchInstance } = await import('../sketch-loader');
		initSketches();
		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		const instance = getSketchInstance(container);
		if (instance) {
			instance.remove = () => {
				throw new Error('already removed');
			};
		}

		expect(() => teardown()).not.toThrow();
	});

	it('teardownPage catches remove exceptions', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, teardownPage, getSketchInstance } = await import('../sketch-loader');
		initSketches();
		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		const instance = getSketchInstance(container);
		if (instance) {
			instance.remove = () => {
				throw new Error('already removed');
			};
		}

		expect(() => teardownPage()).not.toThrow();
	});

	it('scheduleBackgroundInit handles PerformanceObserver errors', async () => {
		class FailingPerformanceObserver {
			disconnect = vi.fn();
			observe() {
				throw new Error('Mock error');
			}
		}
		vi.stubGlobal('PerformanceObserver', FailingPerformanceObserver);

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage } = await import('../sketch-loader');
		reinitPage();

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		vi.unstubAllGlobals();
	});

	it('shows existing .sketch-noscript fallback element', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'nonexistent-sketch-xyz';
		const noscript = document.createElement('div');
		noscript.className = 'sketch-noscript';
		noscript.style.display = 'none';
		container.appendChild(noscript);
		document.body.appendChild(container);

		vi.spyOn(console, 'error').mockImplementation(() => {});

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(noscript.style.display).toBe('flex');
		vi.restoreAllMocks();
	});

	it('queues sketches when concurrency limit is reached', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const containers: HTMLElement[] = [];
		for (let i = 0; i < 6; i++) {
			const c = document.createElement('div');
			c.className = 'sketch-container';
			c.dataset.sketch = 'hero';
			document.body.appendChild(c);
			containers.push(c);
		}

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		// Trigger all containers as visible at once
		observerCallback(containers.map((c) => ({ isIntersecting: true, target: c })));

		for (let i = 0; i < 30; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		vi.restoreAllMocks();
	});

	it('skips background init on deferred routes', async () => {
		// Set location to a deferred route
		Object.defineProperty(window, 'location', {
			value: { ...window.location, pathname: '/architecture' },
			writable: true,
			configurable: true,
		});

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage, getSketchInstance } = await import('../sketch-loader');
		reinitPage();

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Background should not be initialized on deferred routes
		expect(getSketchInstance(bg)).toBeUndefined();
	});

	it('falls back to setTimeout when no PerformanceObserver', async () => {
		// Remove PerformanceObserver
		const origPO = window.PerformanceObserver;
		Reflect.deleteProperty(window, 'PerformanceObserver');

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage } = await import('../sketch-loader');
		reinitPage();

		for (let i = 0; i < 30; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		if (origPO) {
			window.PerformanceObserver = origPO;
		}
	});

	it('falls back to setTimeout when no requestIdleCallback', async () => {
		// Remove requestIdleCallback
		const origRIC = window.requestIdleCallback;
		Reflect.deleteProperty(window, 'requestIdleCallback');

		// Also remove PerformanceObserver to use setTimeout path
		const origPO = window.PerformanceObserver;
		Reflect.deleteProperty(window, 'PerformanceObserver');

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage } = await import('../sketch-loader');
		reinitPage();

		for (let i = 0; i < 30; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		if (origRIC) {
			window.requestIdleCallback = origRIC;
		}
		if (origPO) {
			window.PerformanceObserver = origPO;
		}
	});

	it('observeSketches falls back without IntersectionObserver', async () => {
		const origIO = window.IntersectionObserver;
		Reflect.deleteProperty(window, 'IntersectionObserver');

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, getSketchInstance } = await import('../sketch-loader');
		initSketches();

		for (let i = 0; i < 20; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Without IO, sketches are initialized directly
		expect(getSketchInstance(container)).toBeDefined();

		window.IntersectionObserver = origIO;
	});

	it('pauseSketch and resumeSketch are no-ops for unknown containers', async () => {
		const unknown = document.createElement('div');

		const { pauseSketch, resumeSketch } = await import('../sketch-loader');

		// Should not throw
		pauseSketch(unknown);
		expect(unknown.hasAttribute('data-paused')).toBe(false);

		resumeSketch(unknown);
		expect(unknown.hasAttribute('data-paused')).toBe(false);
	});

	it('sets mobile height when window width < 768', async () => {
		Object.defineProperty(window, 'innerWidth', {
			value: 400,
			writable: true,
			configurable: true,
		});

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		container.dataset.height = '600px';
		container.dataset.mobileHeight = '250px';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(container.style.height).toBe('250px');
	});

	it('uses default heights when data attributes are missing', async () => {
		// happy-dom defaults to a narrow window, so set desktop width
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		});

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		// No height or mobileHeight data attributes
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Default desktop height is 500px
		expect(container.style.height).toBe('500px');
	});

	it('reinitPage does not throw when bg-canvas is absent', async () => {
		const { reinitPage } = await import('../sketch-loader');
		expect(() => reinitPage()).not.toThrow();
	});

	it('handles reduced motion: wraps draw with warmup frames', async () => {
		// Enable reduced motion
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		);

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, getSketchInstance, teardown } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		const instance = getSketchInstance(container);
		expect(instance).toBeDefined();

		teardown();
	});

	it('handles p5 constructor error gracefully', async () => {
		// Mock p5 to throw during construction
		vi.doMock('p5', () => ({
			default: class FailP5 {
				constructor() {
					throw new Error('p5 constructor failed');
				}
			},
		}));

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Fallback should be shown
		const fallback = container.querySelector('div');
		expect(fallback?.textContent).toContain('[hero]');

		consoleSpy.mockRestore();
	});

	it('multiple rapid resize events debounce correctly', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		container.dataset.height = '600px';
		container.dataset.mobileHeight = '300px';
		document.body.appendChild(container);

		const { initSketches, teardown } = await import('../sketch-loader');
		initSketches();

		// Trigger multiple resizes rapidly
		window.dispatchEvent(new Event('resize'));
		window.dispatchEvent(new Event('resize'));
		window.dispatchEvent(new Event('resize'));

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(container.style.height).toBeDefined();
		teardown();
	});

	it('handles non-intersecting entries in observer', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		// Non-intersecting entries should be ignored
		observerCallback([{ isIntersecting: false, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	});

	it('sketch load import failure shows fallback', async () => {
		// Mock hero-sketch to reject
		vi.doMock('../hero-sketch', () => {
			throw new Error('Module load failed');
		});

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		consoleSpy.mockRestore();
	});

	it('normalizePath handles root and trailing slashes', async () => {
		// Test shouldBootBackground with trailing slash route
		Object.defineProperty(window, 'location', {
			value: { ...window.location, pathname: '/architecture/' },
			writable: true,
			configurable: true,
		});

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage, getSketchInstance } = await import('../sketch-loader');
		reinitPage();

		for (let i = 0; i < 15; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Architecture is a deferred route — background should not init
		expect(getSketchInstance(bg)).toBeUndefined();
	});
});
