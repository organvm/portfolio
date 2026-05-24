#!/usr/bin/env node

/**
 * sync-workspace-health.mjs
 *
 * Fetches build status, last commit date, and test counts for all repos
 * in the 4444J99 workspace via the GitHub API, then writes workspace-health.json.
 *
 * Usage:
 *   node scripts/sync-workspace-health.mjs [--output path]
 *
 * Requires: GH_TOKEN or GITHUB_TOKEN environment variable for API access.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { writeJsonAtomic } from './lib/atomic-write.mjs';

const DEFAULT_OUTPUT = resolve('src/data/workspace-health.json');
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 ? resolve(args[outputIdx + 1]) : DEFAULT_OUTPUT;

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN; // allow-secret
const headers = {
	Accept: 'application/vnd.github+json',
	'User-Agent': 'sync-workspace-health/1.0',
};
if (token) {
	headers.Authorization = `Bearer ${token}`;
}

const REPOS = [
	{ name: 'portfolio', owner: '4444J99' },
	{ name: '4444J99', owner: '4444J99' },
	{ name: 'theoretical-specifications-first', owner: '4444J99' },
	{ name: 'intake', owner: '4444J99' },
];

async function fetchJson(url) {
	const res = await fetch(url, { headers });
	if (!res.ok) return null;
	return res.json();
}

async function getRepoHealth(owner, name) {
	const base = `https://api.github.com/repos/${owner}/${name}`;

	const [repoData, runs] = await Promise.all([
		fetchJson(base),
		fetchJson(`${base}/actions/runs?per_page=1&status=completed`),
	]);

	const lastCommit = repoData?.pushed_at ?? null;
	const latestRun = runs?.workflow_runs?.[0];
	const buildStatus = latestRun?.conclusion ?? null;

	return {
		name,
		owner,
		lastCommit,
		buildStatus,
		testCount: null,
		coverage: null,
		url: `https://github.com/${owner}/${name}`,
	};
}

async function main() {
	console.log('Syncing workspace health data...');

	const results = await Promise.all(
		REPOS.map(({ owner, name }) =>
			getRepoHealth(owner, name).catch((err) => {
				console.warn(`Failed to fetch ${owner}/${name}: ${err.message}`);
				return {
					name,
					owner,
					lastCommit: null,
					buildStatus: null,
					testCount: null,
					coverage: null,
					url: `https://github.com/${owner}/${name}`,
				};
			}),
		),
	);

	const output = {
		lastSync: new Date().toISOString(),
		repos: results,
	};

	mkdirSync(dirname(outputPath), { recursive: true });
	writeJsonAtomic(outputPath, output);
	console.log(`Wrote workspace health to ${outputPath}`);
}

main().catch((err) => {
	console.error('sync-workspace-health failed:', err);
	process.exit(1);
});
