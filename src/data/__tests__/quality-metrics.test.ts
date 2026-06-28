import { describe, expect, it } from 'vitest';
import type { QualityMetrics } from '../../types/data';
import rawQuality from '../quality-metrics.json';

const quality = rawQuality as unknown as QualityMetrics;

describe('quality-metrics.json', () => {
	it('uses measured test totals when artifacts exist, otherwise nullable fallbacks', () => {
		if (quality.tests.total === null || quality.tests.passed === null) {
			expect(quality.tests.total).toBeNull();
			expect(quality.tests.passed).toBeNull();
			return;
		}

		expect(typeof quality.tests.total).toBe('number');
		expect(typeof quality.tests.passed).toBe('number');
		expect(quality.tests.passed).toBeLessThanOrEqual(quality.tests.total);
	});

	it('tracks static and runtime accessibility summaries separately', () => {
		expect(typeof quality.a11y.status).toBe('string');
		expect(typeof quality.a11y.static.status).toBe('string');
		expect(typeof quality.a11y.runtime.status).toBe('string');
		expect(
			typeof quality.a11y.runtime.routesCovered === 'number' ||
				quality.a11y.runtime.routesCovered === null,
		).toBe(true);
		expect(
			typeof quality.a11y.runtime.totalRoutes === 'number' ||
				quality.a11y.runtime.totalRoutes === null,
		).toBe(true);
		expect(
			typeof quality.a11y.runtime.coveragePct === 'number' ||
				quality.a11y.runtime.coveragePct === null,
		).toBe(true);
	});

	it('includes security and performance measured fields', () => {
		expect(typeof quality.security.status).toBe('string');
		expect(typeof quality.security.allowlistActive).toBe('number');
		expect(typeof quality.security.prodCounts).toBe('object');
		expect(typeof quality.security.devCounts).toBe('object');
		expect(typeof quality.security.githubAdvisoryStatus).toBe('string');
		expect(
			typeof quality.security.githubOpenAlerts === 'number' ||
				quality.security.githubOpenAlerts === null,
		).toBe(true);
		expect(
			quality.security.policyCheckpoint === null ||
				typeof quality.security.policyCheckpoint.date === 'string',
		).toBe(true);
		expect(typeof quality.performance.routeBudgetsStatus).toBe('string');
		expect(typeof quality.performance.chunkBudgetsStatus).toBe('string');
		expect(typeof quality.performance.interactionBudgetsStatus).toBe('string');
		const routeCheckpoint = quality.performance.routeBudgetCheckpoint as { date?: unknown } | null;
		const chunkCheckpoint = quality.performance.chunkBudgetCheckpoint as { date?: unknown } | null;
		const interactionCheckpoint = quality.performance.interactionBudgetCheckpoint as {
			date?: unknown;
		} | null;
		expect(routeCheckpoint === null || typeof routeCheckpoint.date === 'string').toBe(true);
		expect(chunkCheckpoint === null || typeof chunkCheckpoint.date === 'string').toBe(true);
		expect(interactionCheckpoint === null || typeof interactionCheckpoint.date === 'string').toBe(
			true,
		);
		expect(Array.isArray(quality.performance.largestChunks)).toBe(true);
		expect(typeof quality.performance.interactiveRouteJsTotals).toBe('object');
		expect(typeof quality.performance.routeJsTotals).toBe('object');
		expect(typeof quality.runtimeErrors.status).toBe('string');
		expect(typeof quality.stability.status).toBe('string');
	});

	it('includes provenance strings for every metric family', () => {
		expect(typeof quality.sources.tests).toBe('string');
		expect(typeof quality.sources.security).toBe('string');
		expect(typeof quality.sources.securityProd).toBe('string');
		expect(typeof quality.sources.securityGithub).toBe('string');
		expect(typeof quality.sources.securityDrift).toBe('string');
		expect(typeof quality.sources.coverage).toBe('string');
		expect(typeof quality.sources.lighthouse).toBe('string');
		expect(typeof quality.sources.a11yStatic).toBe('string');
		expect(typeof quality.sources.a11yRuntime).toBe('string');
		expect(typeof quality.sources.runtimeCoverage).toBe('string');
		expect(typeof quality.sources.e2eSmoke).toBe('string');
		expect(typeof quality.sources.runtimeErrors).toBe('string');
		expect(typeof quality.sources.greenRuns).toBe('string');
		expect(typeof quality.sources.ledger).toBe('string');
		expect(typeof quality.sources.policyGovernance).toBe('string');
		expect(typeof quality.sources.performance).toBe('string');
		expect(typeof quality.sources.build).toBe('string');
	});
});
