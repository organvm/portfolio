#!/usr/bin/env node

/**
 * Adds system navigation footer to individual project repo READMEs.
 * Links back to the portfolio case study (if one exists), parent organ
 * landing page, and system directory.
 *
 * Usage:
 *   node scripts/update-project-readmes.mjs              # preview
 *   node scripts/update-project-readmes.mjs --write       # write locally
 *   node scripts/update-project-readmes.mjs --commit      # write + commit + push
 *   node scripts/update-project-readmes.mjs --org organvm-i-theoria  # single org
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const WORKSPACE = resolve(homedir(), 'Workspace');
const PAGES_JSON = resolve('src/data/github-pages.json');
const doWrite = process.argv.includes('--write') || process.argv.includes('--commit');
const doCommit = process.argv.includes('--commit');
const orgFilter = (() => {
	const idx = process.argv.indexOf('--org');
	return idx !== -1 ? process.argv[idx + 1] : null;
})();

// Map project repo slugs to portfolio case study page slugs
const CASE_STUDY_MAP = {};
const projectPagesDir = resolve('src/pages/projects');
if (existsSync(projectPagesDir)) {
	for (const file of readdirSync(projectPagesDir)) {
		if (file.endsWith('.astro')) {
			const slug = file.replace('.astro', '');
			CASE_STUDY_MAP[slug] = `https://4444j99.dev/projects/${slug}/`;
		}
	}
}

const ORGAN_NAMES = {
	'organvm-i-theoria': 'I \u00B7 Theoria',
	'organvm-ii-poiesis': 'II \u00B7 Poiesis',
	'organvm-iii-ergon': 'III \u00B7 Ergon',
	'organvm-iv-taxis': 'IV \u00B7 Taxis',
	'organvm-v-logos': 'V \u00B7 Logos',
	'organvm-vi-koinonia': 'VI \u00B7 Koinonia',
	'organvm-vii-kerygma': 'VII \u00B7 Kerygma',
	'meta-organvm': 'Meta',
};

// Load github-pages data for matching
const pagesData = JSON.parse(readFileSync(PAGES_JSON, 'utf-8'));
const builtRepos = pagesData.repos.filter((r) => r.status === 'built');

// Skip these repos (landing pages, profiles, etc.)
const SKIP_REPOS = new Set(['.github']);

function findCaseStudy(repoName) {
	// Try direct slug match
	const normalized = repoName.toLowerCase().replace(/--/g, '-').replace(/_/g, '-');
	for (const [slug, url] of Object.entries(CASE_STUDY_MAP)) {
		if (normalized.includes(slug) || slug.includes(normalized.split('--')[0])) {
			return { slug, url };
		}
	}
	return null;
}

function makeFooter(owner, repoName) {
	const organName = ORGAN_NAMES[owner] || owner;
	const organUrl = `https://${owner}.github.io/`;
	const caseStudy = findCaseStudy(repoName);

	const links = [
		`[Portfolio](https://4444j99.dev/)`,
		`[System Directory](https://4444j99.dev/directory/)`,
		`[ORGAN ${organName}](${organUrl})`,
	];

	if (caseStudy) {
		links.unshift(`[Case Study](${caseStudy.url})`);
	}

	return [
		'<!-- SYSTEM-NAV-START -->',
		'',
		'---',
		'',
		`<sub>${links.join(' \u00B7 ')} \u00B7 Part of the <a href="https://4444j99.dev/directory/">ORGANVM eight-organ system</a></sub>`,
		'',
		'<!-- SYSTEM-NAV-END -->',
	].join('\n');
}

let updated = 0;
let skipped = 0;
let errors = 0;

for (const repo of builtRepos) {
	if (SKIP_REPOS.has(repo.repo)) continue;
	if (repo.repo.endsWith('.github.io')) continue;
	if (orgFilter && repo.owner !== orgFilter) continue;

	const repoDir = resolve(WORKSPACE, repo.owner, repo.repo);
	const readmePath = join(repoDir, 'README.md');

	if (!existsSync(readmePath)) {
		skipped++;
		continue;
	}

	let content = readFileSync(readmePath, 'utf-8');

	// Remove existing nav footer
	content = content.replace(/<!-- SYSTEM-NAV-START -->[\s\S]*?<!-- SYSTEM-NAV-END -->\n?/, '');

	const footer = makeFooter(repo.owner, repo.repo);
	content = content.trimEnd() + '\n\n' + footer + '\n';

	if (!doWrite) {
		const cs = findCaseStudy(repo.repo);
		console.log(`  ~ ${repo.owner}/${repo.repo}${cs ? ` (case study: ${cs.slug})` : ''}`);
		updated++;
		continue;
	}

	writeFileSync(readmePath, content);

	if (doCommit) {
		try {
			execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });
			execSync('git commit -m "chore: add system navigation footer to README"', {
				cwd: repoDir,
				stdio: 'pipe',
			});
			execSync('git push origin HEAD', { cwd: repoDir, stdio: 'pipe', timeout: 30000 });
			console.log(`  + ${repo.owner}/${repo.repo} - pushed`);
			updated++;
		} catch (err) {
			const msg = err.message || '';
			if (msg.includes('nothing to commit')) {
				console.log(`  = ${repo.owner}/${repo.repo} - no changes`);
			} else if (msg.includes('protected branch') || msg.includes('remote rejected')) {
				console.log(`  ! ${repo.owner}/${repo.repo} - branch protected`);
				errors++;
			} else {
				console.log(`  x ${repo.owner}/${repo.repo} - ${msg.split('\n')[0]}`);
				errors++;
			}
		}
	} else {
		console.log(`  + ${repo.owner}/${repo.repo} - written`);
		updated++;
	}
}

console.log(`\nUpdated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
if (!doWrite) console.log('Preview only. Add --write to save, --commit to save + push.');
