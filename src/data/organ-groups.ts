/**
 * Project data organized by organ grouping for the homepage.
 * Slugs are resolved to full URLs at build time via the `base` path.
 */

export interface OrganProject {
	title: string;
	tagline: string;
	description: string;
	slug: string;
	tags: string[];
	skills: string[];
	number: number;
}

export interface OrganGroup {
	organ: string;
	name: string;
	domain: string;
	projects: OrganProject[];
}

export const organGroups: OrganGroup[] = [
	{
		organ: 'ORGAN I',
		name: 'Theoria',
		domain: 'Theory & Epistemology',
		projects: [
			{
				title: 'Narratological Algorithmic Lenses',
				tagline: 'Formalized narrative analysis as executable theory',
				description:
					'A monorepo for computational narrative analysis — Python core, CLI, FastAPI service, and React frontend turning literary frameworks (Propp, Greimas, Genette) into executable algorithms.',
				slug: 'narratological-lenses',
				tags: ['Theory', 'Narrative'],
				skills: ['Python', 'Full-Stack', 'AI/ML'],
				number: 1,
			},
			{
				title: 'My Knowledge Base',
				tagline: 'Turning AI conversations into durable, interconnected knowledge',
				description:
					'Epistemological infrastructure converting AI conversations into searchable, atomized knowledge — 9 source adapters, 3-modal search (FTS + vector + RRF), LLM intelligence extraction. 200+ tests.',
				slug: 'knowledge-base',
				tags: ['Theory', 'Knowledge'],
				skills: ['Python', 'AI/ML', 'Full-Stack'],
				number: 2,
			},
			{
				title: 'Org Architecture & Community Health',
				tagline: 'One repo to govern them all',
				description:
					'Organization-wide .github infrastructure — CI/CD workflows, security scanning, AI agent framework, and community health files inherited by every repo in the org.',
				slug: 'org-architecture',
				tags: ['Systems', 'Community'],
				skills: ['Systems'],
				number: 3,
			},
			{
				title: 'LingFrame — Linguistic Atomization',
				tagline: 'Computational rhetoric across 46 works and 15 languages',
				description:
					'A platform decomposing text into hierarchical atomic units with six analysis modules, spanning 46 canonical works across 12 literary traditions. Python, 142 tests.',
				slug: 'linguistic-atomization',
				tags: ['Theory', 'Language'],
				skills: ['Python'],
				number: 4,
			},
			{
				title: 'Recursive Engine (RE:GE)',
				tagline: 'A symbolic operating system for myth and narrative',
				description:
					'A pure Python engine where myths, identities, rituals, and recursive structures are first-class computational objects. 21 organ handlers, a ritual syntax DSL, and 1,254 tests.',
				slug: 'recursive-engine',
				tags: ['Theory', 'Python'],
				skills: ['Python', 'Systems'],
				number: 5,
			},
		],
	},
	{
		organ: 'ORGAN II',
		name: 'Poiesis',
		domain: 'Generative Art & Performance',
		projects: [
			{
				title: 'Metasystem Master',
				tagline: 'Collective audience input shaping live art in real time',
				description:
					'A real-time audience-participatory performance engine where weighted consensus algorithms transform crowd decisions into artistic direction — while performers retain expressive override authority.',
				slug: 'metasystem-master',
				tags: ['Art', 'Architecture'],
				skills: ['TypeScript', 'Full-Stack', 'Creative'],
				number: 6,
			},
			{
				title: 'AI Council Coliseum',
				tagline: 'Multi-agent deliberation with gamified governance',
				description:
					'A platform where AI agents debate, audiences vote, and achievements track engagement. FastAPI backend + Next.js frontend with agent lifecycle, voting sessions, and user progression.',
				slug: 'ai-council',
				tags: ['Art', 'AI'],
				skills: ['Python', 'TypeScript', 'AI/ML', 'Full-Stack'],
				number: 7,
			},
			{
				title: 'Generative Music System',
				tagline: 'From recursive theory to real-time sound',
				description:
					'Translates recursive narrative principles into live generative music — recursion as counterpoint, identity transformations as harmonic movement. Three-layer architecture from symbolic engine to performance system.',
				slug: 'generative-music',
				tags: ['Art', 'Audio'],
				skills: ['Creative', 'Python'],
				number: 8,
			},
		],
	},
	{
		organ: 'ORGAN III',
		name: 'Ergon',
		domain: 'Commerce & Products',
		projects: [
			{
				title: 'in-midst-my-life',
				tagline: 'The employer becomes the interviewee',
				description:
					'An interactive CV system that inverts the hiring dynamic — employers answer questions, the system assembles a role-curated profile from 16 identity masks. Full-stack SaaS with W3C Verifiable Credentials.',
				slug: 'life-my-midst-in',
				tags: ['Commerce', 'Product'],
				skills: ['TypeScript', 'Full-Stack'],
				number: 9,
			},
			{
				title: 'TurfSynth AR',
				tagline: 'Your neighborhood procedurally generates the game',
				description:
					'A location-based AR game where real-world geography — streets, landmarks, density — procedurally generates the game world around you. TypeScript monorepo with geospatial data processing.',
				slug: 'block-warfare',
				tags: ['Commerce', 'Game'],
				skills: ['TypeScript', 'Full-Stack', 'Creative'],
				number: 10,
			},
			{
				title: 'Your Fit Tailored',
				tagline: 'Circular apparel subscription — zero cognitive load',
				description:
					'A specification-driven seed for a circular apparel platform. Weekly curated boxes, closed-loop logistics, compounding fit confidence. The subscription is the product.',
				slug: 'your-fit-tailored',
				tags: ['Commerce', 'Product'],
				skills: ['Full-Stack'],
				number: 11,
			},
			{
				title: 'The Actual News',
				tagline: 'News as a public service — verifiable by design',
				description:
					'A verifiable news ledger where every story ships with atomic claims, content-addressed evidence graphs, and deterministic publish gates. Five microservices, 10 protocol invariants, 7 conformance tests.',
				slug: 'the-actual-news',
				tags: ['Commerce', 'Media'],
				skills: ['Full-Stack', 'Systems'],
				number: 12,
			},
			{
				title: 'Aetheria Classroom RPG',
				tagline: 'Theory \u2192 Art \u2192 Commerce: an educational RPG',
				description:
					'A gamified classroom platform that traveled the full I\u2192II\u2192III pipeline \u2014 from pedagogical theory to game design to revenue product. Honest post-mortem included.',
				slug: 'aetheria-rpg',
				tags: ['Product', 'Education'],
				skills: ['Full-Stack', 'Creative'],
				number: 13,
			},
			{
				title: 'Public Record Data Scraper',
				tagline: '50-state UCC records aggregation at scale',
				description:
					'Automated public records collection platform scraping UCC filings across all 50 US states. AWS infrastructure with Terraform IaC, Python scraping agents, and structured data pipeline.',
				slug: 'public-record-data-scrapper',
				tags: ['Commerce', 'Python', 'AWS', 'Terraform'],
				skills: ['Python', 'Systems'],
				number: 21,
			},
		],
	},
	{
		organ: 'ORGAN IV',
		name: 'Taxis',
		domain: 'Orchestration & Governance',
		projects: [
			{
				title: 'Agentic Titan',
				tagline: 'Multi-agent orchestration from laptop to production',
				description:
					'A polymorphic, model-agnostic multi-agent framework — 9 topology patterns, 22 agent archetypes, production safety infrastructure. Python 3.11+, 1,312 tests.',
				slug: 'agentic-titan',
				tags: ['Orchestration', 'AI'],
				skills: ['Python', 'AI/ML', 'Systems'],
				number: 14,
			},
			{
				title: 'Orchestration Hub',
				tagline: 'The central nervous system of eight GitHub organizations',
				description:
					'Machine-readable JSON registry serving as single source of truth for 170+ repositories — validation scripts, governance rules, dependency graph enforcement, and promotion state machines.',
				slug: 'orchestration-hub',
				tags: ['Governance', 'Systems'],
				skills: ['Systems'],
				number: 15,
			},
		],
	},
	{
		organ: 'ORGAN V',
		name: 'Logos',
		domain: 'Public Process & Essays',
		projects: [
			{
				title: 'Public Process',
				tagline: '29 essays on building creative infrastructure in public',
				description:
					'~111,000 words of long-form essays documenting architectural decisions, sprint narratives, and methodology \u2014 transparency as design choice, process documentation as portfolio evidence.',
				slug: 'public-process',
				tags: ['Essays', 'Transparency'],
				skills: [],
				number: 16,
			},
			{
				title: 'AI-Conductor Model',
				tagline: 'Human-AI co-creation as artistic practice',
				description:
					'The methodology that produced ~988K words: AI generates volume, human directs and refines. Explicit roles, quality gates, token economics, and honest attribution.',
				slug: 'ai-conductor',
				tags: ['AI', 'Methodology'],
				skills: ['AI/ML'],
				number: 17,
			},
		],
	},
	{
		organ: 'ORGAN VI',
		name: 'Koinonia',
		domain: 'Community & Collaboration',
		projects: [
			{
				title: 'Community Infrastructure',
				tagline: 'Intellectual salons and structured reading groups',
				description:
					'The relational substrate of the eight-organ system \u2014 facilitated salons, reading group curricula, and collaborative sense-making sessions that connect theory to practice.',
				slug: 'community-infrastructure',
				tags: ['Community', 'Education'],
				skills: [],
				number: 18,
			},
		],
	},
	{
		organ: 'ORGAN VII',
		name: 'Kerygma',
		domain: 'Distribution & Amplification',
		projects: [
			{
				title: 'Distribution Strategy',
				tagline: 'POSSE-first content distribution across the system',
				description:
					'Audience segmentation, channel strategy, and systematic content adaptation \u2014 distribution as a first-class architectural concern with its own organ and governance.',
				slug: 'distribution-strategy',
				tags: ['Marketing', 'Distribution'],
				skills: [],
				number: 19,
			},
		],
	},
	{
		organ: 'Meta',
		name: '',
		domain: 'Cross-System Integration',
		projects: [
			{
				title: 'ORGAN Corpus Testamentum',
				tagline: 'Governance as creative infrastructure',
				description:
					'The orchestration system coordinating 170+ repositories across 8 GitHub organizations \u2014 dependency rules, promotion state machines, automated audits, and ~988K words of documentation.',
				slug: 'eight-organ-system',
				tags: ['Systems', 'Governance'],
				skills: ['Systems'],
				number: 20,
			},
		],
	},
];

export const skillFilters = ['Python', 'TypeScript', 'AI/ML', 'Full-Stack', 'Creative', 'Systems'];
export const categoryFilters = [
	'Theory',
	'Art',
	'Commerce',
	'Orchestration',
	'Essays',
	'Community',
	'Systems',
];
export const featuredNumbers = new Set([2, 5, 14, 20]);
