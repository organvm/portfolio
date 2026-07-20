#!/usr/bin/env node

/**
 * Post-deploy smoke test. Verifies the live site is healthy.
 * Exit 0 = healthy, exit 1 = broken (triggers rollback).
 */

const BASE_URL = process.env.DEPLOY_URL || 'https://4444j99.github.io/portfolio';

const CHECKS = [
	{ path: '/', expect: { status: 200, bodyContains: 'Anthony' } },
	{ path: '/about/', expect: { status: 200, bodyContains: 'About' } },
	{ path: '/dashboard/', expect: { status: 200, bodyContains: 'Dashboard' } },
	{ path: '/resume/', expect: { status: 200 } },
	{ path: '/projects/orchestration-hub/', expect: { status: 200 } },
];

async function check({ path, expect }) {
	const url = `${BASE_URL}${path}`;
	try {
		const res = await fetch(url, { redirect: 'follow' });
		if (res.status !== expect.status) {
			return { path, ok: false, reason: `status ${res.status} !== ${expect.status}` };
		}
		if (expect.bodyContains) {
			const body = await res.text();
			if (!body.includes(expect.bodyContains)) {
				return { path, ok: false, reason: `body missing "${expect.bodyContains}"` };
			}
		}
		return { path, ok: true };
	} catch (err) {
		return { path, ok: false, reason: err.message };
	}
}

async function main() {
	console.log(`Post-deploy smoke: ${BASE_URL}\n`);

	// GitHub Pages propagation delay
	await new Promise((r) => setTimeout(r, 5000));

	const results = await Promise.all(CHECKS.map(check));
	let failures = 0;

	for (const r of results) {
		const icon = r.ok ? '✓' : '✘';
		console.log(`  ${icon} ${r.path}${r.reason ? ` — ${r.reason}` : ''}`);
		if (!r.ok) failures++;
	}

	console.log(
		`\n${failures === 0 ? '✓ All checks passed' : `✘ ${failures}/${results.length} failed`}`,
	);
	process.exit(failures > 0 ? 1 : 0);
}

main();
