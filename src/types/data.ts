/** Typed interfaces for the JSON data files in src/data/ */

export interface Organ {
	name: string;
	status: string;
	total_repos: number;
	implementation_status: Record<string, number>;
	tier_distribution: Record<string, number>;
	ci_coverage: number;
}

export interface FlagshipRepo {
	org: string;
	repo: string;
	classification: string;
	code_files: number;
	test_files: number;
}

export interface Sprint {
	name: string;
	date: string;
	focus: string;
	deliverables: string;
}

export interface PraxisTarget {
	current: string | number;
	target: string | number;
	met?: boolean;
}

export interface SystemMetrics {
	generated: string;
	// Newer generate-data schema (schema_version >= current) splits values into
	// computed/manual blocks. Older flat fields below are optional because the
	// current generator no longer emits them; dashboard consumers guard for absence.
	schema_version?: number;
	computed?: Record<string, unknown>;
	manual?: Record<string, unknown>;
	sprint?: string;
	system?: { name: string; launch_date: string; project_status: string };
	registry: {
		total_repos: number;
		total_organs: number;
		operational_organs: number;
		implementation_status: Record<string, number>;
		tier_distribution?: Record<string, number>;
		promotion_status?: Record<string, number>;
		ci_coverage: number;
		dependency_edges: number;
		organs: Record<string, Organ>;
	};
	code_substance?: {
		total_code_files: number;
		total_test_files: number;
		ci_passing: number;
	};
	flagship_vivification?: {
		total_audited: number;
		classifications: Record<string, number>;
		repos: FlagshipRepo[];
	};
	sprint_history?: Sprint[];
	praxis_targets?: Record<string, PraxisTarget>;
	essays: { total: number };
}

export interface Testimonial {
	name: string;
	role?: string;
	quote: string;
	date?: string;
	source?: string;
	sourceUrl?: string;
}

export interface Essay {
	path: string;
	filename: string;
	date: string;
	slug: string;
	title: string;
	subtitle?: string;
	summary?: string;
	category?: string;
	url: string;
}

export interface EssayData {
	total: number;
	essays: Essay[];
	feed_url: string;
	site_url: string;
}

export interface GraphNode {
	id: string;
	organ: string;
	[key: string]: unknown;
}

export interface GraphEdge {
	source: string;
	target: string;
	[key: string]: unknown;
}

export interface GraphData {
	total_nodes: number;
	total_edges: number;
	nodes: GraphNode[];
	edges: GraphEdge[];
}

export interface QualityMetrics {
	generated: string;
	tests: { total: number | null; passed: number | null; files: number };
	security: {
		critical: number | null;
		high: number | null;
		moderate: number | null;
		low: number | null;
		total: number | null;
		githubOpenAlerts: number | null;
		githubAdvisoryStatus: string;
		prodCounts: {
			critical: number | null;
			high: number | null;
			moderate: number | null;
			low: number | null;
			total: number | null;
		};
		devCounts: {
			critical: number | null;
			high: number | null;
			moderate: number | null;
			low: number | null;
			total: number | null;
		};
		allowlistActive: number;
		policyCheckpoint: { date: string; maxModerate: number; maxLow: number } | null;
		status: string;
		source: string | null;
		githubSource: string | null;
	};
	coverage: {
		statements: number | null;
		branches: number | null;
		functions: number | null;
		lines: number | null;
	};
	lighthouse: {
		performance: number | null;
		accessibility: number | null;
		bestPractices: number | null;
		seo: number | null;
	};
	a11y: {
		status: string;
		static: {
			pagesAudited: number | null;
			critical: number | null;
			serious: number | null;
			status: string;
		};
		runtime: {
			pagesAudited: number | null;
			critical: number | null;
			serious: number | null;
			focusChecks: number | null;
			focusFailures: number | null;
			routesCovered: number | null;
			totalRoutes: number | null;
			coveragePct: number | null;
			status: string;
		};
	};
	performance: {
		routeBudgetsStatus: string;
		chunkBudgetsStatus: string;
		interactionBudgetsStatus: string;
		routeBudgetCheckpoint: { date: string } | null;
		chunkBudgetCheckpoint: { date: string } | null;
		interactionBudgetCheckpoint: { date: string } | null;
		largestChunks: Array<{ chunk: string; gzipBytes: number }>;
		interactiveRouteJsTotals: Record<
			string,
			{
				scenario: string;
				rawBytes: number;
				gzipBytes: number;
				assetCount: number;
				assets: string[];
			}
		>;
		routeJsTotals: Record<
			string,
			{ rawBytes: number; gzipBytes: number; assetCount: number; assets: string[] }
		>;
		source: string | null;
	};
	runtimeErrors: {
		status: string;
		total: number | null;
		uncategorized: number | null;
		allowlisted: number | null;
		source: string | null;
	};
	stability: {
		status: string;
		consecutiveSuccess: number | null;
		requiredConsecutive: number | null;
		source: string | null;
		history?: GreenRun[];
	};
	build: { pages: number; bundleFiles: number };
	sources: {
		tests: string;
		security: string;
		securityProd: string;
		securityGithub: string;
		securityDrift: string;
		coverage: string;
		lighthouse: string;
		a11yStatic: string;
		a11yRuntime: string;
		runtimeCoverage: string;
		e2eSmoke: string;
		runtimeErrors: string;
		greenRuns: string;
		ledger: string;
		policyGovernance: string;
		performance: string;
		build: string;
	};
	ledger?: QualityLedger;
}

export interface QualityLedgerEntry {
	generated: string;
	tests: { total: number; passed: number };
	coverage: {
		statements: number;
		branches: number;
		functions: number;
		lines: number;
	};
	security: {
		status: string;
		critical: number;
		high: number;
		moderate: number;
		low: number;
		allowlistActive: number;
	};
	a11y: {
		status: string;
		runtimeCoveragePct: number;
	};
	performance: {
		routeBudgetsStatus: string;
		chunkBudgetsStatus: string;
		interactionBudgetsStatus: string;
	};
	lighthouse: {
		performance: number;
		accessibility: number;
		bestPractices: number;
		seo: number;
	};
	stability: {
		consecutiveSuccess: number | null;
		requiredConsecutive: number;
		greenStatus: string;
	};
	drift: {
		securityDriftStatus: string;
		securityDriftFailures: number;
		coverageStatementsDelta: number;
		coverageBranchesDelta: number;
		coverageFunctionsDelta: number;
		coverageLinesDelta: number;
		lhPerformanceDelta: number;
		runtimeCoverageDelta: number | null;
	};
}

export interface QualityLedger {
	generated: string | null;
	snapshots: QualityLedgerEntry[];
}

export interface GreenRun {
	id: number;
	runNumber: number;
	event: string;
	status: string;
	conclusion: string;
	htmlUrl: string;
	createdAt: string;
	updatedAt: string;
}

export interface GreenRunHistory {
	generated: string;
	consecutiveSuccess: number | null;
	requiredConsecutive: number;
	status: string;
	runs: GreenRun[];
}

export interface GitHubPagesRepo {
	owner: string;
	repo: string;
	fullName: string;
	repoUrl: string;
	pageUrl: string;
	status: string | null;
	buildType: string | null;
	cname: string | null;
	sourceBranch: string | null;
	sourcePath: string | null;
	updatedAt: string | null;
	featured: boolean;
	priority: number;
	hidden: boolean;
	label: string | null;
	httpStatus: number | null;
	reachable: boolean;
	redirectTarget: string | null;
	lastCheckedAt: string;
	probeMethod?: string | null;
	probeLatencyMs?: number | null;
	lastError?: string | null;
}

export interface GitHubPagesDirectory {
	schemaVersion: string;
	syncCoreVersion: string;
	generatedAt: string;
	owners: string[];
	totalRepos: number;
	syncStatus?: string;
	syncWarnings?: string[];
	stats?: Record<string, unknown>;
	repos: GitHubPagesRepo[];
}
