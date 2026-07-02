// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import pipelineSketch from '../pipeline-sketch';

interface CircleCall {
	x: number;
	y: number;
	d: number;
}

function createContainer(width: number, height: number): HTMLDivElement {
	const container = document.createElement('div');
	Object.defineProperty(container, 'clientWidth', {
		value: width,
		configurable: true,
	});
	Object.defineProperty(container, 'clientHeight', {
		value: height,
		configurable: true,
	});
	return container;
}

function createMockP5(width: number, height: number) {
	const textCalls: any[] = [];
	const circleCalls: CircleCall[] = [];

	const p: Record<string, any> = {
		width: 0,
		height: 0,
		mouseX: 0,
		mouseY: 0,
		touches: [],
		createCanvas: vi.fn((w: number, h: number) => {
			p.width = w;
			p.height = h;
		}),
		frameRate: vi.fn(),
		clear: vi.fn(),
		stroke: vi.fn(),
		strokeWeight: vi.fn(),
		noFill: vi.fn(),
		erase: vi.fn(),
		noErase: vi.fn(),
		rect: vi.fn(),
		line: vi.fn(),
		fill: vi.fn(),
		noStroke: vi.fn(),
		textFont: vi.fn(),
		textSize: vi.fn(),
		textAlign: vi.fn(),
		text: vi.fn((...args: any[]) => {
			textCalls.push(args);
		}),
		circle: vi.fn((x: number, y: number, d: number) => {
			circleCalls.push({ x, y, d });
		}),
		dist: vi.fn((x1: number, y1: number, x2: number, y2: number) =>
			Math.hypot(x1 - x2, y1 - y2),
		),
		resizeCanvas: vi.fn((w: number, h: number) => {
			p.width = w;
			p.height = h;
		}),
		createGraphics: vi.fn(),
		loadImage: vi.fn(),
		smooth: vi.fn(),
		frameCount: 0,
	};

	p.createCanvas(width, height);
	return { p, textCalls, circleCalls };
}

function collectTextStrings(textCalls: any[]): string[] {
	return textCalls
		.map((call) => call[0])
		.filter((value): value is string => typeof value === 'string');
}

function assertHasFailureReason(strings: string[]) {
	const failureReasons = [
		'Onboarding too complex',
		'Free tier insufficient',
		'Wrong sales channel',
		'Content inconsistency',
		'Setup time: 2-3 hours',
		'Price point mismatch',
	];
	expect(strings.some((value) => failureReasons.includes(value))).toBe(true);
}

describe('pipelineSketch', () => {
	it('initializes with default chambers and renders the default labels', () => {
		const container = createContainer(920, 260);
		const { p, textCalls } = createMockP5(920, 260);

		pipelineSketch(p, container);
		p.setup();
		p.draw();

		expect(p.createCanvas).toHaveBeenCalledWith(920, 260);
		expect(p.frameRate).toHaveBeenCalledWith(30);
		const textValues = collectTextStrings(textCalls);

		expect(textValues).toContain('Theory');
		expect(textValues).toContain('Art');
		expect(textValues).toContain('Commerce');
		expect(textValues).toContain('I');
		expect(textValues).toContain('II');
		expect(textValues).toContain('III');
		expect(textValues.some((value) => value.includes('pass'))).toBe(false);
	});

	it('parses custom chamber metadata and shows hover rates', () => {
		const container = createContainer(1000, 240);
		container.dataset.chambers = 'North,South,East,West';
		container.dataset.counts = '14,9,4,3';
		const { p, textCalls } = createMockP5(1000, 240);

		pipelineSketch(p, container);
		p.setup();

		p.mouseX = 375;
		p.mouseY = 100;
		p.draw();

		const textValues = collectTextStrings(textCalls);
		expect(textValues).toContain('IV');
		expect(textValues).toContain('North');
		expect(textValues).toContain('West');
		expect(textValues.some((value) => value.includes('% pass'))).toBe(true);
	});

	it('creates sediment on particle failure and surfaces a reason on click', () => {
		const container = createContainer(920, 220);
		container.dataset.chambers = 'Single';
		container.dataset.counts = '1';
		const { p, textCalls, circleCalls } = createMockP5(920, 220);

		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
		pipelineSketch(p, container);
		p.setup();

		let sediment: CircleCall | null = null;
		for (let i = 0; i < 120; i++) {
			p.draw();
			const newlyLogged = circleCalls.find((call) => call.d === 3);
			if (newlyLogged) {
				sediment = newlyLogged;
				break;
			}
		}

		expect(sediment).not.toBeNull();
		expect(p.circle).toHaveBeenCalled();

		p.mouseX = sediment!.x;
		p.mouseY = sediment!.y;
		const beforeClickTextCount = textCalls.length;
		p.mousePressed();
		p.draw();

		const postClickText = collectTextStrings(textCalls.slice(beforeClickTextCount));
		assertHasFailureReason(postClickText);
		randomSpy.mockRestore();
	});

	it('re-sizes the canvas when the container window is resized', () => {
		const container = createContainer(900, 210);
		const { p } = createMockP5(900, 210);

		pipelineSketch(p, container);
		p.setup();

		Object.defineProperty(container, 'clientWidth', {
			value: 1120,
			configurable: true,
		});
		Object.defineProperty(container, 'clientHeight', {
			value: 420,
			configurable: true,
		});
		p.windowResized();

		expect(p.resizeCanvas).toHaveBeenCalledWith(1120, 420);
	});
});
