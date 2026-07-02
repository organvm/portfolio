import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const DIST = resolve(process.cwd(), 'dist');
const describeBuiltOutput = existsSync(DIST) ? describe : describe.skip;
const FEED = resolve(DIST, 'feed.xml');
const SITE_BASE = 'https://4444j99.dev/';

function variants(relativePath: string): string[] {
	const normalized = relativePath.replace(/^\/+/, '');
	return [
		normalized,
		`${normalized}index.html`,
		`${normalized.replace(/\/$/, '')}/index.html`,
		normalized.replace(/\/$/, ''),
	];
}

describeBuiltOutput('feed output', () => {
	it('feed.xml exists in dist', () => {
		expect(existsSync(FEED)).toBe(true);
	});

	it('all internal feed links resolve to built files', () => {
		const xml = readFileSync(FEED, 'utf-8');
		const links = [...xml.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
		const internal = links.filter((link) => link.startsWith(SITE_BASE));

		expect(internal.length).toBeGreaterThan(0);

		const broken: string[] = [];

		for (const link of internal) {
			const relativePath = link.slice(SITE_BASE.length);
			const resolved = variants(relativePath).some(
				(candidate) =>
					existsSync(resolve(DIST, candidate)) || existsSync(resolve(DIST, 'portfolio', candidate)),
			);
			if (!resolved) broken.push(link);
		}

		expect(broken).toEqual([]);
	});
});
