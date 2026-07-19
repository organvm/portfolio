export type ProductType = 'SaaS' | 'B2B' | 'B2C' | 'B2B2C';

export type ProductStatus = 'Production-Ready' | 'In Development' | 'Prototype';

export type ProductAudience = 'clients' | 'collaborators' | 'investors';

export interface ProductOffer {
	type: ProductType;
	name: string;
	slug: string;
	repo: string;
	status: ProductStatus;
	description: string;
	stack: string[];
	demo?: string;
	caseStudyUrl?: string;
	proofUrl?: string;
	featured?: boolean;
	audience: ProductAudience[];
}

export const productOffers: ProductOffer[] = [
	{
		name: 'Gamified Coach Interface',
		slug: 'gamified-coach-interface',
		repo: 'https://github.com/organvm-iii-ergon/gamified-coach-interface',
		type: 'SaaS',
		status: 'Production-Ready',
		description:
			'Holographic 3D fitness coaching visualization built with Three.js and Vite. Interactive orbital node system for strategy mapping and progress tracking.',
		stack: ['Three.js', 'Vite', 'TypeScript'],
		demo: 'https://a-organvm.github.io/gamified-coach-interface/',
		audience: ['clients', 'investors'],
		featured: true,
	},
	{
		name: 'Public Record Data Scrapper',
		slug: 'public-record-data-scrapper',
		repo: 'https://github.com/organvm-iii-ergon/public-record-data-scrapper',
		type: 'B2B',
		status: 'Production-Ready',
		description:
			'Automated public records aggregation and analysis platform. React 19 frontend, Express API, PostgreSQL, Tauri desktop app (Rust), Terraform AWS infrastructure. 2,055 tests.',
		stack: ['React', 'Express', 'PostgreSQL', 'Rust/Tauri', 'Terraform', 'Docker'],
		demo: 'https://a-organvm.github.io/public-record-data-scrapper/',
		caseStudyUrl: '/projects/public-record-data-scrapper/',
		audience: ['clients', 'collaborators', 'investors'],
	},
	{
		name: 'Trade Perpetual Future',
		slug: 'trade-perpetual-future',
		repo: 'https://github.com/organvm-iii-ergon/trade-perpetual-future',
		type: 'B2B',
		status: 'In Development',
		description:
			'Perpetual futures trading interface with React 19, Solana/Drift Protocol integration, and real-time analytics. 53 Vitest tests, Cloudflare Pages deployment.',
		stack: ['Python', 'React', 'Solana', 'Vitest', 'Cloudflare'],
		demo: 'https://trade-perpetual-future.netlify.app',
		audience: ['clients', 'investors'],
	},
	{
		name: 'Sovereign Ecosystem — Real Estate Luxury',
		slug: 'sovereign-ecosystem-real-estate-luxury',
		repo: 'https://github.com/organvm-iii-ergon/sovereign-ecosystem--real-estate-luxury',
		type: 'B2B2C',
		status: 'Prototype',
		description:
			'Luxury real estate marketplace with React frontend, Tailwind CSS, and multi-party transaction orchestration.',
		stack: ['TypeScript', 'React', 'Tailwind'],
		demo: 'https://sovereign-ecosystem.netlify.app',
		audience: ['clients', 'investors'],
	},
	{
		name: 'Universal Mail Automation',
		slug: 'universal-mail-automation',
		repo: 'https://github.com/organvm-iii-ergon/universal-mail--automation',
		type: 'B2B',
		status: 'Prototype',
		description:
			'Cross-platform mail automation engine with Python backend, AppleScript macOS integration, and scheduling.',
		stack: ['Python', 'AppleScript', 'Shell'],
		demo: 'https://uma.4444j99.dev',
		audience: ['clients', 'collaborators'],
	},
	{
		name: 'Search Local — Happy Hour',
		slug: 'search-local-happy-hour',
		repo: 'https://github.com/organvm-iii-ergon/search-local--happy-hour',
		type: 'B2C',
		status: 'Prototype',
		description:
			'Location-aware discovery platform for local dining and nightlife. React frontend with Tailwind CSS.',
		stack: ['TypeScript', 'React', 'Tailwind'],
		demo: 'https://search-local-happy-hour.netlify.app',
		audience: ['clients', 'collaborators'],
	},
	{
		name: 'Fetch Familiar Friends',
		slug: 'fetch-familiar-friends',
		repo: 'https://github.com/organvm-iii-ergon/fetch-familiar-friends',
		type: 'B2C',
		status: 'In Development',
		description:
			'Social pet adoption and community platform. JavaScript frontend, PostgreSQL database with PLpgSQL schemas.',
		stack: ['JavaScript', 'PostgreSQL', 'React'],
		demo: 'https://fetch-familiar-friends.netlify.app',
		audience: ['clients', 'collaborators'],
	},
	{
		name: 'Multi-Camera Livestream Framework',
		slug: 'multi-camera-livestream-framework',
		repo: 'https://github.com/organvm-iii-ergon/multi-camera--livestream--framework',
		type: 'B2B2C',
		status: 'Production-Ready',
		description:
			'Multi-source 4K livestream orchestration with Dante audio networking, scene switching, and audience interaction.',
		stack: ['Shell', 'FFmpeg', 'Dante'],
		demo: 'https://a-organvm.github.io/multi-camera--livestream--framework/',
		audience: ['clients', 'collaborators', 'investors'],
	},
	{
		name: 'Tab Bookmark Manager',
		slug: 'tab-bookmark-manager',
		repo: 'https://github.com/organvm-iii-ergon/tab-bookmark-manager',
		type: 'SaaS',
		status: 'In Development',
		description:
			'Browser extension with Python ML backend, PostgreSQL, Redis, Puppeteer scraping, and Docker deployment.',
		stack: ['JavaScript', 'Python', 'PostgreSQL', 'Redis', 'Docker'],
		demo: 'https://a-organvm.github.io/tab-bookmark-manager/',
		audience: ['clients', 'collaborators'],
	},
	{
		name: 'The Actual News',
		slug: 'the-actual-news',
		repo: 'https://github.com/organvm-iii-ergon/the-actual-news',
		type: 'B2C',
		status: 'In Development',
		description:
			'Verifiable news platform with Express microservices architecture (4 services), Docker Compose orchestration, and source transparency scoring.',
		stack: ['Express', 'Docker', 'TypeScript'],
		demo: 'https://the-actual-news-public.ivixivi.workers.dev',
		caseStudyUrl: '/projects/the-actual-news/',
		audience: ['clients', 'investors', 'collaborators'],
	},
	{
		name: 'Your Fit Tailored',
		slug: 'your-fit-tailored',
		repo: 'https://github.com/organvm-iii-ergon/your-fit-tailored',
		type: 'B2C',
		status: 'Prototype',
		description:
			'Circular apparel platform seed with personalized fit algorithms and subscription-based delivery.',
		stack: ['JavaScript'],
		demo: 'https://a-organvm.github.io/your-fit-tailored/',
		caseStudyUrl: '/projects/your-fit-tailored/',
		audience: ['clients', 'investors'],
	},
	{
		name: 'Classroom RPG Aetheria',
		slug: 'classroom-rpg-aetheria',
		repo: 'https://github.com/organvm-iii-ergon/classroom-rpg-aetheria',
		type: 'SaaS',
		status: 'In Development',
		description:
			'Gamified classroom management RPG. Next.js + React frontend, Python backend. 192 code files, 16 test files.',
		stack: ['Next.js', 'React', 'Python', 'Tailwind'],
		caseStudyUrl: '/projects/aetheria-rpg/',
		audience: ['clients', 'investors', 'collaborators'],
	},
];

export const productAudienceLabelMap: Record<ProductAudience, string> = {
	clients: 'Clients',
	collaborators: 'Collaborators',
	investors: 'Investors',
};

export const typeBadgeColors: Record<ProductType, string> = {
	SaaS: '#6366f1',
	B2B: '#0891b2',
	B2C: '#16a34a',
	B2B2C: '#ca8a04',
};

export const statusColors: Record<ProductStatus, string> = {
	'Production-Ready': '#4CAF50',
	'In Development': '#FF9800',
	Prototype: '#9E9E9E',
};
