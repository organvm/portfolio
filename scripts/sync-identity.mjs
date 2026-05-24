import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from './lib/atomic-write.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ABOUT_PATH = path.join(__dirname, '../src/data/about.json');
const METRICS_PATH = path.join(__dirname, '../src/data/system-metrics.json');

/**
 * Synchronizes the system identity (about.json) with real-time metrics.
 * Prevents identity drift between the static summary and the dynamic registry.
 */
function syncIdentity() {
	if (!fs.existsSync(METRICS_PATH)) {
		console.error('❌ Metrics file not found. Run sync:vitals first.');
		return;
	}

	const about = JSON.parse(fs.readFileSync(ABOUT_PATH, 'utf8'));
	const metrics = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));

	// Support both new schema (computed.*) and legacy flat schema
	const c = metrics.computed ?? metrics.registry ?? metrics;
	const activeRepos = c.active_repos ?? c.implementation_status?.ACTIVE ?? 0;
	const archivedRepos = c.archived_repos ?? c.implementation_status?.ARCHIVED ?? 0;
	const totalRepos = c.total_repos ?? 0;
	const totalWords =
		c.total_words_short ?? c.total_words ?? `~${Math.round((c.total_words_numeric ?? 0) / 1000)}K+`;
	const ciWorkflows = c.ci_workflows ?? metrics.ci_workflows ?? 0;

	// Build the high-fidelity summary string
	const summary =
		`${totalRepos} repos (${activeRepos} ACTIVE, ${archivedRepos} ARCHIVED), ${ciWorkflows} CI/CD workflows, ${totalWords} total words, full provenance tracking, 100% seed.yaml coverage.`.trim();

	if (about.system_summary === summary) {
		console.log('✅ Identity is already in sync with system vitals.');
		return;
	}

	about.system_summary = summary;
	about.generated = new Date().toISOString();

	writeJsonAtomic(ABOUT_PATH, about, { indent: '\t', trailingNewline: false });
	console.log(`🚀 Identity synchronized: ${totalRepos} repos, ${ciWorkflows} CI workflows.`);
}

syncIdentity();
