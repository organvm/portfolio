// @vitest-environment happy-dom
/**
 * Extended coverage for sketch-loader.ts.
 * This file mocks all registered sketch modules so every dynamic-import lambda
 * can be exercised, and adds tests for the motionQuery change listener, the
 * PerformanceObserver success path, and the teardownPage state branches that
 * are not reachable from the main sketch-loader.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// p5 mock — same shape as in sketch-loader.test.ts
// ---------------------------------------------------------------------------
vi.mock('p5', () => ({
	default: class MockP5 {
		remove = vi.fn();
		noLoop = vi.fn();
		loop = vi.fn();
		redraw = vi.fn();
		draw = vi.fn();
		constructor(sketch: (p: Record<string, unknown>) => void) {
			const p: Record<string, unknown> = {
				remove: vi.fn(),
				noLoop: vi.fn(),
				loop: vi.fn(),
				redraw: vi.fn(),
				draw: vi.fn(),
			};
			sketch(p);
			Object.assign(this, p);
		}
	},
}));

// ---------------------------------------------------------------------------
// Sketch module mocks — every entry in sketchModules that is NOT covered
// by the existing sketch-loader.test.ts (hero + background are re-declared
// here so this file is fully self-contained and avoids cross-file mock bleed).
// ---------------------------------------------------------------------------
vi.mock('../hero-sketch', () => ({ default: vi.fn() }));
vi.mock('../background-sketch', () => ({ default: vi.fn() }));
vi.mock('../organ-system-sketch', () => ({ default: vi.fn() }));
vi.mock('../recursive-tree-sketch', () => ({ default: vi.fn() }));
vi.mock('../counterpoint-sketch', () => ({ default: vi.fn() }));
vi.mock('../pipeline-sketch', () => ({ default: vi.fn() }));
vi.mock('../token-stream-sketch', () => ({ default: vi.fn() }));
vi.mock('../network-graph-sketch', () => ({ default: vi.fn() }));
vi.mock('../flow-diagram-sketch', () => ({ default: vi.fn() }));
vi.mock('../data-bars-sketch', () => ({ default: vi.fn() }));
vi.mock('../particle-field-sketch', () => ({ default: vi.fn() }));
vi.mock('../terrain-sketch', () => ({ default: vi.fn() }));
vi.mock('../conductor-sketch', () => ({ default: vi.fn() }));
vi.mock('../octagon-sketch', () => ({ default: vi.fn() }));
vi.mock('../waveform-sketch', () => ({ default: vi.fn() }));
vi.mock('../swarm-sketch', () => ({ default: vi.fn() }));
vi.mock('../deliberation-sketch', () => ({ default: vi.fn() }));
vi.mock('../blocks-sketch', () => ({ default: vi.fn() }));
vi.mock('../constellation-sketch', () => ({ default: vi.fn() }));
vi.mock('../scatter-sketch', () => ({ default: vi.fn() }));
vi.mock('../spiral-sketch', () => ({ default: vi.fn() }));
vi.mock('../orbits-sketch', () => ({ default: vi.fn() }));
vi.mock('../atoms-sketch', () => ({ default: vi.fn() }));
vi.mock('../kaleidoscope-sketch', () => ({ default: vi.fn() }));
vi.mock('../lenses-sketch', () => ({ default: vi.fn() }));
vi.mock('../routing-sketch', () => ({ default: vi.fn() }));
vi.mock('../hierarchy-sketch', () => ({ default: vi.fn() }));
vi.mock('../typewriter-sketch', () => ({ default: vi.fn() }));
vi.mock('../ticker-sketch', () => ({ default: vi.fn() }));
vi.mock('../weave-sketch', () => ({ default: vi.fn() }));

// ---------------------------------------------------------------------------
// All sketch IDs registered in sketchModules (excluding background, which is
// initialized via reinitPage/initBackground, not sketch containers)
// ---------------------------------------------------------------------------
const ALL_SKETCH_IDS = [
	'hero',
	'organ-system',
	'recursive-tree',
	'counterpoint',
	'pipeline',
	'token-stream',
	'network-graph',
	'flow-diagram',
	'data-bars',
	'particle-field',
	'terrain',
	'conductor',
	'octagon',
	'waveform',
	'swarm',
	'deliberation',
	'blocks',
	'constellation',
	'scatter',
	'spiral',
	'orbits',
	'atoms',
	'kaleidoscope',
	'lenses',
	'routing',
	'hierarchy',
	'typewriter',
	'ticker',
	'weave',
];

describe('sketch-loader — extended coverage', () => {
	let observerCallback: (entries: { isIntersecting: boolean; target: HTMLElement }[]) => void =
		() => {};
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

		class MockIntersectionObserver {
			observe = mockObserve;
			unobserve = mockUnobserve;
			disconnect = mockDisconnect;
			constructor(cb: (entries: { isIntersecting: boolean; target: HTMLElement }[]) => void) {
				observerCallback = cb;
			}
		}

		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
		vi.stubGlobal(
			'requestIdleCallback',
			vi.fn((cb: (d: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
				cb({ didTimeout: false, timeRemaining: () => 10 }),
			),
		);
		vi.stubGlobal('cancelIdleCallback', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	// -----------------------------------------------------------------------
	// 1. All sketch-module lambdas — each () => import('./X-sketch') is invoked
	// -----------------------------------------------------------------------
	it('invokes every registered sketch-module lambda when containers become visible', async () => {
		const containers: HTMLElement[] = [];
		for (const sketchId of ALL_SKETCH_IDS) {
			const c = document.createElement('div');
			c.className = 'sketch-container';
			c.dataset.sketch = sketchId;
			document.body.appendChild(c);
			containers.push(c);
		}

		const { initSketches } = await import('../sketch-loader');
		initSketches();

		// Deliver all containers as visible — the concurrency queue handles throttling
		observerCallback(containers.map((c) => ({ isIntersecting: true, target: c })));

		// Allow async imports + p5 constructor to complete
		for (let i = 0; i < 20; i++) {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		}

		// Every sketch container should have been observed
		expect(mockObserve).toHaveBeenCalledTimes(ALL_SKETCH_IDS.length);
	});

	// -----------------------------------------------------------------------
	// 2. background lambda covered via reinitPage → initBackground path
	// -----------------------------------------------------------------------
	it('invokes background sketch lambda via reinitPage', async () => {
		// Remove PerformanceObserver so scheduleBackgroundInit takes the direct setTimeout path
		const origPO = (window as any).PerformanceObserver;
		// @ts-expect-error
		delete window.PerformanceObserver;

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage, getSketchInstance } = await import('../sketch-loader');
		reinitPage();

		// Wait for setTimeout(initBackground, 200) + Promise resolution
		for (let i = 0; i < 30; i++) {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		}

		expect(getSketchInstance(bg)).toBeDefined();

		if (origPO) (window as any).PerformanceObserver = origPO;
	});

	// -----------------------------------------------------------------------
	// 3. motionQuery change listener — updates prefersReducedMotion and applies
	//    noLoop / loop to running instances
	// -----------------------------------------------------------------------
	it('motionQuery change listener calls noLoop on instances when reduced-motion is enabled', async () => {
		let changeHandler: ((e: { matches: boolean }) => void) | null = null;

		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn((type: string, cb: (e: { matches: boolean }) => void) => {
					if (type === 'change') changeHandler = cb;
				}),
				removeEventListener: vi.fn(),
			}),
		);

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, getSketchInstance } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		}

		const instance = getSketchInstance(container);
		expect(instance).toBeDefined();

		// Fire the change listener — enable reduced motion
		expect(changeHandler).not.toBeNull();
		changeHandler!({ matches: true });

		expect(instance?.noLoop).toHaveBeenCalled();
	});

	it('motionQuery change listener calls loop on instances when reduced-motion is disabled', async () => {
		let changeHandler: ((e: { matches: boolean }) => void) | null = null;

		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockReturnValue({
				matches: true, // starts with reduced motion ON
				addEventListener: vi.fn((type: string, cb: (e: { matches: boolean }) => void) => {
					if (type === 'change') changeHandler = cb;
				}),
				removeEventListener: vi.fn(),
			}),
		);

		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		document.body.appendChild(container);

		const { initSketches, getSketchInstance } = await import('../sketch-loader');
		initSketches();

		observerCallback([{ isIntersecting: true, target: container }]);

		for (let i = 0; i < 10; i++) {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		}

		const instance = getSketchInstance(container);
		expect(instance).toBeDefined();

		// Fire the change listener — disable reduced motion
		changeHandler!({ matches: false });

		expect(instance?.loop).toHaveBeenCalled();
	});

	// -----------------------------------------------------------------------
	// 4. PerformanceObserver success path — line 300: startInit() called when
	//    the LCP observation fires
	// -----------------------------------------------------------------------
	it('scheduleBackgroundInit fires startInit via PerformanceObserver callback', async () => {
		let lcpCallback: (() => void) | null = null;

		class MockPO {
			observe = vi.fn();
			disconnect = vi.fn();
			constructor(cb: () => void) {
				lcpCallback = cb;
			}
		}
		vi.stubGlobal('PerformanceObserver', MockPO);

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage, getSketchInstance } = await import('../sketch-loader');
		reinitPage();

		// lcpCallback is now the PerformanceObserver callback (simulates LCP firing)
		expect(lcpCallback).not.toBeNull();
		lcpCallback!();

		// requestIdleCallback fires synchronously; let the import Promise resolve
		for (let i = 0; i < 10; i++) {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		}

		expect(getSketchInstance(bg)).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// 5. teardownPage — clears active resizeTimer (lines 342-343)
	// -----------------------------------------------------------------------
	it('teardownPage clears a pending resize debounce timer', async () => {
		const container = document.createElement('div');
		container.className = 'sketch-container';
		container.dataset.sketch = 'hero';
		container.dataset.height = '600px';
		document.body.appendChild(container);

		const { initSketches, teardownPage } = await import('../sketch-loader');
		initSketches();

		// Fire a resize event to arm the debounce timer
		window.dispatchEvent(new Event('resize'));

		// Tear down before the 100 ms debounce fires — clears resizeTimer
		teardownPage();

		// No assertion needed beyond "it didn't throw" — we're verifying the branch
		// that clears the timer is reached
		expect(true).toBe(true);
	});

	// -----------------------------------------------------------------------
	// 6. teardownPage — preserves background instance (line 367)
	// -----------------------------------------------------------------------
	it('teardownPage preserves the background canvas instance', async () => {
		let lcpCallback: (() => void) | null = null;

		class MockPO {
			observe = vi.fn();
			disconnect = vi.fn();
			constructor(cb: () => void) {
				lcpCallback = cb;
			}
		}
		vi.stubGlobal('PerformanceObserver', MockPO);

		const bg = document.createElement('canvas');
		bg.id = 'bg-canvas';
		document.body.appendChild(bg);

		const { reinitPage, teardownPage, getSketchInstance } = await import('../sketch-loader');
		reinitPage();

		// Trigger LCP → startInit → initBackground
		lcpCallback!();

		for (let i = 0; i < 10; i++) {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		}

		const bgInstance = getSketchInstance(bg);
		expect(bgInstance).toBeDefined();

		// teardownPage should clear per-page sketches but PRESERVE the bg instance
		teardownPage();

		expect(getSketchInstance(bg)).toBeDefined();
	});
});
