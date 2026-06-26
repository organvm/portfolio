#!/usr/bin/env node

/**
 * syndicate-essays.mjs
 *
 * Reads the logos content collection and generates Dev.to-compatible
 * markdown exports. Output goes to dist-syndication/devto/.
 *
 * Each file includes:
 * - Title from frontmatter
 * - canonical_url pointing back to the portfolio
 * - Tags from frontmatter (max 4, lowercased, no spaces — Dev.to rules)
 * - Full markdown body
 *
 * Usage:
 *   node scripts/syndicate-essays.mjs
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOGOS_DIR = join(ROOT, 'src', 'content', 'logos');
const OUT_DIR = join(ROOT, 'dist-syndication', 'devto');
const CANONICAL_BASE = 'https://organvm.github.io/portfolio/logos';

/**
 * Parse YAML-ish frontmatter from a markdown file.
 * Returns { data: {}, body: string }.
 */
function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { data: {}, body: content };

	const raw = match[1];
	const body = match[2];
	const data = {};

	for (const line of raw.split('\n')) {
		const kv = line.match(/^(\w+):\s*(.+)$/);
		if (!kv) continue;
		const [, key, value] = kv;
		// Handle arrays like ["tag1", "tag2"]
		if (value.startsWith('[')) {
			try {
				data[key] = JSON.parse(value);
			} catch {
				data[key] = value;
			}
		} else if (value.startsWith('"') && value.endsWith('"')) {
			data[key] = value.slice(1, -1);
		} else if (value === 'true') {
			data[key] = true;
		} else if (value === 'false') {
			data[key] = false;
		} else {
			data[key] = value;
		}
	}

	return { data, body };
}

/**
 * Convert tags to Dev.to format: lowercase, no spaces, max 4 tags.
 */
function formatTags(tags) {
	if (!Array.isArray(tags)) return [];
	return tags.slice(0, 4).map((t) =>
		t
			.toLowerCase()
			.replace(/[\s_]+/g, '')
			.replace(/[^a-z0-9]/g, ''),
	);
}

function main() {
	if (!existsSync(LOGOS_DIR)) {
		console.error(`Content directory not found: ${LOGOS_DIR}`);
		process.exit(1);
	}

	mkdirSync(OUT_DIR, { recursive: true });

	const files = readdirSync(LOGOS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	let exported = 0;

	for (const file of files) {
		const content = readFileSync(join(LOGOS_DIR, file), 'utf-8');
		const { data, body } = parseFrontmatter(content);

		if (!data.title) {
			console.warn(`  - ${file}: no title, skipping`);
			continue;
		}

		const slug = basename(file, '.md').replace(/\.mdx$/, '');
		const canonicalUrl = `${CANONICAL_BASE}/${slug}/`;
		const tags = formatTags(data.tags);

		const devtoFrontmatter = [
			'---',
			`title: "${data.title}"`,
			`published: false`,
			`description: "${data.description || ''}"`,
			tags.length > 0 ? `tags: ${tags.join(', ')}` : null,
			`canonical_url: ${canonicalUrl}`,
			'---',
		]
			.filter(Boolean)
			.join('\n');

		const output = `${devtoFrontmatter}\n\n${body.trim()}\n`;
		const outFile = join(OUT_DIR, `${slug}.md`);
		writeFileSync(outFile, output, 'utf-8');
		console.log(`  + ${slug}.md`);
		exported++;
	}

	console.log(`\nExported ${exported} essays to ${OUT_DIR}`);
}

main();
