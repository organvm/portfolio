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

const HUB_FOOTER = [
	'<!-- PORTFOLIO-HUB-START -->',
	'---',
	'',
	'<div align="center">',
	'',
	'**Explore the System**',
	'',
	'[Portfolio](https://4444j99.github.io/portfolio/) · [System Directory](https://4444j99.github.io/portfolio/directory/) · [49 Essays](https://organvm-v-logos.github.io/public-process/) · [Knowledge Base](https://organvm-i-theoria.github.io/my-knowledge-base/) · [Consult](https://4444j99.github.io/portfolio/consult/)',
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
