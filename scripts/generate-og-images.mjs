#!/usr/bin/env node

/**
 * Bespoke Social Card Factory
 * Generates high-signal OG images (1200x630) using satori and resvg.
 *
 * Propulsion: Bespoke images for targeted strikes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const fontPath = join(publicDir, 'fonts', 'syne-latin.ttf'); // Assuming we might have it or fetch it

let fontDataCache = null;

async function getFontData() {
	if (fontDataCache) return fontDataCache;

	// If local TTF exists, use it, otherwise fetch
	if (existsSync(fontPath)) {
		fontDataCache = readFileSync(fontPath);
	} else {
		console.log('🌐 Fetching Syne font for OG generation...');
		const res = await fetch(
			'https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_3fvj6k.ttf',
		);
		if (!res.ok) {
			throw new Error(`Failed to fetch Syne font: ${res.status} ${res.statusText}`);
		}
		fontDataCache = await res.arrayBuffer();
	}
	return fontDataCache;
}

/**
 * Generate a bespoke OG image.
 * @param {string} destPath - Full path to save the image
 * @param {string} title - Main title (e.g. "For Anthropic")
 * @param {string} subtitle - Subtitle (e.g. "AI Orchestration Architect")
 * @param {string} accentColor - Hex color for accents
 */
export async function generateOGImage(destPath, title, subtitle, accentColor = '#00BCD4') {
	mkdirSync(dirname(destPath), { recursive: true });
	const fontData = await getFontData();

	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					padding: '80px',
					background: '#0a0a0b',
					fontFamily: 'Syne',
					border: `1px solid ${accentColor}33`,
				},
				children: [
					// Top section: Branding
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							},
							children: [
								{
									type: 'div',
									props: {
										style: {
											fontSize: '24px',
											fontWeight: 700,
											color: accentColor,
											letterSpacing: '0.1em',
											textTransform: 'uppercase',
										},
										children: 'Anthony James Padavano',
									},
								},
								{
									type: 'div',
									props: {
										style: {
											width: '12px',
											height: '12px',
											borderRadius: '50%',
											background: '#E91E63',
										},
									},
								},
							],
						},
					},
					// Middle section: The Core Message
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								flexDirection: 'column',
							},
							children: [
								{
									type: 'div',
									props: {
										style: {
											width: '60px',
											height: '4px',
											background: accentColor,
											marginBottom: '32px',
										},
									},
								},
								{
									type: 'div',
									props: {
										style: {
											fontSize: '72px',
											fontWeight: 700,
											color: '#ffffff',
											lineHeight: 1.1,
											marginBottom: '16px',
											letterSpacing: '-0.03em',
										},
										children: title,
									},
								},
								{
									type: 'div',
									props: {
										style: {
											fontSize: '32px',
											color: '#888888',
											letterSpacing: '0.02em',
										},
										children: subtitle,
									},
								},
							],
						},
					},
					// Bottom section: Metadata
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'flex-end',
								fontSize: '18px',
								color: '#444444',
								fontFamily: 'monospace',
							},
							children: [
								{
									type: 'div',
									props: {
										children: '4444j99.github.io/portfolio',
									},
								},
								{
									type: 'div',
									props: {
										children: 'Phase W10 · Operative Intel',
									},
								},
							],
						},
					},
				],
			},
		},
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: 'Syne',
					data: fontData,
					weight: 400,
					style: 'normal',
				},
				{
					name: 'Syne',
					data: fontData,
					weight: 700,
					style: 'normal',
				},
			],
		},
	);

	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: 1200 },
	});
	const pngData = resvg.render().asPng();
	writeFileSync(destPath, pngData);
}

// Bulk generation if run as script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	(async () => {
		const pages = [
			{ file: 'og-image.png', title: '4444j', subtitle: 'Creative Technologist' },
			{ file: 'about.png', title: 'About Anthony', subtitle: 'Systems Architect' },
			{
				file: 'resume.png',
				title: 'Intelligence Ledger',
				subtitle: 'Professional History & Vitals',
			},
			{
				file: 'dashboard.png',
				title: 'System Metrics',
				subtitle: '91 Repositories — Live Analysis',
			},
			{ file: 'gallery.png', title: 'The Gallery', subtitle: '29 Generative p5.js Sketches' },
			{
				file: 'essays.png',
				title: 'Public Process',
				subtitle: '28 Philosophical & Technical Essays',
			},
		];

		for (const page of pages) {
			const dest =
				page.file === 'og-image.png'
					? join(publicDir, page.file)
					: join(publicDir, 'og', page.file);
			await generateOGImage(dest, page.title, page.subtitle);
			console.log(`✅ Created ${page.file}`);
		}

		// Generate for all targets
		const targetsPath = join(__dirname, '../src/data/targets.json');
		if (existsSync(targetsPath)) {
			const { targets } = JSON.parse(readFileSync(targetsPath, 'utf8'));
			for (const target of targets) {
				const dest = join(publicDir, 'og', 'strikes', `${target.slug}.png`);
				const personaTitle = target.persona_id
					.split('-')
					.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
					.join(' ');
				await generateOGImage(dest, `For ${target.company}`, personaTitle);
				console.log(`✅ Created strike card: ${target.slug}.png`);
			}
		}

		console.log('Done — Bespoke social cards generated.');
	})();
}
