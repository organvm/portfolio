import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock satori — returns a minimal SVG string
vi.mock('satori', () => ({
	default: vi.fn(async (_jsx: unknown, opts: { width: number; height: number }) => {
		return `<svg width="${opts.width}" height="${opts.height}"></svg>`;
	}),
}));

// Mock resvg — returns a fake PNG buffer
vi.mock('@resvg/resvg-js', () => ({
	Resvg: class {
		render() {
			return { asPng: () => Buffer.from('fake-png') };
		}
	},
}));

// Mock fetch for the font download
const mockFetch = vi.fn(async () => ({
	ok: true,
	arrayBuffer: async () => new ArrayBuffer(8),
}));
vi.stubGlobal('fetch', mockFetch);

import satori from 'satori';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('generateOGImage', () => {
	// Import lazily so mocks are in place
	async function getModule() {
		// Reset module cache to pick up fresh font cache
		const mod = await import('../og-image');
		return mod;
	}

	it('returns a Buffer (PNG output)', async () => {
		const { generateOGImage } = await getModule();
		const result = await generateOGImage('Test Title', 'A subtitle');
		expect(Buffer.isBuffer(result)).toBe(true);
	});

	it('passes 1200x630 dimensions to satori', async () => {
		const { generateOGImage } = await getModule();
		await generateOGImage('Hello', 'World');

		expect(satori).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ width: 1200, height: 630 }),
		);
	});

	it('uses smaller font for long titles (>40 chars)', async () => {
		const { generateOGImage } = await getModule();
		const longTitle = 'A'.repeat(50);
		await generateOGImage(longTitle, 'sub');

		const call = vi.mocked(satori).mock.calls.at(-1)!;
		const jsx = call[0] as { props: { children: unknown[] } };
		// The title div is the second child (index 1)
		const titleDiv = (jsx.props.children as Array<{ props: { style: { fontSize: string } } }>)[1];
		expect(titleDiv.props.style.fontSize).toBe('48px');
	});

	it('uses larger font for short titles (<=40 chars)', async () => {
		const { generateOGImage } = await getModule();
		await generateOGImage('Short', 'sub');

		const call = vi.mocked(satori).mock.calls.at(-1)!;
		const jsx = call[0] as { props: { children: unknown[] } };
		const titleDiv = (jsx.props.children as Array<{ props: { style: { fontSize: string } } }>)[1];
		expect(titleDiv.props.style.fontSize).toBe('56px');
	});

	it('applies custom accent color', async () => {
		const { generateOGImage } = await getModule();
		await generateOGImage('Title', 'Sub', '#FF0000');

		const call = vi.mocked(satori).mock.calls.at(-1)!;
		const jsx = call[0] as { props: { children: unknown[] } };
		// The accent bar is the first child (index 0)
		const accentBar = (
			jsx.props.children as Array<{ props: { style: { background: string } } }>
		)[0];
		expect(accentBar.props.style.background).toBe('#FF0000');
	});

	it('defaults accent color to gold', async () => {
		const { generateOGImage } = await getModule();
		await generateOGImage('Title', 'Sub');

		const call = vi.mocked(satori).mock.calls.at(-1)!;
		const jsx = call[0] as { props: { children: unknown[] } };
		const accentBar = (
			jsx.props.children as Array<{ props: { style: { background: string } } }>
		)[0];
		expect(accentBar.props.style.background).toBe('#d4a853');
	});
});
