const chartModules = {
	'organ-bar': () => import('./organ-bar-chart'),
	'classification-donut': () => import('./classification-donut-chart'),
	'sprint-timeline': () => import('./sprint-timeline-chart'),
	'code-treemap': () => import('./code-treemap-chart'),
	'dependency-graph': () => import('./dependency-graph-chart'),
	'praxis-sparklines': () => import('./praxis-sparklines-chart'),
	'flagship-stacked': () => import('./flagship-stacked-chart'),
	'organ-navigator': () => import('./organ-navigator-chart'),
} as const;

type ChartId = keyof typeof chartModules;

const initialized = new Set<HTMLElement>();
const visible = new Set<HTMLElement>();
const stale = new Set<HTMLElement>();

let intersectionObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function isChartId(value: string): value is ChartId {
	return value in chartModules;
}

function parseChartPayload(raw: string | undefined, chartId: string): unknown {
	try {
		return JSON.parse(raw ?? '{}') as unknown;
	} catch (err) {
		console.error('[chart]', chartId, 'invalid chart payload:', err);
		return {};
	}
}

function readChartData(container: HTMLElement, chartId: string): unknown {
	const dataEl = container.querySelector('script[type="application/json"]');
	if (dataEl) {
		return parseChartPayload(dataEl.textContent ?? '{}', chartId);
	}
	return parseChartPayload(container.dataset.chartData, chartId);
}

function initChart(container: HTMLElement) {
	if (initialized.has(container)) return;
	initialized.add(container);
	stale.delete(container);

	const chartId = container.dataset.chart;
	if (!chartId || !isChartId(chartId)) return;

	const data = readChartData(container, chartId);

	chartModules[chartId]()
		.then((mod) => {
			const init = mod.default as (host: HTMLElement, payload: unknown) => void;
			init(container, data);
		})
		.catch((err) => {
			console.error('[chart]', chartId, 'load error:', err);
		});
}

function removeChart(container: HTMLElement) {
	const svg = container.querySelector('svg');
	if (svg) svg.remove();
	container.querySelectorAll('.chart-tooltip').forEach((t) => t.remove());
	initialized.delete(container);
}

function observeCharts() {
	const containers = document.querySelectorAll<HTMLElement>('[data-chart]');

	if ('IntersectionObserver' in window) {
		intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const el = entry.target as HTMLElement;
					if (entry.isIntersecting) {
						visible.add(el);
						if (stale.has(el)) {
							removeChart(el);
							initChart(el);
						} else {
							initChart(el);
						}
					} else {
						visible.delete(el);
					}
				});
			},
			{ rootMargin: '200px' },
		);
		containers.forEach((c) => intersectionObserver!.observe(c));
	} else {
		containers.forEach(initChart);
	}
}

// Re-render charts when S/B/E mode or theme changes (debounced)
function watchModeChanges() {
	const rerender = () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			initialized.forEach((container) => {
				if (visible.has(container)) {
					removeChart(container);
					initChart(container);
				} else {
					stale.add(container);
				}
			});
		}, 300);
	};

	mutationObserver = new MutationObserver(rerender);

	// Watch theme on html element
	mutationObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});
}

/** Clean up all charts, observers, and state. Call before DOM replacement (View Transitions). */
export function teardown() {
	clearTimeout(debounceTimer);
	initialized.forEach(removeChart);
	initialized.clear();
	visible.clear();
	stale.clear();
	intersectionObserver?.disconnect();
	intersectionObserver = null;
	mutationObserver?.disconnect();
	mutationObserver = null;
}

function init() {
	observeCharts();
	watchModeChanges();
}

// View Transition lifecycle
document.addEventListener('astro:before-swap', () => teardown());
document.addEventListener('astro:page-load', () => init());
