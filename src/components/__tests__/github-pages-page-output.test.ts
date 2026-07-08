// @vitest-environment happy-dom

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = resolve(process.cwd(), 'dist');
const describeBuiltOutput = existsSync(DIST) ? describe : describe.skip;
const PAGE = resolve(DIST, 'github-pages/index.html');
const JSON_FEED = resolve(DIST, 'github-pages.json');
const XML_FEED = resolve(DIST, 'github-pages.xml');

describeBuiltOutput('GitHub Pages directory output', () => {
	it('emits HTML and machine-readable endpoints', () => {
		expect(existsSync(PAGE)).toBe(true);
		expect(existsSync(JSON_FEED)).toBe(true);
		expect(existsSync(XML_FEED)).toBe(true);
	});

	it('renders health, diagnostics, and tracked outbound links', () => {
		const html = readFileSync(PAGE, 'utf-8');
		const doc = document.implementation.createHTMLDocument('');
		doc.documentElement.innerHTML = html
			.replace(/<link\b[^>]*rel=["']?stylesheet[^>]*>/gi, '')
			.replace(/<script\b[\s\S]*?<\/script>/gi, '');

		expect(doc.querySelector('h1')?.textContent?.toLowerCase()).toContain('static fleet');

		const h2s = doc.querySelectorAll('h2');
		let hasSystemPages = false;
		let hasWhyMatters = false;
		h2s.forEach((h2) => {
			if (h2.textContent?.includes('System Pages Health')) hasSystemPages = true;
			if (h2.textContent?.includes('Why this matters')) hasWhyMatters = true;
		});
		expect(hasSystemPages).toBe(true);
		expect(hasWhyMatters).toBe(true);

		const repoItems = doc.querySelectorAll('.repo-item');
		const trackedRepoLinks = doc.querySelectorAll('a[data-gh-pages-track]');
		if (repoItems.length > 0) {
			expect(trackedRepoLinks.length).toBeGreaterThan(0);
		} else {
			expect(trackedRepoLinks.length).toBe(0);
		}

		const allLinks = doc.querySelectorAll('a');
		let hasJsonLink = false;
		let hasXmlLink = false;
		allLinks.forEach((a) => {
			const href = a.getAttribute('href') ?? '';
			if (href.includes('github-pages.json')) hasJsonLink = true;
			if (href.includes('github-pages.xml')) hasXmlLink = true;
		});
		expect(hasJsonLink).toBe(true);
		expect(hasXmlLink).toBe(true);
	});
});
