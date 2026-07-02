import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { personas } from '../../data/personas.json';
import { projectIndex } from '../../data/project-index';
import { targets } from '../../data/targets.json';
import { generateOGImage } from '../../utils/og-image';

interface OGPage extends Record<string, unknown> {
	slug: string;
	title: string;
	subtitle: string;
	accent?: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
	const pages: OGPage[] = [
		// Top-level pages
		{
			slug: 'index',
			title: 'Anthony James Padavano',
			subtitle: 'Creative technologist building autonomous creative systems',
		},
		{
			slug: 'about',
			title: 'About',
			subtitle: 'Artist-engineer treating governance as artistic medium',
		},
		{
			slug: 'resume',
			title: 'Resume',
			subtitle: 'Creative Technologist — Systems, AI, Generative Art',
		},
		{
			slug: 'dashboard',
			title: 'Dashboard',
			subtitle: 'System metrics across 149 repositories and 8 organs',
		},
		{
			slug: 'essays',
			title: 'Essays',
			subtitle: 'Public process essays on creative infrastructure',
		},
		{
			slug: 'architecture',
			title: 'System Architecture',
			subtitle: 'Dependency graph of the eight-organ system',
		},
		{
			slug: 'community',
			title: 'Community',
			subtitle: 'Collaborative infrastructure and open contribution',
		},
		{
			slug: 'consult',
			title: 'Consult',
			subtitle: 'Working together on creative technology projects',
		},
		{
			slug: 'products',
			title: 'Products',
			subtitle: 'Commerce applications and consumer experiences',
		},
		{ slug: 'gallery', title: 'Gallery', subtitle: '29 generative art sketches built with p5.js' },
		{
			slug: 'philosophy',
			title: 'Logocentric Architecture',
			subtitle: 'Why I treat Governance as Art — The Core Thesis',
		},
		{ slug: 'omega', title: 'Project Omega', subtitle: 'Final Synthesis' },
		{
			slug: 'resume/polymath',
			title: 'Visionary Polymath',
			subtitle: 'The complete eight-organ creative-institutional system',
		},
		{ slug: 'github-pages', title: 'GitHub Pages', subtitle: 'Directory of deployed static sites' },
	];

	// Dynamic Project pages
	projectIndex.forEach((project) => {
		pages.push({
			slug: `projects/${project.slug}`,
			title: project.title,
			subtitle: project.tags.join(' · '),
			accent: '#c9a84c', // Use default accent or derive from organ
		});
	});

	// Dynamic Persona Resume pages
	personas.forEach((persona) => {
		pages.push({
			slug: `resume/${persona.id}`,
			title: persona.title,
			subtitle: persona.subtitle,
		});
	});

	// Dynamic Targeted Application pages
	targets.forEach((target) => {
		const persona = personas.find((p) => p.id === target.persona_id);
		pages.push({
			slug: `for/${target.slug}`,
			title: `For ${target.company}`,
			subtitle: persona?.title || target.role,
		});
	});

	// Dynamic Pathos dialogue pages (read directly — getCollection unavailable in .ts endpoints)
	const pathosDir = resolve(process.cwd(), 'src/content/pathos');
	try {
		const pathosFiles = readdirSync(pathosDir).filter((f) => f.endsWith('.md'));
		for (const file of pathosFiles) {
			const content = readFileSync(resolve(pathosDir, file), 'utf-8');
			const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
			const title = frontmatter.match(/^title:\s*"(.+)"/m)?.[1] ?? file.replace('.md', '');
			const hookLine = frontmatter.match(/^hookLine:\s*"(.+)"/m)?.[1] ?? '';
			pages.push({
				slug: `pathos/${file.replace('.md', '')}`,
				title,
				subtitle: hookLine,
			});
		}
	} catch {
		// pathos directory may not exist yet
	}

	return pages.map((page) => ({
		params: { slug: page.slug },
		props: page,
	}));
};

export const GET: APIRoute = async ({ props }) => {
	const { title, subtitle, accent } = props as OGPage;
	const png = await generateOGImage(title, subtitle, accent);

	return new Response(new Uint8Array(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
