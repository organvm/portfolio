#!/usr/bin/env node

/**
 * Lightweight Lighthouse CI runner.
 *
 * Replaces @lhci/cli to eliminate the puppeteer-core/yauzl vulnerability chain.
 * Serves dist/ with Node's built-in http server, runs Lighthouse programmatically
 * (in-process, no child process), asserts thresholds, and saves LHR JSON to
 * .lighthouseci/ for badge generation.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

// ── Configuration ────────────────────────────────────────────────────────────

const DIST_DIR = resolve('dist');
const OUTPUT_DIR = resolve('.lighthouseci');
const NUMBER_OF_RUNS = process.env.CI ? 1 : 3;

const URLS = [
	'index.html',
	'about/index.html',
	'dashboard/index.html',
	'projects/orchestration-hub/index.html',
	'gallery/index.html',
	'consult/index.html',
];

// Governance test regex matches this exact format — do not reformat.
const ASSERTIONS = {
	'categories:performance': ['error', { minScore: 0.9 }],
	'categories:accessibility': ['error', { minScore: 0.91 }],
	'categories:best-practices': ['error', { minScore: 0.93 }],
	'categories:seo': ['error', { minScore: 0.92 }],
};

const MIME_TYPES = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.xml': 'application/xml',
	'.txt': 'text/plain',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.webmanifest': 'application/manifest+json',
	'.mjs': 'application/javascript',
};

// ── Static file server ───────────────────────────────────────────────────────

function createStaticServer() {
	return createServer((req, res) => {
		const urlPath = decodeURIComponent(req.url.split('?')[0]);
		let filePath = join(DIST_DIR, urlPath);

		// Directory → index.html
		if (existsSync(filePath) && !extname(filePath)) {
			filePath = join(filePath, 'index.html');
		}

		if (!existsSync(filePath)) {
			res.writeHead(404);
			res.end('Not Found');
			return;
		}

		const ext = extname(filePath);
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';

		try {
			const content = readFileSync(filePath);
			res.writeHead(200, { 'Content-Type': contentType });
			res.end(content);
		} catch {
			res.writeHead(500);
			res.end('Internal Server Error');
		}
	});
}

// ── Lighthouse runner (programmatic) ─────────────────────────────────────────

async function runLighthouse(url, chromePath) {
	const lighthouse = (await import('lighthouse')).default;
	const chromeLauncher = await import('chrome-launcher');

	const chrome = await chromeLauncher.launch({
		chromePath,
		chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
	});

	try {
		const result = await lighthouse(url, {
			port: chrome.port,
			output: 'json',
			logLevel: 'error',
		});
		return result?.lhr ?? null;
	} finally {
		chrome.kill();
	}
}

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function extractScores(lhr) {
	const cats = lhr.categories || {};
	return {
		performance: cats.performance?.score ?? null,
		accessibility: cats.accessibility?.score ?? null,
		'best-practices': cats['best-practices']?.score ?? null,
		seo: cats.seo?.score ?? null,
	};
}

// ── Chrome detection ─────────────────────────────────────────────────────────

function findChrome() {
	const candidates =
		process.platform === 'darwin'
			? [
					'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
					'/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
				]
			: [
					'/usr/bin/google-chrome-stable',
					'/usr/bin/google-chrome',
					'/usr/bin/chromium-browser',
					'/usr/bin/chromium',
				];

	if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
		return process.env.CHROME_PATH;
	}
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	if (!existsSync(DIST_DIR)) {
		console.error('dist/ not found. Run `npm run build` first.');
		process.exit(1);
	}

	// Clean and create output directory
	if (existsSync(OUTPUT_DIR)) {
		rmSync(OUTPUT_DIR, { recursive: true });
	}
	mkdirSync(OUTPUT_DIR, { recursive: true });

	// Detect Chrome
	const chromePath = findChrome();
	if (chromePath) {
		console.log(`Chrome: ${chromePath}`);
	} else {
		console.error('Chrome not found. Set CHROME_PATH or install google-chrome-stable.');
		process.exit(1);
	}

	// Start static server
	const server = createStaticServer();
	await new Promise((r) => {
		server.listen(0, '127.0.0.1', r);
	});
	const port = server.address().port;
	console.log(`Serving dist/ on http://127.0.0.1:${port}`);
	console.log(`Running Lighthouse: ${URLS.length} URLs x ${NUMBER_OF_RUNS} runs\n`);

	const failures = [];
	let lhrIndex = 0;

	try {
		for (const urlPath of URLS) {
			const fullUrl = `http://127.0.0.1:${port}/${urlPath}`;
			const runScores = [];
			process.stdout.write(`  ${urlPath} `);

			for (let run = 0; run < NUMBER_OF_RUNS; run++) {
				try {
					const lhr = await runLighthouse(fullUrl, chromePath);
					if (!lhr) throw new Error('Lighthouse returned no result');
					runScores.push({ lhr, scores: extractScores(lhr) });
					process.stdout.write('.');
				} catch (err) {
					console.error(`\n    Run ${run + 1} failed: ${err.message}`);
					// Continue with remaining runs
				}
			}

			if (runScores.length === 0) {
				console.log(' FAILED (all runs)');
				failures.push({ url: urlPath, reason: 'All Lighthouse runs failed' });
				continue;
			}

			// Find median by performance score, save that LHR
			const perfScores = runScores.map((r) => r.scores.performance ?? 0);
			const medianPerf = median(perfScores);
			// Pick the run closest to median performance
			const best = runScores.reduce((prev, curr) => {
				const prevDiff = Math.abs((prev.scores.performance ?? 0) - medianPerf);
				const currDiff = Math.abs((curr.scores.performance ?? 0) - medianPerf);
				return currDiff < prevDiff ? curr : prev;
			});

			// Save LHR with lhr- prefix for badge generation script
			const lhrPath = join(OUTPUT_DIR, `lhr-${lhrIndex}.json`);
			writeFileSync(lhrPath, JSON.stringify(best.lhr, null, 2));
			lhrIndex++;

			const scores = best.scores;
			const line = Object.entries(scores)
				.map(([k, v]) => `${k}=${v !== null ? Math.round(v * 100) : 'N/A'}`)
				.join('  ');
			console.log(` ${line}`);

			// Assert thresholds
			for (const [assertion, [level, config]] of Object.entries(ASSERTIONS)) {
				const category = assertion.replace('categories:', '');
				const actual = scores[category];
				if (actual === null) continue;
				if (actual < config.minScore) {
					const msg = `${urlPath}: ${category} score ${Math.round(actual * 100)} < threshold ${Math.round(config.minScore * 100)}`;
					if (level === 'error') {
						failures.push({ url: urlPath, reason: msg });
					}
					console.log(`    ${level.toUpperCase()}: ${msg}`);
				}
			}
		}
	} finally {
		// Clean up temp files
		for (const f of readdirSync(OUTPUT_DIR)) {
			if (f.startsWith('tmp-run-')) {
				rmSync(join(OUTPUT_DIR, f), { force: true });
			}
		}
		server.close();
	}

	console.log(
		`\n${failures.length === 0 ? 'All assertions passed.' : `${failures.length} assertion failure(s):`}`,
	);
	for (const f of failures) {
		console.log(`  - ${f.reason}`);
	}

	process.exit(failures.length > 0 ? 1 : 0);
}

main();
