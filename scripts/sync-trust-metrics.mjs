import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from './lib/atomic-write.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUALITY_DIR = path.join(__dirname, '../.quality');
const LOGOS_DIR = path.join(__dirname, '../src/content/logos');
const DATA_DIR = path.join(__dirname, '../src/data');
const VITALS_PATH = path.join(DATA_DIR, 'vitals.json');
const TRUST_VITALS_PATH = path.join(DATA_DIR, 'trust-vitals.json');
const SYSTEM_METRICS_PATH = path.join(DATA_DIR, 'system-metrics.json');
const HUMAN_IMPACT_PATH = path.join(DATA_DIR, 'human-impact.json');

async function syncVitals() {
	console.log('📡 Syncing Engineering Vitals...');

	const buildTimestamp = new Date().toISOString();
	const artifactHash = crypto
		.createHash('shake256', { outputLength: 4 })
		.update(buildTimestamp)
		.digest('hex');

	const trustVitals = {
		tests: { total: 0, passed: 0, suites: 0, status: 'unknown' },
		security: { status: 'unknown', vulnerabilities: 0, lastAudit: null },
		ecosystem: { totalRepos: 0, healthy: 0, errored: 0, status: 'unknown' },
		humanImpact: JSON.parse(fs.readFileSync(HUMAN_IMPACT_PATH, 'utf8')),
		generatedAt: buildTimestamp,
		fingerprint: artifactHash.toUpperCase(),
		strikes: { total: 0, conversionRate: 0 },
	};

	// 0. Parse Strike Log
	try {
		const OPERATIVE_LOG_PATH = path.join(DATA_DIR, 'operative-log.json');
		if (fs.existsSync(OPERATIVE_LOG_PATH)) {
			const logData = JSON.parse(fs.readFileSync(OPERATIVE_LOG_PATH, 'utf8'));
			trustVitals.strikes = {
				total: logData.global_stats.total_strikes,
				conversionRate: logData.global_stats.conversion_rate,
			};
		}
	} catch (e) {
		console.warn('⚠️ Could not parse operative-log.json');
	}

	// 1. Parse Tests
	try {
		const testData = JSON.parse(
			fs.readFileSync(path.join(QUALITY_DIR, 'vitest-report.json'), 'utf8'),
		);
		trustVitals.tests = {
			total: testData.numTotalTests,
			passed: testData.numPassedTests,
			suites: testData.numTotalTestSuites,
			status: testData.success ? 'pass' : 'fail',
		};
	} catch (e) {
		console.warn('⚠️ Could not parse vitest-report.json');
	}

	// 2. Parse Security
	try {
		const secData = JSON.parse(
			fs.readFileSync(path.join(QUALITY_DIR, 'security-summary.json'), 'utf8'),
		);
		trustVitals.security = {
			status: secData.status,
			vulnerabilities: secData.metadata.vulnerabilities.total,
			lastAudit: secData.generated,
		};
	} catch (e) {
		console.warn('⚠️ Could not parse security-summary.json');
	}

	// 3. Parse Ecosystem Telemetry
	try {
		const fleetData = JSON.parse(
			fs.readFileSync(path.join(QUALITY_DIR, 'github-pages-telemetry.json'), 'utf8'),
		);
		trustVitals.ecosystem = {
			totalRepos: fleetData.totals.repos,
			healthy: fleetData.totals.built,
			errored: fleetData.totals.errored,
			status: fleetData.syncStatus === 'ok' ? 'pass' : 'warning',
		};
	} catch (e) {
		console.warn('⚠️ Could not parse github-pages-telemetry.json');
	}

	writeJsonAtomic(TRUST_VITALS_PATH, trustVitals, { trailingNewline: false });
	console.log(`✅ Trust Vitals synced to ${TRUST_VITALS_PATH}`);

	// 4. Derive vitals.json from system-metrics.json
	try {
		const metrics = JSON.parse(fs.readFileSync(SYSTEM_METRICS_PATH, 'utf8'));
		// Support both new schema (computed.*) and legacy flat schema
		const c = metrics.computed ?? metrics.registry ?? metrics;

		// Read existing vitals to preserve fields not computable from system-metrics.json
		const existingVitals = fs.existsSync(VITALS_PATH)
			? JSON.parse(fs.readFileSync(VITALS_PATH, 'utf8'))
			: {};

		const vitals = {
			repos: {
				total: c.total_repos ?? existingVitals.repos?.total ?? 0,
				active:
					c.active_repos ?? c.implementation_status?.ACTIVE ?? existingVitals.repos?.active ?? 0,
				orgs: c.total_organs ?? existingVitals.repos?.orgs ?? 0,
			},
			substance: {
				code_files: c.code_files ?? existingVitals.substance?.code_files ?? 0,
				test_files: c.test_files ?? existingVitals.substance?.test_files ?? 0,
				automated_tests: existingVitals.substance?.automated_tests ?? 0,
				ci_passing: c.ci_workflows ?? existingVitals.substance?.ci_passing ?? 0,
				ci_coverage_pct: existingVitals.substance?.ci_coverage_pct ?? 90,
			},
			logos: {
				essays: fs.existsSync(LOGOS_DIR)
					? fs.readdirSync(LOGOS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx')).length
					: (existingVitals.logos?.essays ?? 0),
				words: c.total_words_numeric ?? c.word_counts?.total ?? existingVitals.logos?.words ?? 0,
			},
			timestamp: metrics.generated,
		};

		writeJsonAtomic(VITALS_PATH, vitals, { trailingNewline: false });
		console.log(`✅ Derived Vitals synced to ${VITALS_PATH}`);

		// 5. Update landing.json metrics from system-metrics.json
		const LANDING_PATH = path.join(DATA_DIR, 'landing.json');
		if (fs.existsSync(LANDING_PATH)) {
			const landing = JSON.parse(fs.readFileSync(LANDING_PATH, 'utf8'));
			landing.metrics = {
				total_repos: c.total_repos ?? 0,
				active_repos: c.active_repos ?? c.implementation_status?.ACTIVE ?? 0,
				archived_repos: c.archived_repos ?? c.implementation_status?.ARCHIVED ?? 0,
				dependency_edges: c.dependency_edges ?? 0,
				ci_workflows: c.ci_workflows ?? 0,
				operational_organs: c.operational_organs ?? c.total_organs ?? 0,
				sprints_completed: metrics.sprints?.completed ?? 0,
			};
			landing.generated = metrics.generated;
			writeJsonAtomic(LANDING_PATH, landing, { trailingNewline: false });
			console.log(`✅ Landing Metrics synced to ${LANDING_PATH}`);
		}
	} catch (e) {
		console.error('❌ Failed to derive metrics from system-metrics.json:', e.message);
	}
}

syncVitals().catch(console.error);
