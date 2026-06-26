import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import pagesDirectory from '../data/github-pages.json';

interface PagesRepo {
	owner: string;
	repo: string;
	fullName: string;
	pageUrl: string;
	status: string | null;
	buildType: string | null;
	updatedAt: string | null;
	featured: boolean;
	priority: number;
	label: string | null;
}

const directory = pagesDirectory as {
	generatedAt: string;
	repos: PagesRepo[];
};

export function GET(context: APIContext) {
	const siteBase = 'https://organvm.github.io/portfolio/';
	const fallbackDate = Number.isFinite(Date.parse(directory.generatedAt))
		? new Date(directory.generatedAt)
		: new Date();

	const items = directory.repos.map((repo) => ({
		title: repo.label ?? repo.fullName,
		description: `GitHub Pages site (${repo.status ?? 'unknown'}) · build ${repo.buildType ?? 'unknown'} · priority ${repo.priority}`,
		link: repo.pageUrl,
		pubDate:
			repo.updatedAt && Number.isFinite(Date.parse(repo.updatedAt))
				? new Date(repo.updatedAt)
				: fallbackDate,
		categories: [
			'GitHub Pages',
			repo.owner,
			repo.status ?? 'unknown',
			repo.featured ? 'featured' : 'standard',
		],
	}));

	return rss({
		title: 'GitHub Pages Directory — 4444j',
		description: 'Machine-readable feed of Pages-enabled repositories and live site URLs.',
		site: context.site?.toString() || siteBase,
		items: items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()),
		customData: '<language>en-us</language>',
	});
}
