#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const PREVIEW_HOST = 'localhost';
const PREVIEW_PORT = 4321;
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const DEFAULT_MANIFEST_PATH = resolve('scripts/runtime-a11y-routes.json');
const AXE_SOURCE = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf-8');

const args = process.argv.slice(2);
const jsonStdout = args.includes('--json');
const verbose = args.includes('--verbose');
const jsonOutIndex = args.indexOf('--json-out');
const manifestOptionIndex = args.indexOf('--manifest');
const jsonOutPath = jsonOutIndex >= 0 ? args[jsonOutIndex + 1] : null;
const manifestPath =
	manifestOptionIndex >= 0 ? resolve(args[manifestOptionIndex + 1]) : DEFAULT_MANIFEST_PATH;

if (jsonOutIndex >= 0 && !jsonOutPath) {
	console.error('Missing value for --json-out');
	process.exit(1);
}

if (!existsSync(DIST)) {
	console.error('dist/ not found. Run `npm run build` before runtime a11y audit.');
	process.exit(1);
}

if (!existsSync(manifestPath)) {
	console.error(`Runtime a11y manifest not found: ${manifestPath}`);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const BASE_PATH = manifest.basePath ?? '';
const ROUTES = manifest.routes ?? [];

function normalizeRoute(routePath) {
	if (routePath === '/') return `${BASE_PATH}/`;
	return `${BASE_PATH}${routePath}`;
}

function impactCount(violations, impact) {
	return violations.filter((violation) => violation.impact === impact).length;
}

function sanitizeRoute(route) {
	return (
		route
			.replace(/^\//, '')
			.replace(/\/+/g, '-')
			.replace(/[^a-zA-Z0-9-_]/g, '') || 'root'
	);
}

async function waitForServer(url, timeoutMs = 60000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok || response.status === 404) return;
		} catch {
			// Retry until timeout
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
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
			'0.0.0.0',
			'--port',
			String(PREVIEW_PORT),
		],
		{
			stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
			env: process.env,
		},
	);

	if (!verbose) {
		server.stdout?.on('data', () => {});
		server.stderr?.on('data', () => {});
	}

	return server;
}

async function runInteractionChecks(page, checks = []) {
	const results = [];

	for (const check of checks) {
		if (check === 'nav-menu') {
			const toggle = page.locator('.header__toggle').first();
			if ((await toggle.count()) === 0) {
				results.push({ check, status: 'skip', detail: 'header toggle missing' });
				continue;
			}
			if (!(await toggle.isVisible())) {
				results.push({ check, status: 'skip', detail: 'header toggle hidden in viewport' });
				continue;
			}
			await toggle.click();
			const opened = await toggle.getAttribute('aria-expanded');
			await toggle.click();
			const closed = await toggle.getAttribute('aria-expanded');
			results.push({
				check,
				status: opened === 'true' && closed === 'false' ? 'pass' : 'fail',
				detail: `opened=${opened} closed=${closed}`,
			});
			continue;
		}

		if (check === 'dropdown-menu') {
			const trigger = page.locator('.header__dropdown-trigger').first();
			if ((await trigger.count()) === 0) {
				results.push({ check, status: 'skip', detail: 'dropdown trigger missing' });
				continue;
			}
			if (!(await trigger.isVisible())) {
				results.push({ check, status: 'skip', detail: 'dropdown trigger hidden in viewport' });
				continue;
			}
			await trigger.click();
			const openCount = await page.locator('.header__dropdown-menu[data-open]').count();
			await page.keyboard.press('Escape');
			const closedCount = await page.locator('.header__dropdown-menu[data-open]').count();
			results.push({
				check,
				status: openCount > 0 && closedCount === 0 ? 'pass' : 'fail',
				detail: `open=${openCount} closed=${closedCount}`,
			});
			continue;
		}

		if (check === 'search-dialog') {
			const trigger = page.locator('.search-trigger').first();
			if ((await trigger.count()) === 0) {
				results.push({ check, status: 'skip', detail: 'search trigger missing' });
				continue;
			}
			if (!(await trigger.isVisible())) {
				results.push({ check, status: 'skip', detail: 'search trigger hidden in viewport' });
				continue;
			}

			await trigger.click();
			const dialog = page.locator('.search-dialog');
			await dialog.waitFor({ state: 'visible', timeout: 3000 });
			const opened = await dialog.evaluate((el) => el.hasAttribute('open'));
			const closeButton = page.locator('.search-dialog__close');
			if (await closeButton.count()) {
				await closeButton.click();
			} else {
				await page.keyboard.press('Escape');
			}
			const closed = await dialog.evaluate((el) => !el.hasAttribute('open'));
			results.push({
				check,
				status: opened && closed ? 'pass' : 'fail',
				detail: `opened=${opened} closed=${closed}`,
			});
			continue;
		}

		if (check === 'theme-toggle') {
			const toggle = page.locator('.theme-toggle').first();
			if ((await toggle.count()) === 0) {
				results.push({ check, status: 'skip', detail: 'theme toggle missing' });
				continue;
			}
			if (!(await toggle.isVisible())) {
				results.push({ check, status: 'skip', detail: 'theme toggle hidden in viewport' });
				continue;
			}

			const before = await page.evaluate(() => ({
				pref: localStorage.getItem('theme-preference'),
				theme: document.documentElement.dataset.theme ?? null,
			}));
			await toggle.click();
			await page.waitForTimeout(120);
			const after = await page.evaluate(() => ({
				pref: localStorage.getItem('theme-preference'),
				theme: document.documentElement.dataset.theme ?? null,
			}));
			const changed = before.pref !== after.pref || before.theme !== after.theme;
			results.push({
				check,
				status: changed ? 'pass' : 'fail',
				detail: `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
			});
			continue;
		}

		if (check === 'gallery-filter') {
			const filters = page.locator('.gallery-filter');
			if ((await filters.count()) < 2) {
				results.push({ check, status: 'skip', detail: 'gallery filters unavailable' });
				continue;
			}
			if (!(await filters.nth(1).isVisible())) {
				results.push({ check, status: 'skip', detail: 'gallery filter hidden in viewport' });
				continue;
			}

			await filters.nth(1).click();
			const active = await filters
				.nth(1)
				.evaluate((el) => el.classList.contains('gallery-filter--active'));
			results.push({
				check,
				status: active ? 'pass' : 'fail',
				detail: `active=${active}`,
			});
			continue;
		}

		if (check === 'fullscreen') {
			const button = page.locator('.sketch-ctrl--fullscreen').first();
			if ((await button.count()) === 0) {
				results.push({ check, status: 'skip', detail: 'fullscreen control missing' });
				continue;
			}
			if (!(await button.isVisible())) {
				results.push({ check, status: 'skip', detail: 'fullscreen control hidden in viewport' });
				continue;
			}

			await button.click();
			await page.waitForTimeout(200);
			const entered = await page.evaluate(() => Boolean(document.fullscreenElement));
			if (entered) await page.keyboard.press('Escape');
			results.push({
				check,
				status: entered ? 'pass' : 'fail',
				detail: `entered=${entered}`,
			});
			continue;
		}

		results.push({ check, status: 'skip', detail: 'unknown check' });
	}

	return results;
}

async function checkFocusReachable(page, selector, required) {
	const count = await page.locator(selector).count();
	if (count === 0) {
		return {
			selector,
			required,
			present: false,
			reachable: null,
			tabs: null,
			status: required ? 'fail' : 'skip',
		};
	}

	await page.evaluate(() => {
		const active = document.activeElement;
		if (active instanceof HTMLElement) active.blur();
	});

	await page.locator('body').first().click({ force: true });

	const maxTabs = 100;
	for (let i = 1; i <= maxTabs; i++) {
		await page.keyboard.press('Tab');
		const reached = await page.evaluate((targetSelector) => {
			const active = document.activeElement;
			if (!(active instanceof HTMLElement)) return false;
			return active.matches(targetSelector) || active.closest(targetSelector) !== null;
		}, selector);

		if (reached) {
			return {
				selector,
				required,
				present: true,
				reachable: true,
				tabs: i,
				status: 'pass',
			};
		}
	}

	return {
		selector,
		required,
		present: true,
		reachable: false,
		tabs: maxTabs,
		status: 'fail',
	};
}

async function captureRouteArtifacts(page, routePath, routeSummary, artifactsRoot) {
	const routeDir = join(artifactsRoot, sanitizeRoute(routePath));
	mkdirSync(routeDir, { recursive: true });

	const screenshotPath = join(routeDir, 'page.png');
	const domPath = join(routeDir, 'dom.html');
	const violationsPath = join(routeDir, 'violations.json');

	await page.screenshot({ path: screenshotPath, fullPage: true });
	writeFileSync(domPath, await page.content());
	writeFileSync(
		violationsPath,
		JSON.stringify(
			{
				route: routePath,
				violations: routeSummary.violations,
				interactionChecks: routeSummary.interactionChecks,
				focusChecks: routeSummary.focusChecks,
			},
			null,
			2,
		) + '\n',
	);

	return {
		screenshot: screenshotPath,
		dom: domPath,
		violations: violationsPath,
	};
}

async function auditRoute(page, routeConfig, artifactsRoot) {
	const routePath = normalizeRoute(routeConfig.path);
	const url = `${PREVIEW_URL}${routePath}`;

	await page.goto(url, { waitUntil: 'networkidle' });
	await page.waitForTimeout(180);
	await page.addScriptTag({ content: AXE_SOURCE });

	const interactionChecks = await runInteractionChecks(page, routeConfig.checks);
	const requiredFocusSelectors = routeConfig.requiredFocusSelectors ?? [];
	const focusChecks = [];
	for (const selector of requiredFocusSelectors) {
		focusChecks.push(await checkFocusReachable(page, selector, true));
	}

	const axeResults = await page.evaluate(async () => {
		return window.axe.run(document, {
			runOnly: {
				type: 'tag',
				values: ['wcag2a', 'wcag2aa', 'best-practice'],
			},
			rules: {
				// Dynamic canvas backgrounds can make computed contrast highly non-deterministic in CI.
				// Contrast remains tracked via Lighthouse accessibility scoring.
				'color-contrast': { enabled: false },
			},
		});
	});

	const violations = axeResults.violations.map((violation) => ({
		id: violation.id,
		impact: violation.impact,
		help: violation.help,
		nodes: violation.nodes.length,
	}));

	const critical = impactCount(axeResults.violations, 'critical');
	const serious = impactCount(axeResults.violations, 'serious');
	const moderate = impactCount(axeResults.violations, 'moderate');
	const minor = impactCount(axeResults.violations, 'minor');
	const interactionFailures = interactionChecks.filter((check) => check.status === 'fail').length;
	const focusFailures = focusChecks.filter((check) => check.status === 'fail').length;
	const status =
		critical > 0 || serious > 0 || interactionFailures > 0 || focusFailures > 0 ? 'fail' : 'pass';

	const routeSummary = {
		route: routePath,
		url,
		critical,
		serious,
		moderate,
		minor,
		violations,
		interactionChecks,
		focusChecks,
		interactionFailures,
		focusFailures,
		status,
		artifacts: null,
	};

	if (status === 'fail') {
		routeSummary.artifacts = await captureRouteArtifacts(
			page,
			routePath,
			routeSummary,
			artifactsRoot,
		);
	}

	return routeSummary;
}

async function main() {
	const server = startPreviewServer();
	let browser;

	try {
		await waitForServer(`${PREVIEW_URL}${BASE_PATH}/`);

		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage();

		const artifactRunId = new Date().toISOString().replace(/[:.]/g, '-');
		const artifactsRoot = resolve('.a11y/artifacts', artifactRunId);
		const routeResults = [];

		for (const routeConfig of ROUTES) {
			routeResults.push(await auditRoute(page, routeConfig, artifactsRoot));
		}

		const summary = {
			generated: new Date().toISOString(),
			baseUrl: PREVIEW_URL,
			manifestPath,
			pagesAudited: routeResults.length,
			critical: routeResults.reduce((sum, route) => sum + route.critical, 0),
			serious: routeResults.reduce((sum, route) => sum + route.serious, 0),
			moderate: routeResults.reduce((sum, route) => sum + route.moderate, 0),
			minor: routeResults.reduce((sum, route) => sum + route.minor, 0),
			focusChecks: routeResults.reduce((sum, route) => sum + route.focusChecks.length, 0),
			interactionFailures: routeResults.reduce((sum, route) => sum + route.interactionFailures, 0),
			focusFailures: routeResults.reduce((sum, route) => sum + route.focusFailures, 0),
			routes: routeResults,
			status: 'pass',
			artifactsRoot: null,
		};

		if (
			summary.critical > 0 ||
			summary.serious > 0 ||
			summary.interactionFailures > 0 ||
			summary.focusFailures > 0
		) {
			summary.status = 'fail';
			summary.artifactsRoot = artifactsRoot;
		}

		if (jsonOutPath) {
			const absolute = resolve(jsonOutPath);
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(absolute, JSON.stringify(summary, null, 2) + '\n');
		}

		if (jsonStdout) {
			console.log(JSON.stringify(summary, null, 2));
		} else {
			console.log(`Runtime a11y pages audited: ${summary.pagesAudited}`);
			console.log(`Critical: ${summary.critical}`);
			console.log(`Serious:  ${summary.serious}`);
			console.log(`Moderate: ${summary.moderate}`);
			console.log(`Minor:    ${summary.minor}`);
			console.log(`Focus checks: ${summary.focusChecks}`);
			console.log(`Interaction failures: ${summary.interactionFailures}`);
			console.log(`Focus failures: ${summary.focusFailures}`);
			if (summary.artifactsRoot) console.log(`Artifacts: ${summary.artifactsRoot}`);

			if (verbose) {
				summary.routes.forEach((route) => {
					if (route.violations.length || route.interactionFailures || route.focusFailures) {
						console.log(`- ${route.route}`);
						route.violations.forEach((violation) => {
							console.log(
								`  [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes} nodes)`,
							);
						});
						route.interactionChecks
							.filter((check) => check.status === 'fail')
							.forEach((check) => {
								console.log(`  [interaction] ${check.check}: ${check.detail}`);
							});
						route.focusChecks
							.filter((check) => check.status === 'fail')
							.forEach((check) => {
								console.log(
									`  [focus] ${check.selector}: required=${check.required} reachable=${check.reachable}`,
								);
							});
					}
				});
			}

			console.log(
				summary.status === 'pass'
					? 'PASS: runtime a11y checks clean.'
					: 'FAIL: runtime a11y regressions detected.',
			);
		}

		process.exit(summary.status === 'pass' ? 0 : 1);
	} catch (error) {
		console.error('Runtime a11y audit failed:', error);
		process.exit(1);
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

main();
