// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import astroShibuiLens from './plugins/astro-shibui-lens.mjs';
import rehypeShibuiLens from './plugins/rehype-shibui-lens.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://4444j99.dev',
	base: '/',
	// Keep navigation transitions but avoid eager cross-route prefetch bursts on heavy pages.
	prefetch: false,
	markdown: {
		rehypePlugins: [rehypeShibuiLens],
	},
	integrations: [
		sitemap({
			filter: (page) => !page.includes('/404') && !page.includes('/og/'),
		}),
		mdx(),
		astroShibuiLens(),
	],
	vite: {
		build: {
			// Runtime policy is enforced by gzip budget gates in scripts/check-bundle-budgets.mjs.
			// Keep this warning threshold high enough to avoid contradictory CI noise.
			chunkSizeWarningLimit: 1800,
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (id.includes('node_modules/p5')) return 'vendor-p5';
						if (id.includes('node_modules/mermaid')) return 'vendor-mermaid';
						if (id.includes('node_modules/cytoscape')) return 'vendor-cytoscape';
						if (id.includes('node_modules/katex')) return 'vendor-katex';
					},
				},
			},
		},
	},
});
