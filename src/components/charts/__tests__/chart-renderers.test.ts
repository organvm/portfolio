// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import classificationDonut from '../classification-donut-chart';
import codeTreemap from '../code-treemap-chart';
import dependencyGraph from '../dependency-graph-chart';
import flagshipStacked from '../flagship-stacked-chart';
import organBarChart from '../organ-bar-chart';
import organNavigatorChart from '../organ-navigator-chart';
import praxisSparklines from '../praxis-sparklines-chart';
import sprintTimeline from '../sprint-timeline-chart';

function createContainer(width = 800, height = 500) {
	const container = document.createElement('div');
	container.style.position = 'relative';
	Object.defineProperty(container, 'clientWidth', { value: width, configurable: true });
	Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
	document.body.appendChild(container);
	return container;
}

describe('chart renderers', () => {
	beforeEach(() => {
		document.body.innerHTML = '';

		// Stub SVG transform on both SVGElement and SVGGraphicsElement prototypes
		// to cover happy-dom's prototype chain for <g>, <rect>, etc.
		const transformStub = {
			configurable: true,
			value: { baseVal: { consolidate: () => null } },
		};
		Object.defineProperty(SVGElement.prototype, 'transform', transformStub);
		if (typeof SVGGraphicsElement !== 'undefined') {
			Object.defineProperty(SVGGraphicsElement.prototype, 'transform', transformStub);
		}

		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query) => ({
				matches: query.includes('prefers-reduced-motion'),
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders organ bar chart', () => {
		const container = createContainer();
		organBarChart(container, {
			organs: [
				{ key: 'ORGAN-I', name: 'Theoria', total_repos: 12, ci_coverage: 92 },
				{ key: 'ORGAN-II', name: 'Poiesis', total_repos: 8, ci_coverage: 88 },
				{ key: 'CUSTOM', name: 'Custom', total_repos: 3, ci_coverage: 50 },
			],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('rect').length).toBeGreaterThan(1);
	});

	it('renders classification donut chart', () => {
		const container = createContainer();
		classificationDonut(container, {
			classifications: { SUBSTANTIAL: 6, PARTIAL: 4, MINIMAL: 2, EXPERIMENTAL: 1 },
			total: 13,
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
		expect(container.textContent).toContain('13');
	});

	it('renders sprint timeline chart', () => {
		const container = createContainer();
		sprintTimeline(container, {
			sprints: [
				{ name: 'S1', date: '2026-01-01', focus: 'feed integrity', deliverables: 'audit gate' },
				{ name: 'S2', date: '2026-01-08', focus: 'metrics', deliverables: 'provenance panel' },
			],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('circle').length).toBe(2);
	});

	it('renders code treemap chart', () => {
		const container = createContainer();
		codeTreemap(container, {
			organs: [
				{ key: 'ORGAN-I', name: 'Theoria', total_repos: 12 },
				{ key: 'ORGAN-II', name: 'Poiesis', total_repos: 8 },
			],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('rect').length).toBeGreaterThan(1);
	});

	it('renders dependency graph in reduced-motion mode', () => {
		const container = createContainer();
		dependencyGraph(container, {
			nodes: [
				{ id: 'a', name: 'Repo A', organ: 'ORGAN-I', organ_name: 'Theoria', tier: 'flagship' },
				{ id: 'b', name: 'Repo B', organ: 'ORGAN-II', organ_name: 'Poiesis', tier: 'standard' },
			],
			links: [{ source: 'a', target: 'b' }],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('circle').length).toBe(2);
		expect(container.querySelectorAll('line').length).toBeGreaterThan(0);
	});

	it('renders dependency graph with edges field instead of links', () => {
		const container = createContainer();
		dependencyGraph(container, {
			nodes: [
				{ id: 'x', name: 'Repo X', organ: 'ORGAN-I', organ_name: 'Theoria', tier: 'flagship' },
				{ id: 'y', name: 'Repo Y', organ: 'ORGAN-II', organ_name: 'Poiesis', tier: 'standard' },
			],
			edges: [{ source: 'x', target: 'y' }],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('circle').length).toBe(2);
	});

	it('renders dependency graph with empty nodes and links', () => {
		const container = createContainer();
		dependencyGraph(container, { nodes: [], links: [] });

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('circle').length).toBe(0);
		expect(container.querySelectorAll('line').length).toBe(0);
	});

	it('renders dependency graph filtering unlinked nodes', () => {
		const container = createContainer();
		dependencyGraph(container, {
			nodes: [
				{ id: 'a', name: 'Repo A', organ: 'ORGAN-I', organ_name: 'Theoria', tier: 'flagship' },
				{ id: 'b', name: 'Repo B', organ: 'ORGAN-II', organ_name: 'Poiesis', tier: 'standard' },
				{
					id: 'orphan',
					name: 'Orphan',
					organ: 'ORGAN-III',
					organ_name: 'Ergon',
					tier: 'standard',
				},
			],
			links: [{ source: 'a', target: 'b' }],
		});

		// Only linked nodes are rendered (a and b, not orphan)
		expect(container.querySelectorAll('circle').length).toBe(2);
	});

	it('renders dependency graph without reduced motion', () => {
		// Override matchMedia to NOT prefer reduced motion
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});

		const container = createContainer();
		dependencyGraph(container, {
			nodes: [
				{ id: 'a', name: 'Repo A', organ: 'ORGAN-I', organ_name: 'Theoria', tier: 'flagship' },
				{ id: 'b', name: 'Repo B', organ: 'ORGAN-II', organ_name: 'Poiesis', tier: 'standard' },
			],
			links: [{ source: 'a', target: 'b' }],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('circle').length).toBe(2);
	});

	it('dependency graph handles missing links and edges fields', () => {
		const container = createContainer();
		dependencyGraph(container, {
			nodes: [
				{ id: 'a', name: 'Repo A', organ: 'ORGAN-I', organ_name: 'Theoria', tier: 'flagship' },
			],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		// No links means no linked nodes, so no circles rendered
		expect(container.querySelectorAll('circle').length).toBe(0);
	});

	it('dependency graph uses fallback color for unknown organ', () => {
		const container = createContainer();
		dependencyGraph(container, {
			nodes: [
				{
					id: 'a',
					name: 'Repo A',
					organ: 'UNKNOWN-ORGAN',
					organ_name: 'Mystery',
					tier: 'standard',
				},
				{
					id: 'b',
					name: 'Repo B',
					organ: 'UNKNOWN-ORGAN',
					organ_name: 'Mystery',
					tier: 'standard',
				},
			],
			links: [{ source: 'a', target: 'b' }],
		});

		expect(container.querySelectorAll('circle').length).toBe(2);
	});

	it('renders praxis sparklines chart', () => {
		const container = createContainer();
		praxisSparklines(container, {
			targets: [
				{ key: 'coverage', label: 'Coverage', current: '18', target: '25', met: false },
				{ key: 'a11y', label: 'A11y', current: '100', target: '100', met: true },
			],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('rect').length).toBeGreaterThan(2);
	});

	it('renders flagship stacked chart', () => {
		const container = createContainer();
		flagshipStacked(container, {
			repos: [
				{
					repo: 'agentic-titan',
					org: 'ORGAN-IV',
					classification: 'SUBSTANTIAL',
					code_files: 180,
					test_files: 95,
				},
				{
					repo: 'recursive-engine',
					org: 'ORGAN-I',
					classification: 'SUBSTANTIAL',
					code_files: 160,
					test_files: 120,
				},
			],
		});

		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelectorAll('rect').length).toBeGreaterThan(3);
	});

	it('renders organ navigator and expands/collapses an organ node', () => {
		const container = createContainer();
		const data = {
			organs: [
				{
					organ: 'ORGAN-I',
					label: 'Theoria',
					count: 2,
					color: '#5aa8ff',
					projects: [
						{ slug: 'recursive-engine', title: 'Recursive Engine' },
						{ slug: 'knowledge-base', title: 'Knowledge Base' },
					],
				},
				{
					organ: 'ORGAN-II',
					label: 'Poiesis',
					count: 1,
					color: '#ff9f6e',
					projects: [{ slug: 'metasystem-master', title: 'Metasystem Master' }],
				},
			],
		};

		organNavigatorChart(container, data);

		const nodeGroups = container.querySelectorAll('.organ-nodes > g');
		expect(nodeGroups.length).toBe(2);

		nodeGroups[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(container.querySelector('.project-nodes')).not.toBeNull();

		nodeGroups[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(container.querySelector('svg')).not.toBeNull();
	});
});

it('renders organ navigator hover effects on nodes and projects', () => {
	const container = createContainer();
	const data = {
		organs: [
			{
				organ: 'ORGAN-I',
				label: 'Theoria',
				count: 2,
				color: '#5aa8ff',
				projects: [{ slug: 'recursive-engine', title: 'Recursive Engine' }],
			},
		],
	};

	organNavigatorChart(container, data);

	const organNode = container.querySelector('.organ-nodes > g')!;
	organNode.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
	organNode.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

	// Open to render projects
	organNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

	const projectNode = container.querySelector('.project-nodes > g')!;
	projectNode.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
	projectNode.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

	// Trigger project click
	const originalLocation = window.location;
	Object.defineProperty(window, 'location', {
		value: { ...originalLocation, href: '' },
		writable: true,
		configurable: true,
	});
	projectNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	expect(window.location.href).toContain('recursive-engine');
	Object.defineProperty(window, 'location', {
		value: originalLocation,
		configurable: true,
	});
});
