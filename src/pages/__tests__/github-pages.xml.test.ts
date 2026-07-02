import { describe, expect, it, vi } from 'vitest';
import { GET } from '../github-pages.xml';

// Mock the astro rss module
vi.mock('@astrojs/rss', () => ({
	default: vi.fn((opts) => new Response(JSON.stringify(opts))),
}));

describe('github-pages.xml.ts', () => {
	it('should generate an RSS feed response for github pages', () => {
		const context = {
			site: new URL('https://4444j99.dev/'),
		} as any;

		const response = GET(context);
		expect(response).toBeInstanceOf(Response);
	});
});
