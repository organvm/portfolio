#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseOption } from './lib/cli-utils.mjs';

function countTestsFromSuites(suites = []) {
	let total = 0;

	for (const suite of suites) {
		const specs = Array.isArray(suite.specs) ? suite.specs : [];
		const nestedSuites = Array.isArray(suite.suites) ? suite.suites : [];
		for (const spec of specs) {
			total += Array.isArray(spec.tests) ? spec.tests.length : 0;
		}
		total += countTestsFromSuites(nestedSuites);
	}

	return total;
}

const outputPath = resolve(parseOption('json-out', '.quality/e2e-smoke-summary.json'));
const reportPath = resolve('.quality/e2e-smoke-report.json');
const distPath = resolve('dist');

if (!existsSync(distPath)) {
	console.error('dist/ not found. Run `npm run build` before e2e smoke tests.');
	process.exit(1);
}

mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(dirname(outputPath), { recursive: true });
if (existsSync(reportPath)) rmSync(reportPath);

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
	npxCmd,
	['playwright', 'test', '--config=.config/playwright.smoke.config.ts'],
	{
		cwd: resolve('.'),
		env: process.env,
		encoding: 'utf-8',
		stdio: ['inherit', 'pipe', 'pipe'],
	},
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

let report = null;
if (existsSync(reportPath)) {
	report = JSON.parse(readFileSync(reportPath, 'utf-8'));
}

const stats = report?.stats ?? {};
const expected = Number.isFinite(stats.expected)
	? stats.expected
	: countTestsFromSuites(report?.suites ?? []);
const unexpected = Number.isFinite(stats.unexpected) ? stats.unexpected : 0;
const flaky = Number.isFinite(stats.flaky) ? stats.flaky : 0;
const skipped = Number.isFinite(stats.skipped) ? stats.skipped : 0;
const durationMs = Number.isFinite(stats.duration) ? stats.duration : null;

const failures = [];
if (result.status !== 0) failures.push(`playwright exit code ${result.status}`);
if (report === null) failures.push(`playwright report missing at ${reportPath}`);
if (expected <= 0) failures.push('no smoke tests reported');
if (unexpected > 0) failures.push(`unexpected failures ${unexpected}`);
if (flaky > 0) failures.push(`flaky tests ${flaky}`);

const summary = {
	generated: new Date().toISOString(),
	source: reportPath,
	expected,
	unexpected,
	flaky,
	skipped,
	durationMs,
	status: failures.length === 0 ? 'pass' : 'fail',
	failures,
};

writeFileSync(outputPath, JSON.stringify(summary, null, 2) + '\n');

if (summary.status === 'fail') {
	console.error('E2E smoke gate failed:');
	failures.forEach((failure) => console.error(`- ${failure}`));
	process.exit(1);
}

console.log(`E2E smoke gate passed (${expected} tests, flaky=${flaky}).`);
