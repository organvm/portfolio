// @vitest-environment happy-dom

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const DIST = resolve(process.cwd(), 'dist');
const describeBuiltOutput = existsSync(DIST) ? describe : describe.skip;
const SERVICE_WORKER_PATH = resolve(process.cwd(), 'public/sw.js');

function parseHTML(html: string) {
	// Use createHTMLDocument + innerHTML to avoid happy-dom's DOMParser
	// triggering network requests for linked CSS/JS resources. Strip
	// static assets as an extra guard when build output is present.
	const inertHtml = html
		.replace(/<link\b[^>]*rel=["']?stylesheet[^>]*>/gi, '')
		.replace(/<script\b[\s\S]*?<\/script>/gi, '');
	const doc = document.implementation.createHTMLDocument('');
	doc.documentElement.innerHTML = inertHtml;
	return doc;
}

function loadPage(path: string) {
	// Try direct path first (common for local builds)
	const file = resolve(DIST, path);
	if (existsSync(file)) {
		return parseHTML(readFileSync(file, 'utf-8'));
	}

	// Try with base path prefix (common for CI/production layout expectations)
	const nestedFile = resolve(DIST, 'portfolio', path);
	if (existsSync(nestedFile)) {
		return parseHTML(readFileSync(nestedFile, 'utf-8'));
	}

	return null;
}

function countHtmlFiles(dir: string): number {
	let count = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			count += countHtmlFiles(fullPath);
		} else if (entry.name.endsWith('.html')) {
			count++;
		}
	}
	return count;
}

describeBuiltOutput('build output', () => {
	it('dist/ directory exists', () => {
		expect(existsSync(DIST)).toBe(true);
	});

	it('produces at least the baseline HTML page count', () => {
		expect(countHtmlFiles(DIST)).toBeGreaterThanOrEqual(42);
	});
});

describe('service worker contracts', () => {
	it('precache list includes the 404 fallback route', () => {
		const sw = readFileSync(SERVICE_WORKER_PATH, 'utf-8');
		expect(sw).toContain('`${BASE}/404.html`');
		expect(sw).toContain('caches.match(`${BASE}/404.html`)');
	});
});

describeBuiltOutput('index page', () => {
	const doc = loadPage('index.html');

	it('exists', () => {
		expect(doc).not.toBeNull();
	});

	it('has a <title> tag', () => {
		expect(doc!.querySelectorAll('title').length).toBe(1);
		expect(doc!.querySelector('title')?.textContent).toBeTruthy();
	});

	it('has Open Graph meta tags', () => {
		expect(doc!.querySelectorAll('meta[property="og:title"]').length).toBe(1);
		expect(doc!.querySelectorAll('meta[property="og:description"]').length).toBe(1);
	});

	it('has a <main> element', () => {
		expect(doc!.querySelectorAll('main').length).toBeGreaterThanOrEqual(1);
	});

	it('has a <nav> or header element', () => {
		const hasNav =
			doc!.querySelectorAll('nav').length > 0 || doc!.querySelectorAll('header').length > 0;
		expect(hasNav).toBe(true);
	});
});

describeBuiltOutput('dashboard page', () => {
	const doc = loadPage('dashboard/index.html');

	it('exists', () => {
		expect(doc).not.toBeNull();
	});

	it('contains system metrics content', () => {
		const text = doc!.querySelector('body')?.textContent;
		expect(text).toContain('Dashboard');
	});
});

describeBuiltOutput('project pages', () => {
	const projectsDir = join(DIST, 'projects');
	const projectSlugs = existsSync(projectsDir)
		? readdirSync(projectsDir, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name)
		: [];

	it('has at least 21 project directories', () => {
		expect(projectSlugs.length).toBeGreaterThanOrEqual(21);
	});

	for (const slug of projectSlugs) {
		it(`projects/${slug} exists and has title`, () => {
			const doc = loadPage(`projects/${slug}/index.html`);
			expect(doc).not.toBeNull();
			expect(doc!.querySelector('title')?.textContent).toBeTruthy();
		});
	}

	it('project pages have article element', () => {
		const doc = loadPage(`projects/${projectSlugs[0]}/index.html`);
		expect(doc).not.toBeNull();
		expect(doc!.querySelectorAll('article').length).toBeGreaterThanOrEqual(1);
	});
});

describeBuiltOutput('products offer page', () => {
	const doc = loadPage('products/index.html');

	it('exists', () => {
		expect(doc).not.toBeNull();
	});

	it('has a title', () => {
		expect(doc!.querySelector('title')?.textContent).toBeTruthy();
	});

	it('has contact form for default capture', () => {
		expect(doc!.querySelectorAll('#offer-contact-form').length).toBe(1);
	});
});

describeBuiltOutput('resume page', () => {
	const doc = loadPage('resume/index.html');

	it('exists', () => {
		expect(doc).not.toBeNull();
	});

	it('has a <title> containing Resume', () => {
		expect(doc!.querySelector('title')?.textContent?.toLowerCase()).toContain('resume');
	});
});

describeBuiltOutput('consult page', () => {
	const doc = loadPage('consult/index.html');

	it('exists and has form', () => {
		expect(doc).not.toBeNull();
		expect(doc!.querySelectorAll('#consult-form').length).toBe(1);
		expect(doc!.querySelectorAll('#challenge').length).toBe(1);
	});
});

describeBuiltOutput('404 page', () => {
	const doc = loadPage('404.html');

	it('exists', () => {
		expect(doc).not.toBeNull();
	});
});

describeBuiltOutput('HTML structure conventions', () => {
	const pages = ['index.html', 'about/index.html', 'dashboard/index.html'];

	for (const page of pages) {
		it(`${page} has lang attribute on <html>`, () => {
			const doc = loadPage(page);
			expect(doc!.querySelector('html')?.getAttribute('lang')).toBeTruthy();
		});

		it(`${page} has viewport meta tag`, () => {
			const doc = loadPage(page);
			expect(doc!.querySelectorAll('meta[name="viewport"]').length).toBe(1);
		});

		it(`${page} has charset meta tag`, () => {
			const doc = loadPage(page);
			expect(doc!.querySelectorAll('meta[charset]').length).toBe(1);
		});
	}
});
