import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCoverageThresholds, resolvePhase } from '../src/ratchet-loader.mjs';
import { resolveSecurityCheckpoint, sortCheckpoints } from '../src/security-policy.mjs';
import { checkThresholds } from '../src/threshold-checker.mjs';

describe('ratchet-loader', () => {
	const policy = {
		defaultPhase: 'W6',
		phases: {
			W2: { coverage: { statements: 12, branches: 8, functions: 8, lines: 12 } },
			W6: { coverage: { statements: 25, branches: 18, functions: 18, lines: 25 } },
		},
	};

	it('resolves default phase', () => {
		assert.equal(resolvePhase(policy), 'W6');
	});

	it('resolves env override phase', () => {
		assert.equal(resolvePhase(policy, 'W2'), 'W2');
	});

	it('resolves coverage thresholds for default phase', () => {
		const result = resolveCoverageThresholds(policy);
		assert.equal(result.phase, 'W6');
		assert.equal(result.coverage.statements, 25);
	});

	it('falls back when phase has no coverage', () => {
		const sparse = { defaultPhase: 'W99', phases: {} };
		const result = resolveCoverageThresholds(sparse);
		assert.equal(result.phase, 'W99');
		assert.equal(result.coverage.statements, 25); // fallback
	});
});

describe('security-policy', () => {
	const checkpoints = [
		{ date: '2026-03-07', maxModerate: 1, maxLow: 1 },
		{ date: '2026-02-21', maxModerate: 5, maxLow: 4 },
		{ date: '2026-02-28', maxModerate: 2, maxLow: 2 },
	];

	it('sorts checkpoints by date', () => {
		const sorted = sortCheckpoints(checkpoints);
		assert.equal(sorted[0].date, '2026-02-21');
		assert.equal(sorted[2].date, '2026-03-07');
	});

	it('resolves correct checkpoint for a given time', () => {
		const ref = Date.parse('2026-03-01');
		const cp = resolveSecurityCheckpoint(checkpoints, ref);
		assert.equal(cp.date, '2026-02-28');
	});

	it('returns first checkpoint when before all dates', () => {
		const ref = Date.parse('2026-01-01');
		const cp = resolveSecurityCheckpoint(checkpoints, ref);
		assert.equal(cp.date, '2026-02-21');
	});

	it('returns null for empty checkpoints', () => {
		assert.equal(resolveSecurityCheckpoint([]), null);
	});
});

describe('threshold-checker', () => {
	it('passes when all metrics meet thresholds', () => {
		const result = checkThresholds(
			{ statements: 30, branches: 20, functions: 20, lines: 30 },
			{ statements: 25, branches: 18, functions: 18, lines: 25 },
		);
		assert.equal(result.pass, true);
		assert.equal(result.failures.length, 0);
	});

	it('fails when a metric is below threshold', () => {
		const result = checkThresholds(
			{ statements: 10, branches: 20, functions: 20, lines: 30 },
			{ statements: 25, branches: 18, functions: 18, lines: 25 },
		);
		assert.equal(result.pass, false);
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].metric, 'statements');
	});

	it('reports multiple failures', () => {
		const result = checkThresholds(
			{ statements: 5, branches: 5, functions: 5, lines: 5 },
			{ statements: 25, branches: 18, functions: 18, lines: 25 },
		);
		assert.equal(result.pass, false);
		assert.equal(result.failures.length, 4);
	});

	it('fails when a required metric is missing', () => {
		const result = checkThresholds(
			{ statements: 30, branches: 20, lines: 30 },
			{ statements: 25, branches: 18, functions: 18, lines: 25 },
		);
		assert.equal(result.pass, false);
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].metric, 'functions');
	});
});
