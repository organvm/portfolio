#!/usr/bin/env node

/**
 * Updates org profile READMEs with a standardized portfolio hub footer.
 * Adds or replaces a <!-- PORTFOLIO-HUB --> section at the end of each
 * org's .github/profile/README.md.
 *
 * Usage:
 *   node scripts/update-org-profile-readmes.mjs           # preview changes
 *   node scripts/update-org-profile-readmes.mjs --write    # write changes
 *   node scripts/update-org-profile-readmes.mjs --commit   # write + commit + push
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

const WORKSPACE = resolve(homedir(), 'Workspace');
const doWrite = process.argv.includes('--write') || process.argv.includes('--commit');
const doCommit = process.argv.includes('--commit');

const ORGS = [
	'organvm-i-theoria',
	'organvm-ii-poiesis',
	'organvm-iii-ergon',
	'organvm-iv-taxis',
	'organvm-v-logos',
	'organvm-vi-koinonia',
	'organvm-vii-kerygma',
	'meta-organvm',
];

// The essay count is DERIVED from the SSOT (the corpus computes published_essays
// live from the logos _posts), never pinned. Prefer the live corpus metrics; fall
// back to the local portfolio metrics; finally drop the number rather than stamp a
// stale literal. This is the fix for the 29/40/49/65 divergence across surfaces.
const CORPUS_METRICS_URL =
	'https://raw.githubusercontent.com/organvm/organvm-corpvs-testamentvm/main/system-metrics.json';
const LOCAL_METRICS = resolve(
	WORKSPACE,
	'organvm',
	'portfolio',
	'src',
	'data',
	'system-metrics.json',
);

async function deriveEssayCount() {
	try {
		const r = await fetch(CORPUS_METRICS_URL, { signal: AbortSignal.timeout(15000) });
		if (r.ok) {
			const n = (await r.json())?.computed?.published_essays;
			if (Number.isInteger(n) && n > 0) return n;
		}
	} catch {
		/* fall through to local */
	}
	try {
		const j = JSON.parse(readFileSync(LOCAL_METRICS, 'utf-8'));
		const n = j?.computed?.published_essays ?? j?.essays?.total;
		if (Number.isInteger(n) && n > 0) return n;
	} catch {
		/* fall through to un-numbered label */
	}
	return null;
}

const ESSAYS = await deriveEssayCount();
const essaysLabel = ESSAYS ? `${ESSAYS} Essays` : 'Essays';
const HUB_FOOTER = [
	'<!-- PORTFOLIO-HUB-START -->',
	'---',
	'',
	'<div align="center">',
	'',
	'**Explore the System**',
	'',
	`[Portfolio](https://organvm.github.io/portfolio/) · [System Directory](https://organvm.github.io/portfolio/directory/) · [${essaysLabel}](https://organvm-v-logos.github.io/public-process/) · [Knowledge Base](https://organvm-i-theoria.github.io/my-knowledge-base/) · [Consult](https://organvm.github.io/portfolio/consult/)`,
	'',
	'</div>',
	'<!-- PORTFOLIO-HUB-END -->',
].join('\n');

for (const org of ORGS) {
	const readmePath = resolve(WORKSPACE, org, '.github', 'profile', 'README.md');
	if (!existsSync(readmePath)) {
		console.log(`  * ${org} - no profile README found`);
		continue;
	}

	let content = readFileSync(readmePath, 'utf-8');

	// Remove existing hub footer if present
	content = content.replace(/<!-- PORTFOLIO-HUB-START -->[\s\S]*?<!-- PORTFOLIO-HUB-END -->/, '');

	// Trim trailing whitespace and add footer
	content = content.trimEnd() + '\n\n' + HUB_FOOTER + '\n';

	if (!doWrite) {
		console.log(`  ~ ${org} - would update profile README`);
		continue;
	}

	writeFileSync(readmePath, content);
	console.log(`  + ${org} - updated profile README`);

	if (doCommit) {
		try {
			const repoDir = dirname(dirname(readmePath)); // .github dir
			execSync('git add profile/README.md', { cwd: repoDir, stdio: 'pipe' });
			execSync('git commit -m "chore: add portfolio hub links to org profile"', {
				cwd: repoDir,
				stdio: 'pipe',
			});
			execSync('git push origin main', { cwd: repoDir, stdio: 'pipe', timeout: 30000 });
			console.log(`    pushed`);
		} catch (err) {
			const msg = err.message || '';
			if (msg.includes('nothing to commit')) {
				console.log(`    no changes`);
			} else {
				console.log(`    push failed: ${msg.split('\n')[0]}`);
			}
		}
	}
}

if (!doWrite) {
	console.log('\nPreview only. Add --write to save, --commit to save + push.');
}
