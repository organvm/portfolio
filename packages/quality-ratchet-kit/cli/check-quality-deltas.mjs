#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const POLICY_PATH = resolve('.quality/ratchet-policy.json');
const BASELINE_PATH = resolve('src/data/quality-metrics-baseline.json');
const CURRENT_PATH = resolve('src/data/quality-metrics.json');
const OUTPUT_PATH = resolve('.quality/delta-summary.json');

function parseOption(argv, name) {
	const eqArg = argv.find((entry) => entry.startsWith(`--${name}=`));
	if (eqArg) return eqArg.slice(eqArg.indexOf('=') + 1);
	const index = argv.indexOf(`--${name}`);
	if (index >= 0) return argv[index + 1] ?? null;
	return null;
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf-8'));
}

function metricDelta(current, baseline) {
	if (typeof current !== 'number' || typeof baseline !== 'number') return null;
	return Number((current - baseline).toFixed(2));
}

const args = process.argv.slice(2);
const phaseOption = parseOption(args, 'phase');

if (!existsSync(POLICY_PATH)) {
	console.error(`Missing ratchet policy: ${POLICY_PATH}`);
	process.exit(1);
}
if (!existsSync(BASELINE_PATH)) {
	console.error(`Missing quality baseline: ${BASELINE_PATH}`);
	process.exit(1);
}
if (!existsSync(CURRENT_PATH)) {
	console.error(`Missing current quality metrics: ${CURRENT_PATH}`);
	process.exit(1);
}

const policy = readJson(POLICY_PATH);
const phase = phaseOption || process.env.QUALITY_PHASE || policy.defaultPhase || 'W6';
const baseline = readJson(BASELINE_PATH);
const current = readJson(CURRENT_PATH);
const rules = policy.regression || {};

const regressions = [];

function evaluateDrop(group, metric, maxDrop) {
	const delta = metricDelta(current[group]?.[metric], baseline[group]?.[metric]);
	if (delta === null) return;
	if (delta < -maxDrop) {
		regressions.push({
			category: group,
			metric,
			baseline: baseline[group][metric],
			current: current[group][metric],
			delta,
			allowedDrop: maxDrop,
			message: `${group}.${metric} dropped by ${Math.abs(delta)} (allowed ${maxDrop})`,
		});
	}
}

function evaluateIncrease(group, metric, maxIncrease = 0) {
	const delta = metricDelta(current[group]?.[metric], baseline[group]?.[metric]);
	if (delta === null) return;
	if (delta > maxIncrease) {
		regressions.push({
			category: group,
			metric,
			baseline: baseline[group][metric],
			current: current[group][metric],
			delta,
			allowedDrop: maxIncrease,
			message: `${group}.${metric} increased by ${delta} (allowed ${maxIncrease})`,
		});
	}
}

const coverageRules = rules.coverageMaxDrop || {};
for (const metric of ['statements', 'branches', 'functions', 'lines']) {
	evaluateDrop('coverage', metric, coverageRules[metric] ?? 0);
}

const lighthouseRules = rules.lighthouseMaxDrop || {};
for (const metric of ['performance', 'accessibility', 'bestPractices', 'seo']) {
	evaluateDrop('lighthouse', metric, lighthouseRules[metric] ?? 0);
}

const securityRules = rules.securityMaxIncrease || {};
for (const metric of ['critical', 'high', 'moderate', 'low']) {
	evaluateIncrease('security', metric, securityRules[metric] ?? 0);
}

const baselineCritical =
	(baseline.a11y?.static?.critical ?? 0) + (baseline.a11y?.runtime?.critical ?? 0);
const baselineSerious =
	(baseline.a11y?.static?.serious ?? 0) + (baseline.a11y?.runtime?.serious ?? 0);
const currentCritical =
	(current.a11y?.static?.critical ?? 0) + (current.a11y?.runtime?.critical ?? 0);
const currentSerious = (current.a11y?.static?.serious ?? 0) + (current.a11y?.runtime?.serious ?? 0);
const maxCriticalIncrease = rules.a11y?.maxCriticalIncrease ?? 0;
const maxSeriousIncrease = rules.a11y?.maxSeriousIncrease ?? 0;

if (currentCritical - baselineCritical > maxCriticalIncrease) {
	regressions.push({
		category: 'a11y',
		metric: 'critical',
		baseline: baselineCritical,
		current: currentCritical,
		delta: currentCritical - baselineCritical,
		allowedDrop: maxCriticalIncrease,
		message: `a11y critical violations increased by ${currentCritical - baselineCritical}`,
	});
}

if (currentSerious - baselineSerious > maxSeriousIncrease) {
	regressions.push({
		category: 'a11y',
		metric: 'serious',
		baseline: baselineSerious,
		current: currentSerious,
		delta: currentSerious - baselineSerious,
		allowedDrop: maxSeriousIncrease,
		message: `a11y serious violations increased by ${currentSerious - baselineSerious}`,
	});
}

if (baseline.a11y?.status === 'pass' && current.a11y?.status !== 'pass') {
	regressions.push({
		category: 'a11y',
		metric: 'status',
		baseline: baseline.a11y.status,
		current: current.a11y?.status,
		delta: null,
		allowedDrop: 0,
		message: `a11y status regressed from ${baseline.a11y.status} to ${current.a11y?.status}`,
	});
}

if (
	baseline.performance?.routeBudgetsStatus === 'pass' &&
	current.performance?.routeBudgetsStatus !== 'pass'
) {
	regressions.push({
		category: 'performance',
		metric: 'routeBudgetsStatus',
		baseline: baseline.performance.routeBudgetsStatus,
		current: current.performance?.routeBudgetsStatus,
		delta: null,
		allowedDrop: 0,
		message: `performance route budgets regressed from ${baseline.performance.routeBudgetsStatus} to ${current.performance?.routeBudgetsStatus}`,
	});
}

if (
	baseline.performance?.chunkBudgetsStatus === 'pass' &&
	current.performance?.chunkBudgetsStatus !== 'pass'
) {
	regressions.push({
		category: 'performance',
		metric: 'chunkBudgetsStatus',
		baseline: baseline.performance.chunkBudgetsStatus,
		current: current.performance?.chunkBudgetsStatus,
		delta: null,
		allowedDrop: 0,
		message: `performance chunk budgets regressed from ${baseline.performance.chunkBudgetsStatus} to ${current.performance?.chunkBudgetsStatus}`,
	});
}

if (
	baseline.performance?.interactionBudgetsStatus === 'pass' &&
	current.performance?.interactionBudgetsStatus !== 'pass'
) {
	regressions.push({
		category: 'performance',
		metric: 'interactionBudgetsStatus',
		baseline: baseline.performance.interactionBudgetsStatus,
		current: current.performance?.interactionBudgetsStatus,
		delta: null,
		allowedDrop: 0,
		message: `performance interaction budgets regressed from ${baseline.performance.interactionBudgetsStatus} to ${current.performance?.interactionBudgetsStatus}`,
	});
}

const baselineGithubAlerts = baseline.security?.githubOpenAlerts;
const currentGithubAlerts = current.security?.githubOpenAlerts;
if (
	typeof baselineGithubAlerts === 'number' &&
	typeof currentGithubAlerts === 'number' &&
	currentGithubAlerts > baselineGithubAlerts
) {
	regressions.push({
		category: 'security',
		metric: 'githubOpenAlerts',
		baseline: baselineGithubAlerts,
		current: currentGithubAlerts,
		delta: currentGithubAlerts - baselineGithubAlerts,
		allowedDrop: 0,
		message: `security github open alerts increased by ${currentGithubAlerts - baselineGithubAlerts}`,
	});
}

if (baseline.runtimeErrors?.status === 'pass' && current.runtimeErrors?.status !== 'pass') {
	regressions.push({
		category: 'runtimeErrors',
		metric: 'status',
		baseline: baseline.runtimeErrors.status,
		current: current.runtimeErrors?.status,
		delta: null,
		allowedDrop: 0,
		message: `runtime error telemetry regressed from ${baseline.runtimeErrors.status} to ${current.runtimeErrors?.status}`,
	});
}

const baselineRuntimeUncategorized = baseline.runtimeErrors?.uncategorized;
const currentRuntimeUncategorized = current.runtimeErrors?.uncategorized;
if (
	typeof baselineRuntimeUncategorized === 'number' &&
	typeof currentRuntimeUncategorized === 'number' &&
	currentRuntimeUncategorized > baselineRuntimeUncategorized
) {
	regressions.push({
		category: 'runtimeErrors',
		metric: 'uncategorized',
		baseline: baselineRuntimeUncategorized,
		current: currentRuntimeUncategorized,
		delta: currentRuntimeUncategorized - baselineRuntimeUncategorized,
		allowedDrop: 0,
		message: `runtime uncategorized errors increased by ${currentRuntimeUncategorized - baselineRuntimeUncategorized}`,
	});
}

regressions.sort((a, b) => {
	if (a.delta === null && b.delta === null) return 0;
	if (a.delta === null) return 1;
	if (b.delta === null) return -1;
	return a.delta - b.delta;
});

const summary = {
	generated: new Date().toISOString(),
	phase,
	baselinePath: BASELINE_PATH,
	currentPath: CURRENT_PATH,
	regressions,
	status: regressions.length ? 'fail' : 'pass',
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2) + '\n');

if (summary.status === 'fail') {
	console.error('Quality delta checks failed:');
	regressions.forEach((regression) => console.error(`- ${regression.message}`));
	process.exit(1);
}

console.log(`Quality delta checks passed for phase ${phase}.`);
