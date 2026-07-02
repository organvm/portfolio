import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import essaysData from '../data/essays.json';
import { projectCatalog } from '../data/project-catalog';
import { projectIndex } from '../data/project-index';

interface EssayItem {
	title: string;
	date: string;
	url: string;
}

export function GET(context: APIContext) {
	const siteBase = context.site ? context.site.toString().replace(/\/$/, '') + '/' : 'https://4444j99.dev/';
	const fallbackProjectDate = new Date('2026-02-10T00:00:00.000Z');
	const indexSlugs = new Set(projectIndex.map((p) => p.slug));

	const projectItems = projectCatalog
		.filter((p) => indexSlugs.has(p.slug))
		.map((project) => {
			const pubDate = project.publishedAt ? new Date(project.publishedAt) : fallbackProjectDate;
			return {
				title: project.title,
				description: project.summary,
				link: `${siteBase}projects/${project.slug}/`,
				pubDate,
				categories: [project.organ, ...project.tags],
			};
		});

	const essayItems = (essaysData.essays as EssayItem[]).map((e) => ({
		title: e.title,
		description: `Essay: ${e.title}`,
		link: e.url,
		pubDate: new Date(e.date),
		categories: ['Essay'],
	}));

	return rss({
		title: 'Anthony James Padavano — Portfolio',
		description:
			'Creative technologist building autonomous creative systems and treating governance as artistic medium.',
		site: context.site?.toString() || siteBase,
		items: [...projectItems, ...essayItems].sort(
			(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
		),
		customData: '<language>en-us</language>',
	});
}
