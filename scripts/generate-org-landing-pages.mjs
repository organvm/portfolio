#!/usr/bin/env node

/**
 * Generates index.html for each organ's .github.io landing page.
 * Reads from src/data/github-pages.json and produces proper HTML with:
 * - Fixed sidebar labels (actual organ names)
 * - Portfolio hub link
 * - Knowledge Base, Public Process, Directory links
 * - Per-org repo card grid
 *
 * Output: dist-org-pages/<owner>/index.html
 *
 * Usage:
 *   node scripts/generate-org-landing-pages.mjs
 *   node scripts/generate-org-landing-pages.mjs --deploy  # also pushes to each org's .github.io repo
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PAGES_JSON = resolve('src/data/github-pages.json');
const OUTPUT_DIR = resolve('dist-org-pages');

const ORGANS = {
	'organvm-i-theoria': {
		name: 'I · Theoria',
		fullName: 'ORGAN-I: Theoria — Theory & Epistemology',
		color: '#311b92',
	},
	'organvm-ii-poiesis': {
		name: 'II · Poiesis',
		fullName: 'ORGAN-II: Poiesis — Art & Creative Systems',
		color: '#6a1b9a',
	},
	'organvm-iii-ergon': {
		name: 'III · Ergon',
		fullName: 'ORGAN-III: Ergon — Commerce & Products',
		color: '#1b5e20',
	},
	'organvm-iv-taxis': {
		name: 'IV · Taxis',
		fullName: 'ORGAN-IV: Taxis — Orchestration & Governance',
		color: '#e65100',
	},
	'organvm-v-logos': {
		name: 'V · Logos',
		fullName: 'ORGAN-V: Logos — Public Discourse & Essays',
		color: '#0d47a1',
	},
	'organvm-vi-koinonia': {
		name: 'VI · Koinonia',
		fullName: 'ORGAN-VI: Koinonia — Community & Learning',
		color: '#4a148c',
	},
	'organvm-vii-kerygma': {
		name: 'VII · Kerygma',
		fullName: 'ORGAN-VII: Kerygma — Distribution & Outreach',
		color: '#b71c1c',
	},
	'meta-organvm': {
		name: 'Meta',
		fullName: 'Meta-ORGANVM — System Governance & Registry',
		color: '#37474f',
	},
};

const HUB_LINKS = [
	{
		label: 'Portfolio',
		url: 'https://4444j99.dev/',
		desc: 'Main portfolio hub',
	},
	{
		label: 'System Directory',
		url: 'https://4444j99.dev/directory/',
		desc: 'All 92 sites indexed',
	},
	{
		label: 'Knowledge Base',
		url: 'https://organvm-i-theoria.github.io/my-knowledge-base/',
		desc: 'Research library',
	},
	{
		label: 'Essays',
		url: 'https://organvm-v-logos.github.io/public-process/',
		desc: '49 published essays',
	},
];

function escapeHtml(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function generatePage(owner, repos) {
	const organ = ORGANS[owner];
	if (!organ) return null;

	const sidebarLinks = Object.entries(ORGANS)
		.map(([key, val]) => {
			const active = key === owner ? ' class="active"' : '';
			return `            <li><a href="https://${key}.github.io/"${active}>${val.name}</a></li>`;
		})
		.join('\n');

	const hubLinks = HUB_LINKS.map(
		(h) =>
			`            <li><a href="${h.url}" class="hub-link">${h.label} <span class="hub-arrow">↗</span></a></li>`,
	).join('\n');

	const repoCards = repos
		.filter((r) => !r.repo.endsWith('.github.io') && r.repo !== '.github')
		.map((r) => {
			const pageUrl = r.pageUrl || `https://${owner}.github.io/${r.repo}/`;
			const desc = escapeHtml(r.description || 'No description');
			const name = escapeHtml(r.repo);
			const featured = r.featured ? '<span class="tag featured">Featured</span>' : '';
			return `        <a href="${pageUrl}" class="repo-card" target="_blank" rel="noopener">
            <div class="repo-name">${name}</div>
            <div class="repo-desc">${desc}</div>
            <div class="repo-footer">
                <span class="tag">GitHub Pages</span>
                ${featured}
            </div>
        </a>`;
		})
		.join('\n');

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(organ.fullName)}</title>
    <meta name="description" content="${escapeHtml(organ.fullName)} — part of the ORGANVM eight-organ system">
    <style>
        :root { --primary: ${organ.color}; --bg: #f6f8fa; --text: #24292e; --border: #e1e4e8; --sidebar-bg: #ffffff; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: var(--text); margin: 0; display: flex; min-height: 100vh; background: var(--bg); }
        nav { width: 280px; background: var(--sidebar-bg); border-right: 1px solid var(--border); padding: 2rem 1.5rem; flex-shrink: 0; position: sticky; top: 0; height: 100vh; box-sizing: border-box; overflow-y: auto; }
        nav h2 { font-size: 0.7rem; color: #6a737d; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 1rem; }
        nav h3 { font-size: 0.65rem; color: #6a737d; text-transform: uppercase; letter-spacing: 1px; margin: 1.5rem 0 0.75rem; padding-top: 1rem; border-top: 1px solid var(--border); }
        nav ul { list-style: none; padding: 0; margin: 0; }
        nav li { margin-bottom: 0.35rem; }
        nav a { text-decoration: none; color: #586069; font-size: 0.85rem; padding: 0.4rem 0.75rem; border-radius: 6px; display: block; transition: all 0.2s; }
        nav a:hover { background: #f1f8ff; color: var(--primary); }
        nav a.active { background: #f1f8ff; color: var(--primary); font-weight: 600; border-left: 3px solid var(--primary); border-radius: 0 6px 6px 0; }
        nav a.hub-link { color: var(--primary); font-weight: 500; }
        .hub-arrow { font-size: 0.75em; opacity: 0.5; }
        main { flex-grow: 1; padding: 3rem 4rem; max-width: 1200px; }
        header { margin-bottom: 3rem; }
        header h1 { font-size: 2rem; font-weight: 800; margin: 0; color: #000; }
        header p { color: #6a737d; font-size: 1.05rem; margin-top: 0.5rem; }
        .hub-banner { background: #f1f8ff; border: 1px solid #c8e1ff; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; font-size: 0.9rem; color: #586069; }
        .hub-banner a { color: var(--primary); font-weight: 600; text-decoration: none; }
        .hub-banner a:hover { text-decoration: underline; }
        .repo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
        .repo-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1); display: flex; flex-direction: column; text-decoration: none; color: inherit; }
        .repo-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
        .repo-name { color: var(--primary); font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; word-break: break-word; }
        .repo-desc { font-size: 0.9rem; color: #586069; line-height: 1.5; margin-bottom: 1rem; flex-grow: 1; }
        .repo-footer { display: flex; align-items: center; gap: 0.5rem; }
        .tag { font-size: 0.65rem; background: #eff7ff; color: var(--primary); padding: 3px 8px; border-radius: 20px; font-weight: 600; text-transform: uppercase; border: 1px solid #c8e1ff; }
        .tag.featured { background: #fff8e1; color: #f57f17; border-color: #ffe082; }
        .count { font-size: 0.85rem; color: #6a737d; margin-bottom: 2rem; }
        @media (max-width: 900px) { body { flex-direction: column; } nav { width: 100%; height: auto; position: relative; border-right: none; border-bottom: 1px solid var(--border); } main { padding: 2rem 1.5rem; } }
    </style>
</head>
<body>
    <nav>
        <h2>ORGANVM Ecosystem</h2>
        <ul>
${sidebarLinks}
        </ul>
        <h3>Hub</h3>
        <ul>
${hubLinks}
        </ul>
    </nav>
    <main>
        <header>
            <h1>${escapeHtml(organ.fullName)}</h1>
            <p>Part of the <a href="https://4444j99.dev/directory/" style="color:var(--primary);text-decoration:none;font-weight:600">ORGANVM eight-organ system</a></p>
        </header>
        <div class="hub-banner">
            Explore the full system: <a href="https://4444j99.dev/">Portfolio</a> · <a href="https://4444j99.dev/directory/">Directory</a> · <a href="https://organvm-v-logos.github.io/public-process/">49 Essays</a>
        </div>
        <p class="count">${repos.length} repositories with GitHub Pages</p>
        <div class="repo-grid">
${repoCards}
        </div>
    </main>
</body>
</html>`;
}

// Main
const pagesData = JSON.parse(readFileSync(PAGES_JSON, 'utf-8'));
const repos = pagesData.repos.filter((r) => r.status === 'built');

const grouped = new Map();
for (const repo of repos) {
	if (!grouped.has(repo.owner)) grouped.set(repo.owner, []);
	grouped.get(repo.owner).push(repo);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
let generated = 0;

for (const [owner, ownerRepos] of grouped) {
	if (!ORGANS[owner]) continue;
	const html = generatePage(owner, ownerRepos);
	if (!html) continue;

	const dir = resolve(OUTPUT_DIR, owner);
	mkdirSync(dir, { recursive: true });
	writeFileSync(resolve(dir, 'index.html'), html);
	generated++;
	console.log(`  ✓ ${owner} (${ownerRepos.length} repos)`);
}

console.log(`\nGenerated ${generated} landing pages in ${OUTPUT_DIR}/`);
