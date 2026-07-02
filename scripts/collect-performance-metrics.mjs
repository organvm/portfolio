#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';
import { parseOption } from './lib/cli-utils.mjs';

const DIST = resolve('dist');
const ASTRO_DIR = resolve('dist/_astro');
const OUTPUT_PATH = resolve(parseOption('json-out', '.quality/perf-summary.json'));
const BASE_PATH = '';
const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 4321;
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const INTERACTIVE_SCENARIOS = [
	{ route: '/architecture', scenario: 'architecture-interaction' },
	{ route: '/gallery', scenario: 'gallery-interaction' },
];

function walkFiles(dir, predicate, results = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkFiles(fullPath, predicate, results);
		} else if (predicate(entry.name)) {
			results.push(fullPath);
		}
	}
	return results;
}

function normalizeRouteFromHtmlPath(htmlPath) {
	const rel = relative(DIST, htmlPath).replaceAll('\\', '/');
	if (rel === 'index.html') return `${BASE_PATH}/`;
	if (rel === '404.html') return `${BASE_PATH}/404.html`;
	if (rel.endsWith('/index.html')) {
		return `${BASE_PATH}/${rel.slice(0, -'/index.html'.length)}`;
	}
	return `${BASE_PATH}/${rel.replace(/\.html$/, '')}`;
}

function fileSizes(filePath) {
	const source = readFileSync(filePath);
	const rawBytes = statSync(filePath).size;
	const gzipBytes = zlib.gzipSync(source, { level: 9 }).length;
	return { rawBytes, gzipBytes };
}

function resolveScriptFileFromUrl(urlString) {
	let url;
	try {
		url = new URL(urlString);
	} catch {
		return null;
	}

	if (!url.pathname.includes('/_astro/') || !url.pathname.endsWith('.js')) return null;

	let relativePath = url.pathname;
	if (relativePath.startsWith(`${BASE_PATH}/`)) {
		relativePath = relativePath.slice(BASE_PATH.length + 1);
	}
	if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);

	const absolutePath = join(DIST, relativePath);
	return existsSync(absolutePath) ? absolutePath : null;
}

async function waitForServer(url, timeoutMs = 60000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok || response.status === 404) return;
		} catch {
			// Retry
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
	}
	throw new Error(`Timed out waiting for preview server at ${url}`);
}

function startPreviewServer() {
	const server = spawn(
		'node',
		[
			'node_modules/astro/bin/astro.mjs',
			'preview',
			'--host',
			PREVIEW_HOST,
			'--port',
			String(PREVIEW_PORT),
		],
		{
			stdio: ['ignore', 'pipe', 'pipe'],
			env: process.env,
		},
	);

	server.stdout?.on('data', () => {});
	server.stderr?.on('data', () => {});
	return server;
}

async function runScenarioInteractions(page, scenario) {
	if (scenario === 'architecture-interaction') {
		const graph = page.locator('#graph-container');
		if ((await graph.count()) > 0) {
			await graph.first().click({ position: { x: 20, y: 20 } });
			await page.mouse.move(100, 100);
			await page.waitForTimeout(180);
		}
		return;
	}

	if (scenario === 'gallery-interaction') {
		const filter = page.locator('.gallery-filter[data-filter="ORGAN-I"]').first();
		if ((await filter.count()) > 0 && (await filter.isVisible())) {
			await filter.click();
			await page.waitForTimeout(140);
		}

		const pauseBtn = page.locator('.sketch-ctrl--pause').first();
		if ((await pauseBtn.count()) > 0 && (await pauseBtn.isVisible())) {
			await pauseBtn.click();
			await page.waitForTimeout(120);
			await pauseBtn.click();
			await page.waitForTimeout(120);
		}
	}
}

function summarizeScripts(scriptFiles, chunkSizeMap) {
	let rawBytes = 0;
	let gzipBytes = 0;
	const assets = [];

	for (const scriptFile of scriptFiles) {
		const info = chunkSizeMap.get(scriptFile) ?? {
			chunk: relative(DIST, scriptFile).replaceAll('\\', '/'),
			...fileSizes(scriptFile),
		};
		rawBytes += info.rawBytes;
		gzipBytes += info.gzipBytes;
		assets.push(info.chunk);
	}

	return {
		rawBytes,
		gzipBytes,
		assetCount: assets.length,
		assets: assets.sort(),
	};
}

async function collectInteractiveRouteTotals(chunkSizeMap) {
	const server = startPreviewServer();
	let browser;

	try {
		await waitForServer(`${PREVIEW_URL}${BASE_PATH}/`);
		browser = await chromium.launch({ headless: true });

		const interactiveRouteJsTotals = {};
		for (const scenario of INTERACTIVE_SCENARIOS) {
			const page = await browser.newPage();
			const scripts = new Set();

			page.on('response', (response) => {
				const scriptFile = resolveScriptFileFromUrl(response.url());
				if (!scriptFile) return;
				if (response.request().resourceType() !== 'script') return;
				scripts.add(scriptFile);
			});

			const fullRoute = `${BASE_PATH}${scenario.route}`;
			await page.goto(`${PREVIEW_URL}${fullRoute}`, { waitUntil: 'networkidle' });
			await runScenarioInteractions(page, scenario.scenario);
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(200);

			interactiveRouteJsTotals[fullRoute] = {
				scenario: scenario.scenario,
				...summarizeScripts(scripts, chunkSizeMap),
			};

			await page.close();
		}

		return interactiveRouteJsTotals;
	} finally {
		await browser?.close().catch(() => {});
		if (!server.killed) {
			server.kill('SIGTERM');
			await new Promise((resolveClose) => {
				const timeout = setTimeout(resolveClose, 3000);
				server.once('exit', () => {
					clearTimeout(timeout);
					resolveClose();
				});
			});
		}
	}
}

if (!existsSync(DIST)) {
	console.error('dist/ not found. Run `npm run build` before collecting performance metrics.');
	process.exit(1);
}

const htmlFiles = walkFiles(DIST, (name) => name.endsWith('.html'));
const chunkFiles = existsSync(ASTRO_DIR)
	? walkFiles(ASTRO_DIR, (name) => name.endsWith('.js'))
	: [];

const chunkSizeMap = new Map();
for (const chunkPath of chunkFiles) {
	chunkSizeMap.set(chunkPath, {
		chunk: relative(DIST, chunkPath).replaceAll('\\', '/'),
		...fileSizes(chunkPath),
	});
}

const routeJsTotals = {};
for (const htmlPath of htmlFiles) {
	const html = readFileSync(htmlPath, 'utf-8');
	const route = normalizeRouteFromHtmlPath(htmlPath);
	const scripts = new Set();
	const scriptPattern = /<script[^>]+src="([^"]+_astro[^"]+\.js)"/g;
	let match;
	while ((match = scriptPattern.exec(html)) !== null) {
		let src = match[1];
		if (src.startsWith(`${BASE_PATH}/`)) src = src.slice(BASE_PATH.length + 1);
		if (src.startsWith('/')) src = src.slice(1);
		const absolute = join(DIST, src);
		if (existsSync(absolute)) scripts.add(absolute);
	}

	routeJsTotals[route] = summarizeScripts(scripts, chunkSizeMap);
}

const interactiveRouteJsTotals = await collectInteractiveRouteTotals(chunkSizeMap);

const largestChunks = Array.from(chunkSizeMap.values())
	.sort((a, b) => b.gzipBytes - a.gzipBytes)
	.slice(0, 20);

const summary = {
	generated: new Date().toISOString(),
	source: 'dist/**/*.html + dist/_astro/**/*.js + runtime route interactions',
	basePath: BASE_PATH,
	routesAnalyzed: htmlFiles.length,
	chunksAnalyzed: chunkFiles.length,
	routeJsTotals,
	interactiveRouteJsTotals,
	largestChunks,
	interactionScenarios: INTERACTIVE_SCENARIOS,
	status: 'pass',
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2) + '\n');

console.log(
	`Collected performance metrics for ${summary.routesAnalyzed} routes, ${summary.chunksAnalyzed} JS chunks, and ${Object.keys(interactiveRouteJsTotals).length} interaction routes.`,
);
