#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from './lib/atomic-write.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const PAGES_DIR = path.join(__dirname, '../src/pages');
const TARGETS_PATH = path.join(__dirname, '../src/data/targets.json');
const PERSONAS_PATH = path.join(__dirname, '../src/data/personas.json');
const OUTPUT_PATH = path.join(__dirname, 'runtime-a11y-routes.json');

const DEFAULT_CHECKS = ['nav-menu', 'dropdown-menu', 'search-dialog', 'theme-toggle'];

// Per-route overrides for routes that need extra checks beyond DEFAULT_CHECKS
const ROUTE_OVERRIDES = {
	'/gallery': {
		checks: [...DEFAULT_CHECKS, 'gallery-filter', 'fullscreen'],
		requiredFocusSelectors: ['.sketch-ctrl--pause', '.sketch-ctrl--fullscreen'],
	},
};

/**
 * Walk src/pages/ and derive static routes from .astro files.
 * Skips dynamic routes ([slug], [target], [...rest]) — those are injected from data sources.
 * Skips non-HTML endpoints (.ts files for feed.xml, og/*.png, github-pages.json, etc.).
 * Skips __tests__ directories.
 */
function discoverStaticRoutes(dir, baseDir = dir) {
	const routes = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === '__tests__') continue;

		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			routes.push(...discoverStaticRoutes(fullPath, baseDir));
			continue;
		}

		// Only .astro files produce HTML pages
		if (!entry.name.endsWith('.astro')) continue;

		// Skip dynamic routes — they're handled by data source injection below
		if (entry.name.includes('[')) continue;

		const rel = path.relative(baseDir, fullPath);
		let route;

		if (rel === 'index.astro') {
			route = '/';
		} else if (rel === '404.astro') {
			route = '/404.html';
		} else if (entry.name === 'index.astro') {
			// e.g. logos/index.astro → /logos
			route = '/' + path.dirname(rel);
		} else {
			// e.g. about.astro → /about, projects/foo.astro → /projects/foo
			route = '/' + rel.replace(/\.astro$/, '');
		}

		routes.push(route);
	}
	return routes;
}

async function generateA11yRoutes() {
	console.log('🔄 Synchronizing Runtime A11y Routes...');

	const targets = JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8')).targets;
	const personas = JSON.parse(fs.readFileSync(PERSONAS_PATH, 'utf8')).personas;

	// Discover all static routes from filesystem — includes top-level pages AND
	// individual project pages (src/pages/projects/*.astro). No regex extraction
	// from project-index.ts needed; the .astro files ARE the source of truth.
	const staticRoutePaths = discoverStaticRoutes(PAGES_DIR);

	const routes = staticRoutePaths.map((routePath) => {
		const override = ROUTE_OVERRIDES[routePath];
		if (override) {
			return { path: routePath, ...override };
		}
		return { path: routePath, checks: DEFAULT_CHECKS };
	});

	// Inject Persona Routes
	for (const persona of personas) {
		routes.push({ path: `/resume/${persona.id}`, checks: DEFAULT_CHECKS });
	}

	// Inject Logos Routes (slugs derived from filenames — must match Astro content collection defaults;
	// will break if a logos entry adds a frontmatter `slug` override)
	const logosContentDir = path.join(__dirname, '../src/content/logos');
	if (fs.existsSync(logosContentDir)) {
		for (const entry of fs.readdirSync(logosContentDir)) {
			if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
				const slug = entry.replace(/\.(md|mdx)$/, '');
				routes.push({ path: `/logos/${slug}`, checks: DEFAULT_CHECKS });
			}
		}
	}

	// Inject Pathos Routes
	const pathosContentDir = path.join(__dirname, '../src/content/pathos');
	if (fs.existsSync(pathosContentDir)) {
		for (const entry of fs.readdirSync(pathosContentDir)) {
			if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
				const slug = entry.replace(/\.(md|mdx)$/, '');
				routes.push({ path: `/pathos/${slug}`, checks: DEFAULT_CHECKS });
			}
		}
	}

	// Inject Dynamic Target Routes
	for (const target of targets) {
		routes.push({ path: `/for/${target.slug}`, checks: DEFAULT_CHECKS });
	}

	const manifest = {
		basePath: '/portfolio',
		routes,
	};

	writeJsonAtomic(OUTPUT_PATH, manifest);
	console.log(`✅ Successfully generated ${routes.length} routes for A11y runtime audit.`);
}

generateA11yRoutes().catch(console.error);
