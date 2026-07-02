#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { parseOption } from './lib/cli-utils.mjs';

const DEFAULT_MANIFEST_PATH = resolve('scripts/runtime-a11y-routes.json');

const outputPath = resolve(parseOption('json-out', '.quality/runtime-errors-summary.json'));
const allowlistPath = resolve(parseOption('allowlist', '.quality/runtime-error-allowlist.json'));
const manifestPath = resolve(parseOption('manifest', DEFAULT_MANIFEST_PATH));
const routeLimitOption = parseOption('route-limit', null);
const host = 'localhost';
const port = Number(parseOption('port', '4322'));
const previewUrl = `http://${host}:${port}`;

const viewportProfiles = [
	{ name: 'mobile', viewport: { width: 390, height: 844 } },
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
];

function normalizeBasePath(value) {
	if (typeof value !== 'string') return '';
	const trimmed = value.trim();
	if (trimmed && !trimmed.startsWith('/')) return '';
	if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1);
	return trimmed === '/' ? '' : trimmed || '';
}

function normalizeRoutePath(value) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed === '/') return '/';
	const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
	return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed;
}

function parseRouteLimit(rawValue) {
	if (rawValue === null) return null;
	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		console.error(`Invalid --route-limit value: ${rawValue}. Use a positive integer.`);
		process.exit(1);
	}
	return parsed;
}

function readRouteManifest() {
	if (!existsSync(manifestPath)) {
		console.error(`Runtime telemetry manifest not found: ${manifestPath}`);
		process.exit(1);
	}

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
	const basePath = normalizeBasePath(manifest.basePath);
	const rawRoutes = Array.isArray(manifest.routes) ? manifest.routes : [];
	const routeMatrix = [
		...new Set(
			rawRoutes
				.map((entry) => normalizeRoutePath(entry?.path))
				.filter((route) => typeof route === 'string'),
		),
	];

	if (routeMatrix.length === 0) {
		console.error(`Runtime telemetry manifest has no routes: ${manifestPath}`);
		process.exit(1);
	}

	return { basePath, routeMatrix };
}

const routeLimit = parseRouteLimit(routeLimitOption);
const routeManifest = readRouteManifest();
const basePath = routeManifest.basePath;
const routeMatrix =
	routeLimit === null ? routeManifest.routeMatrix : routeManifest.routeMatrix.slice(0, routeLimit);

function readAllowlist() {
	if (!existsSync(allowlistPath)) {
		return [];
	}
	const raw = JSON.parse(readFileSync(allowlistPath, 'utf-8'));
	const entries = Array.isArray(raw?.entries) ? raw.entries : [];
	return entries
		.filter((entry) => typeof entry?.pattern === 'string' && entry.pattern.length > 0)
		.map((entry) => ({
			pattern: new RegExp(entry.pattern),
			reason: typeof entry.reason === 'string' ? entry.reason : 'unspecified',
		}));
}

async function waitForServer(url, timeoutMs = 60000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok || response.status === 404) return;
		} catch {
			// retry
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
	}
	throw new Error(`Timed out waiting for preview server at ${url}`);
}

function startPreviewServer() {
	return spawn(
		'node',
		['node_modules/astro/bin/astro.mjs', 'preview', '--host', '0.0.0.0', '--port', String(port)],
		{
			stdio: ['ignore', 'pipe', 'pipe'],
			env: process.env,
		},
	);
}

function classifyEvent(message, allowlist) {
	for (const entry of allowlist) {
		if (entry.pattern.test(message)) {
			return { classification: 'allowlisted', reason: entry.reason };
		}
	}
	return { classification: 'uncategorized', reason: null };
}

async function runRouteInteractions(page) {
	await page
		.evaluate(() => {
			document.dispatchEvent(new Event('astro:page-load'));
			document.dispatchEvent(new Event('astro:page-load'));
		})
		.catch(() => {});

	const menu = page.locator('.header__toggle').first();
	if ((await menu.count()) > 0 && (await menu.isVisible())) {
		await menu.click().catch(() => {});
		await menu.click().catch(() => {});
	}

	const search = page.locator('.search-trigger').first();
	if ((await search.count()) > 0 && (await search.isVisible())) {
		await search.click().catch(() => {});
		const close = page.locator('.search-dialog__close').first();
		if ((await close.count()) > 0 && (await close.isVisible())) {
			await close.click().catch(() => {});
		} else {
			await page.keyboard.press('Escape').catch(() => {});
		}
	}

	const theme = page.locator('.theme-toggle').first();
	if ((await theme.count()) > 0 && (await theme.isVisible())) {
		await theme.click().catch(() => {});
	}

	const pause = page.locator('.sketch-ctrl--pause').first();
	if ((await pause.count()) > 0 && (await pause.isVisible())) {
		await pause.click().catch(() => {});
		await pause.click().catch(() => {});
	}
}

const allowlist = readAllowlist();
const preview = startPreviewServer();
let browser;
const events = [];

try {
	await waitForServer(`${previewUrl}${basePath}/`);
	browser = await chromium.launch({ headless: true });

	for (const profile of viewportProfiles) {
		const context = await browser.newContext({ viewport: profile.viewport });

		for (const route of routeMatrix) {
			const page = await context.newPage();
			const pageEvents = [];

			page.on('pageerror', (error) => {
				pageEvents.push({
					type: 'pageerror',
					message: error?.message ?? String(error),
				});
			});

			page.on('console', (msg) => {
				if (msg.type() !== 'error') return;
				pageEvents.push({
					type: 'console.error',
					message: msg.text(),
				});
			});

			const fullRoute = `${basePath}${route}`;
			await page.goto(`${previewUrl}${fullRoute}`, { waitUntil: 'networkidle' });
			await runRouteInteractions(page);
			await page.waitForTimeout(150);

			for (const event of pageEvents) {
				const classified = classifyEvent(event.message, allowlist);
				events.push({
					viewport: profile.name,
					route: fullRoute,
					...event,
					classification: classified.classification,
					reason: classified.reason,
				});
			}

			await page.close();
		}

		await context.close();
	}
} finally {
	await browser?.close().catch(() => {});
	if (!preview.killed) {
		preview.kill('SIGTERM');
		await new Promise((resolveClose) => {
			const timeout = setTimeout(resolveClose, 3000);
			preview.once('exit', () => {
				clearTimeout(timeout);
				resolveClose();
			});
		});
	}
}

const uncategorized = events.filter((event) => event.classification === 'uncategorized');
const allowlisted = events.filter((event) => event.classification === 'allowlisted');

const summary = {
	generated: new Date().toISOString(),
	source: 'playwright runtime telemetry',
	manifestPath,
	basePath,
	routeSourceCount: routeManifest.routeMatrix.length,
	routeLimitApplied: routeLimit,
	profiles: viewportProfiles.map((profile) => profile.name),
	routes: routeMatrix.map((route) => `${basePath}${route}`),
	counts: {
		routes: routeMatrix.length,
		total: events.length,
		uncategorized: uncategorized.length,
		allowlisted: allowlisted.length,
	},
	events,
	status: uncategorized.length > 0 ? 'fail' : 'pass',
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(summary, null, 2) + '\n');

if (summary.status === 'fail') {
	console.error(
		`Runtime error telemetry failed with ${uncategorized.length} uncategorized runtime error(s).`,
	);
	uncategorized.slice(0, 20).forEach((event) => {
		console.error(`- [${event.viewport}] ${event.route} (${event.type}) ${event.message}`);
	});
	process.exit(1);
}

console.log(`Runtime error telemetry passed (${events.length} events, uncategorized=0).`);
