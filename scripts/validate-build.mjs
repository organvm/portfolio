#!/usr/bin/env node

/**
 * Build validation — runs HTML validation and internal link checking on dist/.
 *
 * Usage: node scripts/validate-build.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const SITE_BASE = 'https://organvm.github.io/portfolio/';
let exitCode = 0;

if (!existsSync(DIST)) {
	console.error(`✗ Build output directory not found: ${DIST}`);
	console.error('Run `npm run build` before `npm run validate`.');
	process.exit(1);
}

// --- HTML Validation ---
console.log('=== HTML Validation ===\n');
const htmlValidateResult = spawnSync(
	'npx',
	['html-validate', '--config', '.config/.htmlvalidate.json', `${DIST}/**/*.html`],
	{ stdio: 'inherit', timeout: 60000 },
);

if (htmlValidateResult.status === 0) {
	console.log('✓ HTML validation passed\n');
} else {
	console.error('✗ HTML validation failed\n');
	exitCode = 1;
}

// --- Internal Link Checking ---
console.log('=== Internal Link Checking ===\n');

function findHtmlFiles(dir) {
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) results.push(...findHtmlFiles(fullPath));
		else if (entry.name.endsWith('.html')) results.push(fullPath);
	}
	return results;
}

function collectAllPaths(dir, prefix = '') {
	const paths = new Set();
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			for (const f of collectAllPaths(join(dir, entry.name), relPath)) {
				paths.add(f);
			}
		} else {
			paths.add(relPath);
		}
	}
	return paths;
}

const allFiles = collectAllPaths(DIST);
const allPaths = new Set(allFiles);
for (const f of allFiles) {
	if (f.endsWith('/index.html')) {
		allPaths.add(f.replace('/index.html', '/'));
		allPaths.add(f.replace('/index.html', ''));
	}
}

const htmlFiles = findHtmlFiles(DIST);
const hrefRegex = /(?:href|src)=["']([^"'#?]+)/g;
let brokenLinks = 0;
let totalLinks = 0;

for (const file of htmlFiles) {
	const html = readFileSync(file, 'utf-8');
	const relDir = file.replace(DIST + '/', '').replace(/[^/]+$/, '');
	let match;

	while ((match = hrefRegex.exec(html)) !== null) {
		const href = match[1];

		// Skip external, data URIs, javascript, mailto, tel
		if (/^(https?:|data:|javascript:|mailto:|tel:)/.test(href)) continue;

		totalLinks++;

		let resolved;
		if (href.startsWith('/portfolio/')) {
			resolved = href.replace('/portfolio/', '');
		} else if (href.startsWith('/')) {
			resolved = href.slice(1);
		} else {
			resolved = relDir + href;
		}

		// Normalize and check multiple path variants
		const variants = [
			resolved,
			resolved + 'index.html',
			resolved.replace(/\/$/, '') + '/index.html',
			resolved.replace(/\/$/, ''),
		];

		const found = variants.some((v) => allPaths.has(v));
		if (!found) {
			const relFile = file.replace(DIST + '/', '');
			console.log(`  ✗ ${relFile} → ${href} (resolved: ${resolved})`);
			brokenLinks++;
		}
	}
}

console.log(`\nChecked ${totalLinks} internal links across ${htmlFiles.length} pages`);
if (brokenLinks > 0) {
	console.log(`✗ Found ${brokenLinks} broken internal links\n`);
	exitCode = 1;
} else {
	console.log('✓ All internal links valid\n');
}

// --- Feed XML Link Checking ---
console.log('=== Feed XML Link Checking ===\n');

const feedPath = resolve(DIST, 'feed.xml');
if (!existsSync(feedPath)) {
	console.log('✗ dist/feed.xml not found\n');
	exitCode = 1;
} else {
	const feedXml = readFileSync(feedPath, 'utf-8');
	const feedLinks = [...feedXml.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
	const internalFeedLinks = feedLinks.filter((link) => link.startsWith(SITE_BASE));
	let brokenFeedLinks = 0;

	for (const link of internalFeedLinks) {
		const resolved = link.slice(SITE_BASE.length).replace(/^\/+/, '');
		const variants = [
			resolved,
			resolved + 'index.html',
			resolved.replace(/\/$/, '') + '/index.html',
			resolved.replace(/\/$/, ''),
		];

		const found = variants.some((v) => allPaths.has(v));
		if (!found) {
			console.log(`  ✗ feed.xml → ${link} (resolved: ${resolved})`);
			brokenFeedLinks++;
		}
	}

	console.log(`Checked ${internalFeedLinks.length} internal feed links`);
	if (brokenFeedLinks > 0) {
		console.log(`✗ Found ${brokenFeedLinks} broken feed links\n`);
		exitCode = 1;
	} else {
		console.log('✓ All internal feed links valid\n');
	}
}

process.exit(exitCode);
