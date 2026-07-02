import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Tests for validate-build.mjs logic.
 *
 * The script relies on dist/ and spawns html-validate, so we test the pure
 * logic functions (findHtmlFiles, collectAllPaths, link resolution) by
 * reimplementing the core algorithms and verifying their behavior with
 * in-memory fixtures. The actual script is integration-tested by CI's
 * `npm run test:build-validation` step.
 */

// --- Reimplement collectAllPaths logic for testability ---

function collectAllPaths(entries, prefix = '') {
	const paths = new Set();
	for (const entry of entries) {
		const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.children) {
			for (const f of collectAllPaths(entry.children, relPath)) {
				paths.add(f);
			}
		} else {
			paths.add(relPath);
		}
	}
	return paths;
}

function buildPathIndex(allFiles) {
	const allPaths = new Set(allFiles);
	for (const f of allFiles) {
		if (f.endsWith('/index.html')) {
			allPaths.add(f.replace('/index.html', '/'));
			allPaths.add(f.replace('/index.html', ''));
		}
	}
	return allPaths;
}

function resolveHref(href, relDir) {
	if (href.startsWith('/')) {
		return href.slice(1);
	}
	return relDir + href;
}

function isLinkFound(resolved, allPaths) {
	const variants = [
		resolved,
		resolved + 'index.html',
		resolved.replace(/\/$/, '') + '/index.html',
		resolved.replace(/\/$/, ''),
	];
	return variants.some((v) => allPaths.has(v));
}

describe('HTML validation detection', () => {
	it('recognizes .html files in nested directory structures', () => {
		const entries = [
			{ name: 'index.html' },
			{
				name: 'projects',
				children: [{ name: 'index.html' }, { name: 'alpha', children: [{ name: 'index.html' }] }],
			},
			{ name: 'style.css' },
		];
		const paths = collectAllPaths(entries);
		const htmlFiles = [...paths].filter((p) => p.endsWith('.html'));
		assert.equal(htmlFiles.length, 3);
		assert.ok(paths.has('index.html'));
		assert.ok(paths.has('projects/index.html'));
		assert.ok(paths.has('projects/alpha/index.html'));
	});

	it('does not include non-HTML files in HTML list', () => {
		const entries = [{ name: 'index.html' }, { name: 'style.css' }, { name: 'app.js' }];
		const paths = collectAllPaths(entries);
		const htmlFiles = [...paths].filter((p) => p.endsWith('.html'));
		assert.equal(htmlFiles.length, 1);
	});
});

describe('internal link checking logic', () => {
	const mockFiles = new Set([
		'index.html',
		'about/index.html',
		'projects/index.html',
		'projects/alpha/index.html',
		'assets/style.css',
		'feed.xml',
	]);
	const allPaths = buildPathIndex(mockFiles);

	it('resolves absolute links with / prefix (root-relative)', () => {
		const resolved = resolveHref('/about/', '');
		assert.ok(isLinkFound(resolved, allPaths), `Should find: ${resolved}`);
	});

	it('resolves absolute links with / prefix', () => {
		const resolved = resolveHref('/index.html', '');
		assert.ok(isLinkFound(resolved, allPaths));
	});

	it('resolves relative links', () => {
		const resolved = resolveHref('alpha/index.html', 'projects/');
		assert.ok(isLinkFound(resolved, allPaths));
	});

	it('detects broken links', () => {
		const resolved = resolveHref('/nonexistent/', '');
		assert.ok(!isLinkFound(resolved, allPaths), 'Nonexistent page should not be found');
	});

	it('builds path index with directory-style variants', () => {
		assert.ok(allPaths.has('about/'));
		assert.ok(allPaths.has('about'));
		assert.ok(allPaths.has('about/index.html'));
	});

	it('skips external and special URLs', () => {
		// Verify the regex pattern used in the script
		const skipPattern = /^(https?:|data:|javascript:|mailto:|tel:)/;
		assert.ok(skipPattern.test('https://example.com'));
		assert.ok(skipPattern.test('mailto:test@test.com'));
		assert.ok(skipPattern.test('data:image/png;base64,abc'));
		assert.ok(!skipPattern.test('/about/'));
		assert.ok(!skipPattern.test('relative/path'));
	});
});
