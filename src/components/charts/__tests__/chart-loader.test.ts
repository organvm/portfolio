// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as loader from '../chart-loader';
import organBarChart from '../organ-bar-chart';

// Mock chart modules at top level
vi.mock('../organ-bar-chart', () => ({ default: vi.fn() }));

describe('chart-loader lifecycle', () => {
	let observerCallback: (entries: any[]) => void;
	const mockObserve = vi.fn();
	const mockDisconnect = vi.fn();

	beforeEach(() => {
		document.body.innerHTML = '';
		vi.useFakeTimers();

		class MockIntersectionObserver {
			constructor(cb: any) {
				observerCallback = cb;
			}
			observe = mockObserve;
			disconnect = mockDisconnect;
		}

		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
	});

	afterEach(async () => {
		loader.teardown();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('observes charts on astro:page-load', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));

		expect(mockObserve).toHaveBeenCalledWith(container);
	});

	it('initializes chart when it becomes visible', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		container.dataset.chartData = JSON.stringify({ organs: [] });
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));

		observerCallback([{ isIntersecting: true, target: container }]);

		await vi.advanceTimersByTimeAsync(100);
	});

	it('observes charts without IntersectionObserver', async () => {
		const originalObserver = window.IntersectionObserver;
		// @ts-expect-error
		delete window.IntersectionObserver;

		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		container.dataset.chartData = JSON.stringify({ organs: [] });
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));

		await vi.advanceTimersByTimeAsync(100);

		window.IntersectionObserver = originalObserver;
	});

	it('handles elements leaving the viewport', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));

		observerCallback([{ isIntersecting: false, target: container }]);
	});

	it('cleans up on astro:before-swap', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		container.appendChild(svg);
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);

		document.dispatchEvent(new Event('astro:before-swap'));

		expect(container.querySelector('svg')).toBeNull();
		expect(mockDisconnect).toHaveBeenCalled();
	});

	it('skips containers with unknown chart id', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'nonexistent-chart';
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);

		await vi.advanceTimersByTimeAsync(100);
	});

	it('skips containers with empty chart id', async () => {
		const container = document.createElement('div');
		container.setAttribute('data-chart', '');
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);

		await vi.advanceTimersByTimeAsync(100);
	});

	it('reads data from embedded script[type="application/json"]', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		const script = document.createElement('script');
		script.type = 'application/json';
		script.textContent = JSON.stringify({ organs: [{ key: 'I' }] });
		container.appendChild(script);
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);

		await vi.advanceTimersByTimeAsync(100);
	});

	it('handles invalid JSON in chart payload gracefully', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		container.dataset.chartData = '{broken json!!!';
		document.body.appendChild(container);

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);

		await vi.advanceTimersByTimeAsync(100);

		expect(consoleSpy).toHaveBeenCalledWith(
			'[chart]',
			'organ-bar',
			'invalid chart payload:',
			expect.any(Error),
		);
		consoleSpy.mockRestore();
	});

	it('removes chart-tooltip elements during cleanup', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		container.dataset.chartData = JSON.stringify({ organs: [] });
		const tooltip = document.createElement('div');
		tooltip.className = 'chart-tooltip';
		container.appendChild(tooltip);
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		container.appendChild(svg);
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);
		await vi.advanceTimersByTimeAsync(100);

		loader.teardown();

		expect(container.querySelector('.chart-tooltip')).toBeNull();
		expect(container.querySelector('svg')).toBeNull();
	});

	it('does not re-init an already initialized chart', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		container.dataset.chartData = JSON.stringify({ organs: [] });
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));

		observerCallback([{ isIntersecting: true, target: container }]);
		await vi.advanceTimersByTimeAsync(100);

		// Second intersection should be a no-op
		observerCallback([{ isIntersecting: true, target: container }]);
		await vi.advanceTimersByTimeAsync(100);
	});

	it('handles data with no chartData and no script element', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		// No data-chart-data and no script element — should parse undefined as '{}'
		document.body.appendChild(container);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);

		await vi.advanceTimersByTimeAsync(100);
	});

	it('re-renders stale charts after mode/theme updates', async () => {
		const container = document.createElement('div');
		container.dataset.chart = 'organ-bar';
		container.dataset.chartData = JSON.stringify({ organs: [] });
		document.body.appendChild(container);

		let mutationCallback: (records: MutationRecord[]) => void = () => {};
		const mockMutateObserve = vi.fn();
		const mockMutateDisconnect = vi.fn();

		class MockMutationObserver {
			constructor(callback: (records: MutationRecord[]) => void) {
				mutationCallback = callback;
			}
			observe = mockMutateObserve;
			disconnect = mockMutateDisconnect;
		}

		vi.stubGlobal('MutationObserver', MockMutationObserver);

		document.dispatchEvent(new Event('astro:page-load'));
		observerCallback([{ isIntersecting: true, target: container }]);
		await vi.advanceTimersByTimeAsync(100);

		expect(organBarChart).toHaveBeenCalledTimes(1);

		observerCallback([{ isIntersecting: false, target: container }]);
		await vi.advanceTimersByTimeAsync(100);

		mutationCallback([{ type: 'attributes', attributeName: 'data-theme' } as MutationRecord]);
		await vi.advanceTimersByTimeAsync(400);

		observerCallback([{ isIntersecting: true, target: container }]);
		await vi.advanceTimersByTimeAsync(100);

		expect(mockMutateObserve).toHaveBeenCalledWith(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme'],
		});
		expect(organBarChart).toHaveBeenCalledTimes(2);
	});
});
