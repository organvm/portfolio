interface Env {
	AI?: Ai;
	CONSULT_DB?: D1Database;
	ALLOWED_ORIGINS?: string;
	LOG_HASH_SALT?: string;
	KNOWLEDGE_API_URL?: string;
	// Commerce (Stripe) — checkout is inert until both are set as secrets.
	STRIPE_SECRET_KEY?: string;
	STRIPE_PRICE_ID?: string;
	STRIPE_WEBHOOK_SECRET?: string;
	SITE_URL?: string;
}

interface ConsultRequestBody {
	challenge?: unknown;
	industry?: unknown;
	page?: unknown;
	requestId?: unknown;
}

interface ConsultSuccessResponse {
	ok: true;
	mode: 'ai' | 'fallback';
	analysisHtml: string;
	analysisText: string;
	requestId: string;
	durationMs: number;
	note?: string;
}

interface ConsultErrorResponse {
	ok: false;
	code: 'BAD_INPUT' | 'AI_TIMEOUT' | 'AI_ERROR' | 'INTERNAL' | 'RATE_LIMITED' | 'NOT_FOUND';
	message: string;
	requestId: string;
}

interface KnowledgeOrgan {
	key: string;
	name: string;
	greek: string;
	domain: string;
	description: string;
	repo_count: number;
	capabilities: string[];
	repos: Array<{
		name: string;
		display_name: string;
		tier: string;
		description: string;
		tech_stack: string[];
	}>;
	tech_stacks: string[];
}

interface KnowledgeContextSource {
	name: string;
	display_name: string;
	relevance: number;
	snippet: string;
	source_type: string;
}

interface FallbackOrgan {
	id: string;
	title: string;
	summary: string;
	capabilities: string[];
	repos: string[];
	keywords: string[];
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const AI_TIMEOUT_MS = 8000;
const MAX_CHALLENGE_LENGTH = 4000;
const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_KNOWLEDGE_API_URL = 'https://stakeholder-portal-ten.vercel.app/api/knowledge';
const DEFAULT_ALLOWED_ORIGINS = [
	'https://4444j99.github.io',
	'http://localhost:4321',
	'http://127.0.0.1:4321',
];

const INDUSTRY_HINTS: Record<string, string[]> = {
	education: ['III', 'IV', 'VI'],
	arts: ['II', 'V', 'VII'],
	saas: ['III', 'IV'],
	media: ['V', 'VII', 'III'],
	nonprofit: ['VI', 'V', 'III'],
	research: ['I', 'IV', 'V'],
	gaming: ['II', 'III', 'IV'],
	finance: ['I', 'III', 'IV'],
	healthcare: ['III', 'IV', 'VI'],
	other: ['III', 'IV'],
};

const INDUSTRY_LABELS: Record<string, string> = {
	education: 'Education & EdTech',
	arts: 'Arts & Culture',
	saas: 'SaaS & B2B Software',
	media: 'Media & Publishing',
	nonprofit: 'Nonprofit & Social Impact',
	research: 'Research & Academia',
	gaming: 'Gaming & Interactive',
	finance: 'Finance & Data',
	healthcare: 'Healthcare & Wellness',
	other: 'Cross-domain',
};

// Minimal fallback data — used only when Knowledge API is unreachable
const FALLBACK_ORGANS: FallbackOrgan[] = [
	{
		id: 'I',
		title: 'THEORIA',
		summary: 'Theory, ontology, and recursive analysis.',
		capabilities: ['Recursive symbolic engines', 'Computational ontology', 'Knowledge graphs'],
		repos: [],
		keywords: ['ontology', 'knowledge graph', 'semantic', 'analysis'],
	},
	{
		id: 'II',
		title: 'POIESIS',
		summary: 'Generative art, performance, interactive media.',
		capabilities: [
			'Participatory performance',
			'Generative media tooling',
			'AI-human creative pipelines',
		],
		repos: [],
		keywords: ['art', 'creative', 'interactive', 'performance'],
	},
	{
		id: 'III',
		title: 'ERGON',
		summary: 'Product architecture, platforms, commercial systems.',
		capabilities: ['SaaS architecture', 'B2B data systems', 'Gamified product platforms'],
		repos: [],
		keywords: ['saas', 'platform', 'product', 'b2b', 'pipeline'],
	},
	{
		id: 'IV',
		title: 'TAXIS',
		summary: 'Orchestration, governance, automation.',
		capabilities: ['Multi-agent orchestration', 'Registry governance', 'Automated audits'],
		repos: [],
		keywords: ['agent', 'orchestration', 'governance', 'automation'],
	},
	{
		id: 'V',
		title: 'LOGOS',
		summary: 'Public process, narrative, documentation.',
		capabilities: ['Technical writing', 'Decision narratives', 'Editorial systems'],
		repos: [],
		keywords: ['documentation', 'narrative', 'writing', 'editorial'],
	},
	{
		id: 'VI',
		title: 'KOINONIA',
		summary: 'Community operating models and curriculum.',
		capabilities: ['Facilitated cohorts', 'Adaptive syllabi', 'Collaborative sense-making'],
		repos: [],
		keywords: ['community', 'curriculum', 'learning', 'workshop'],
	},
	{
		id: 'VII',
		title: 'KERYGMA',
		summary: 'Distribution, channels, audience growth.',
		capabilities: ['Channel adaptation', 'Audience segmentation', 'POSSE distribution'],
		repos: [],
		keywords: ['distribution', 'audience', 'marketing', 'newsletter'],
	},
];

const ALLOWED_TAGS = ['h2', 'h3', 'p', 'strong', 'em', 'code', 'ul', 'li', 'br'];
const ALLOWED_ATTRS: Record<string, string[]> = {
	h2: ['class'],
	p: ['class'],
};

// ---------------------------------------------------------------------------
// Knowledge API integration
// ---------------------------------------------------------------------------

async function fetchOrgansFromKnowledge(env: Env): Promise<KnowledgeOrgan[] | null> {
	const baseUrl = env.KNOWLEDGE_API_URL || DEFAULT_KNOWLEDGE_API_URL;
	try {
		// Use Cloudflare Cache API for 1-hour TTL
		const cacheUrl = `${baseUrl}?endpoint=organs`;
		const cache = caches.default;
		const cached = await cache.match(cacheUrl);
		if (cached) {
			const data = (await cached.json()) as { ok: boolean; organs: KnowledgeOrgan[] };
			if (data.ok && data.organs) return data.organs;
		}

		const res = await fetch(cacheUrl, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) return null;

		// Clone and cache for 1 hour
		const cloned = new Response(res.clone().body, {
			headers: { ...Object.fromEntries(res.headers), 'Cache-Control': 'public, max-age=3600' },
		});
		await cache.put(cacheUrl, cloned);

		const data = (await res.json()) as { ok: boolean; organs: KnowledgeOrgan[] };
		return data.ok ? data.organs : null;
	} catch {
		return null;
	}
}

async function fetchContextFromKnowledge(
	challenge: string,
	env: Env,
): Promise<KnowledgeContextSource[]> {
	const baseUrl = env.KNOWLEDGE_API_URL || DEFAULT_KNOWLEDGE_API_URL;
	try {
		const url = `${baseUrl}?endpoint=context&q=${encodeURIComponent(challenge)}&limit=5`;
		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(4000),
		});
		if (!res.ok) return [];

		const data = (await res.json()) as { ok: boolean; sources: KnowledgeContextSource[] };
		return data.ok ? data.sources : [];
	} catch {
		return [];
	}
}

function buildSystemPrompt(
	organs: KnowledgeOrgan[] | null,
	contextSources: KnowledgeContextSource[],
): string {
	let organSection: string;
	if (organs && organs.length > 0) {
		organSection = organs
			.map((o) => {
				const caps = o.capabilities.slice(0, 3).join('; ');
				const repoNames = o.repos
					.slice(0, 3)
					.map((r) => r.name)
					.join(', ');
				return `- ${o.key.replace('ORGAN-', '')} ${o.greek.toUpperCase()}: ${o.domain}. Capabilities: ${caps}. Key repos: ${repoNames || 'various'}.`;
			})
			.join('\n');
	} else {
		organSection = FALLBACK_ORGANS.map((o) => `- ${o.id} ${o.title}: ${o.summary}`).join('\n');
	}

	let contextSection = '';
	if (contextSources.length > 0) {
		contextSection =
			'\n\nGROUNDED CONTEXT (from live retrieval — cite these when relevant):\n' +
			contextSources
				.map(
					(s, i) =>
						`[${i + 1}] ${s.display_name} (relevance: ${(s.relevance * 100).toFixed(0)}%): ${s.snippet.slice(0, 300)}`,
				)
				.join('\n');
	}

	return `You are the ORGANVM Capability Advisor.

Write a concise, high-signal capability analysis (300-500 words).
Use markdown with this shape:
1) One short opening acknowledgment.
2) 2-4 organ sections with "## ORGAN X — NAME".
3) A "## Recommended Next Steps" section with concrete actions.

Reference concrete capabilities and repositories from the eight-organ system:
${organSection}
${contextSection}

Be specific, practical, and implementation-oriented. When grounded context is available, reference specific repos and capabilities by name.`;
}

async function handleCheckout(request: Request, env: Env, corsHeaders: Headers): Promise<Response> {
	if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
		return jsonResponse(
			{ ok: false, code: 'NOT_CONFIGURED', message: 'Checkout is not configured.' },
			503,
			corsHeaders,
		);
	}
	const siteUrl = request.headers.get('Origin') || env.SITE_URL || 'https://4444j99.github.io';
	try {
		const params = new URLSearchParams();
		params.set('mode', 'payment');
		params.set('line_items[0][price]', env.STRIPE_PRICE_ID);
		params.set('line_items[0][quantity]', '1');
		params.set('success_url', `${siteUrl}/portfolio/consult/?checkout=success`);
		params.set('cancel_url', `${siteUrl}/portfolio/consult/?checkout=cancel`);
		const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params.toString(),
		});
		if (!res.ok) {
			return jsonResponse(
				{ ok: false, code: 'STRIPE_ERROR', message: 'Could not create checkout session.' },
				502,
				corsHeaders,
			);
		}
		const session = (await res.json()) as { id?: string; url?: string };
		return jsonResponse({ ok: true, id: session.id, url: session.url }, 200, corsHeaders);
	} catch {
		return jsonResponse(
			{ ok: false, code: 'STRIPE_ERROR', message: 'Could not create checkout session.' },
			502,
			corsHeaders,
		);
	}
}

async function verifyStripeSignature(
	payload: string,
	sigHeader: string,
	secret: string,
): Promise<boolean> {
	// Stripe-Signature header: "t=<ts>,v1=<hex hmac>[,v1=...]"
	const parts: Record<string, string> = {};
	for (const seg of sigHeader.split(',')) {
		const idx = seg.indexOf('=');
		if (idx > 0) parts[seg.slice(0, idx)] = seg.slice(idx + 1);
	}
	const t = parts.t;
	const v1 = parts.v1;
	if (!t || !v1) return false;
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
	const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
	// Constant-time comparison.
	if (expected.length !== v1.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
	return diff === 0;
}

async function handleStripeWebhook(
	request: Request,
	env: Env,
	corsHeaders: Headers,
): Promise<Response> {
	if (!env.STRIPE_WEBHOOK_SECRET) {
		return jsonResponse(
			{ ok: false, code: 'NOT_CONFIGURED', message: 'Webhook is not configured.' },
			503,
			corsHeaders,
		);
	}
	const sig = request.headers.get('Stripe-Signature');
	const payload = await request.text();
	if (!sig || !(await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET))) {
		return jsonResponse(
			{ ok: false, code: 'BAD_SIGNATURE', message: 'Invalid signature.' },
			400,
			corsHeaders,
		);
	}
	try {
		const event = JSON.parse(payload) as { type?: string; data?: { object?: { id?: string } } };
		if (event.type === 'checkout.session.completed') {
			// Fulfillment hook: the session completed. Persisting to D1 or
			// notifying would go here; for now we acknowledge receipt.
			console.log('Stripe checkout.session.completed:', event.data?.object?.id ?? 'unknown');
		}
		return jsonResponse({ ok: true, received: true }, 200, corsHeaders);
	} catch {
		return jsonResponse(
			{ ok: false, code: 'BAD_INPUT', message: 'Invalid webhook payload.' },
			400,
			corsHeaders,
		);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const origin = request.headers.get('Origin');
		const corsHeaders = getCorsHeaders(env, origin);
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		if (request.method === 'GET' && url.pathname === '/health') {
			return jsonResponse({ ok: true, service: 'consult-api' }, 200, corsHeaders);
		}

		if (request.method === 'POST' && url.pathname === '/api/checkout') {
			return handleCheckout(request, env, corsHeaders);
		}

		if (request.method === 'POST' && url.pathname === '/api/stripe-webhook') {
			return handleStripeWebhook(request, env, corsHeaders);
		}

		if (request.method !== 'POST' || url.pathname !== '/api/consult') {
			return jsonResponse(
				{ ok: false, code: 'NOT_FOUND', message: 'Not found.' },
				404,
				corsHeaders,
			);
		}

		const requestId = crypto.randomUUID();
		const startedAt = Date.now();
		const userAgent = request.headers.get('user-agent') || '';
		const clientIp = request.headers.get('CF-Connecting-IP') || '';

		const contentLength = Number(request.headers.get('content-length') || '0');
		if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
			return jsonResponse(
				{ ok: false, code: 'BAD_INPUT', message: 'Request body too large.', requestId },
				413,
				corsHeaders,
			);
		}

		if (await isRateLimited(env, clientIp)) {
			return jsonResponse(
				{
					ok: false,
					code: 'RATE_LIMITED',
					message: 'Too many requests. Please retry in a minute.',
					requestId,
				},
				429,
				corsHeaders,
			);
		}

		let body: ConsultRequestBody;
		try {
			body = (await request.json()) as ConsultRequestBody;
		} catch {
			return jsonResponse(
				{ ok: false, code: 'BAD_INPUT', message: 'Invalid JSON body.', requestId },
				400,
				corsHeaders,
			);
		}

		try {
			const challenge = typeof body.challenge === 'string' ? body.challenge.trim() : '';
			const industry = normalizeIndustry(body.industry);
			const page = typeof body.page === 'string' ? body.page.slice(0, 512) : '';
			const incomingRequestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
			const effectiveRequestId = /^[A-Za-z0-9_-]{1,64}$/.test(incomingRequestId)
				? incomingRequestId
				: requestId;

			if (challenge.length < 20 || challenge.length > MAX_CHALLENGE_LENGTH) {
				const errorBody: ConsultErrorResponse = {
					ok: false,
					code: 'BAD_INPUT',
					message: `Challenge must be between 20 and ${MAX_CHALLENGE_LENGTH} characters.`,
					requestId: effectiveRequestId,
				};
				ctx.waitUntil(
					logConsult(env, {
						id: effectiveRequestId,
						challenge,
						industry,
						mode: 'error',
						statusCode: 400,
						errorCode: errorBody.code,
						model: null,
						latencyMs: Date.now() - startedAt,
						ip: clientIp,
						userAgent,
						analysisPreview: '',
						page,
					}),
				);
				return jsonResponse(errorBody, 400, corsHeaders);
			}

			const aiOutput = await runAiWithFallback(challenge, industry, env);
			const durationMs = Date.now() - startedAt;

			const responseBody: ConsultSuccessResponse = {
				ok: true,
				mode: aiOutput.mode,
				analysisHtml: aiOutput.analysisHtml,
				analysisText: aiOutput.analysisText,
				requestId: effectiveRequestId,
				durationMs,
				note: aiOutput.note,
			};

			ctx.waitUntil(
				logConsult(env, {
					id: effectiveRequestId,
					challenge,
					industry,
					mode: aiOutput.mode,
					statusCode: 200,
					errorCode: null,
					model: aiOutput.mode === 'ai' ? MODEL : null,
					latencyMs: durationMs,
					ip: clientIp,
					userAgent,
					analysisPreview: trimForStorage(aiOutput.analysisText, 512),
					page,
				}),
			);

			return jsonResponse(responseBody, 200, corsHeaders);
		} catch (error) {
			const responseBody: ConsultErrorResponse = {
				ok: false,
				code: 'INTERNAL',
				message: 'Unable to process consultation request.',
				requestId,
			};
			ctx.waitUntil(
				logConsult(env, {
					id: requestId,
					challenge: '',
					industry: null,
					mode: 'error',
					statusCode: 500,
					errorCode: 'INTERNAL',
					model: null,
					latencyMs: Date.now() - startedAt,
					ip: clientIp,
					userAgent,
					analysisPreview: trimForStorage(String(error), 512),
					page: '',
				}),
			);
			return jsonResponse(responseBody, 500, corsHeaders);
		}
	},
};

async function runAiWithFallback(
	challenge: string,
	industry: string | null,
	env: Env,
): Promise<{ mode: 'ai' | 'fallback'; analysisHtml: string; analysisText: string; note?: string }> {
	// Fetch live organ data and grounded context in parallel
	const [organs, contextSources] = await Promise.all([
		fetchOrgansFromKnowledge(env),
		fetchContextFromKnowledge(challenge, env),
	]);

	const systemPrompt = buildSystemPrompt(organs, contextSources);

	if (!env.AI) {
		const fallback = buildDeterministicFallback(challenge, industry, organs);
		return {
			mode: 'fallback',
			analysisHtml: fallback.analysisHtml,
			analysisText: fallback.analysisText,
			note: 'Workers AI binding is unavailable. Showing deterministic capability mapping.',
		};
	}

	const userPrompt = industry ? `Industry: ${industry}\n\nChallenge: ${challenge}` : challenge;

	try {
		const aiRawResult = await withTimeout(
			env.AI.run(MODEL, {
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt },
				],
				max_tokens: 900,
				temperature: 0.35,
			}),
			AI_TIMEOUT_MS,
		);

		const aiText = extractAiText(aiRawResult);
		if (!aiText) {
			throw new Error('AI response was empty.');
		}

		return {
			mode: 'ai',
			analysisHtml: markdownToHtml(aiText),
			analysisText: aiText,
		};
	} catch (error) {
		const fallback = buildDeterministicFallback(challenge, industry, organs);
		const note =
			error instanceof Error && error.message === 'AI_TIMEOUT'
				? 'Workers AI timed out. Showing deterministic capability mapping.'
				: 'Workers AI is unavailable right now. Showing deterministic capability mapping.';
		return {
			mode: 'fallback',
			analysisHtml: fallback.analysisHtml,
			analysisText: fallback.analysisText,
			note,
		};
	}
}

function buildDeterministicFallback(
	challenge: string,
	industry: string | null,
	liveOrgans: KnowledgeOrgan[] | null,
): { analysisHtml: string; analysisText: string } {
	const selected = scoreOrgans(challenge, industry, liveOrgans);
	const challengePreview = trimForStorage(challenge, 260);
	const industryLabel = industry ? INDUSTRY_LABELS[industry] || industry : 'cross-domain';

	let html = `<p>${escapeHtml(`You are working on a ${industryLabel} challenge. The strongest immediate move is a combined architecture and orchestration approach with focused delivery slices.`)}</p>`;
	html += `<p><strong>Challenge signal:</strong> ${escapeHtml(challengePreview)}</p>`;

	for (const organ of selected) {
		html += `<h2 class="organ-heading">ORGAN ${escapeHtml(organ.id)} — ${escapeHtml(organ.title)}</h2>`;
		html += `<p>${escapeHtml(organ.summary)}</p>`;
		html += '<ul>';
		for (const capability of organ.capabilities) {
			html += `<li>${escapeHtml(capability)}</li>`;
		}
		html += '</ul>';
		if (organ.repos.length > 0) {
			html += `<p><strong>Key repos:</strong> <code>${escapeHtml(organ.repos.join(', '))}</code></p>`;
		}
	}

	html += '<h2 class="organ-heading">Recommended Next Steps</h2>';
	html += '<ul>';
	html += '<li>Scope one pilot slice with measurable outcomes over 2-3 weeks.</li>';
	html += '<li>Map responsibilities to the selected organs before implementation starts.</li>';
	html +=
		'<li>Email <code>padavano.anthony@gmail.com</code> with your context for a direct architecture review.</li>';
	html += '</ul>';

	const sanitized = sanitizeHtml(html);
	return {
		analysisHtml: sanitized,
		analysisText: sanitized
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim(),
	};
}

function scoreOrgans(
	challenge: string,
	industry: string | null,
	liveOrgans: KnowledgeOrgan[] | null,
): FallbackOrgan[] {
	// Convert live organs to fallback format if available
	const organs: FallbackOrgan[] = liveOrgans
		? liveOrgans.map((o) => ({
				id: o.key.replace('ORGAN-', '').replace('META-ORGANVM', 'META'),
				title: o.greek.toUpperCase(),
				summary: o.domain,
				capabilities: o.capabilities.slice(0, 3),
				repos: o.repos.slice(0, 3).map((r) => r.name),
				keywords: o.domain
					.toLowerCase()
					.split(/[\s,]+/)
					.filter((w) => w.length > 3),
			}))
		: FALLBACK_ORGANS;

	const normalized = challenge.toLowerCase();
	const industryBoosts = new Set(
		industry && INDUSTRY_HINTS[industry] ? INDUSTRY_HINTS[industry] : [],
	);

	const scored = organs
		.map((organ) => {
			let score = 0;
			if (industryBoosts.has(organ.id)) score += 3;
			for (const keyword of organ.keywords) {
				if (normalized.includes(keyword)) score += 2;
			}
			return { organ, score };
		})
		.sort((a, b) => b.score - a.score);

	const selected = scored
		.filter((row) => row.score > 0)
		.slice(0, 3)
		.map((row) => row.organ);

	if (selected.length > 0) return selected;
	return organs.filter((organ) => ['IV', 'III', 'II'].includes(organ.id)).slice(0, 3);
}

function normalizeIndustry(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;
	if (Object.hasOwn(INDUSTRY_HINTS, normalized)) {
		return normalized;
	}
	return 'other';
}

function getCorsHeaders(env: Env, origin: string | null): Headers {
	const configuredOrigins = (env.ALLOWED_ORIGINS || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
	const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
	const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
	return new Headers({
		'Access-Control-Allow-Origin': allowOrigin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400',
		Vary: 'Origin',
	});
}

function jsonResponse(payload: unknown, status: number, corsHeaders: Headers): Response {
	const headers = new Headers(corsHeaders);
	headers.set('Content-Type', 'application/json; charset=utf-8');
	return new Response(JSON.stringify(payload), { status, headers });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeoutId: number | undefined;
	const timeoutPromise = new Promise<T>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutMs) as unknown as number;
	});
	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timeoutId !== undefined) clearTimeout(timeoutId);
	}
}

function extractAiText(raw: unknown): string {
	if (typeof raw === 'string') return raw.trim();
	if (!raw || typeof raw !== 'object') return '';

	const record = raw as Record<string, unknown>;
	if (typeof record.response === 'string') return record.response.trim();
	if (typeof record.result === 'string') return record.result.trim();

	const resultObj = record.result as Record<string, unknown> | undefined;
	if (resultObj && typeof resultObj.response === 'string') return resultObj.response.trim();

	const contentArray = record.content as Array<{ text?: unknown }> | undefined;
	if (Array.isArray(contentArray)) {
		const merged = contentArray
			.map((chunk) => (typeof chunk.text === 'string' ? chunk.text : ''))
			.join('')
			.trim();
		if (merged) return merged;
	}

	return '';
}

function escapeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function markdownToHtml(markdown: string): string {
	const safe = escapeHtml(markdown);
	let html = safe
		.replace(/^### (.+)$/gm, '<h3>$1</h3>')
		.replace(/^## (.+)$/gm, '<h2 class="organ-heading">$1</h2>')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>')
		.replace(/`(.+?)`/g, '<code>$1</code>')
		.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
	html = html.replace(/(<li>.*<\/li>\n?)+/g, (chunk) => `<ul>${chunk}</ul>`);
	html = html
		.split(/\n\n+/)
		.map((chunk) => {
			if (chunk.startsWith('<h') || chunk.startsWith('<ul')) return chunk;
			return `<p>${chunk.replace(/\n/g, '<br>')}</p>`;
		})
		.join('');
	return sanitizeHtml(html);
}

function sanitizeHtml(html: string): string {
	return html.replace(
		/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
		(tag: string, name: string, attrs: string) => {
			const lowerName = name.toLowerCase();
			if (!ALLOWED_TAGS.includes(lowerName)) return '';
			if (tag.startsWith('</')) return `</${lowerName}>`;
			const allowedAttrs = ALLOWED_ATTRS[lowerName] || [];
			const safeAttrs = (attrs.match(/\s[\w-]+="[^"]*"/g) || []).filter((attr) =>
				allowedAttrs.some((allowed) => attr.trimStart().startsWith(`${allowed}=`)),
			);
			return `<${lowerName}${safeAttrs.join('')}>`;
		},
	);
}

function trimForStorage(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 3)}...`;
}

async function hashIp(ip: string, salt: string): Promise<string | null> {
	if (!ip) return null;
	const data = new TextEncoder().encode(`${salt}:${ip}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	const bytes = Array.from(new Uint8Array(digest));
	return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const FALLBACK_LOG_SALT = crypto.randomUUID();
let warnedNoSalt = false;
function getLogSalt(env: Env): string {
	if (env.LOG_HASH_SALT) return env.LOG_HASH_SALT;
	if (!warnedNoSalt) {
		warnedNoSalt = true;
		console.warn(
			'LOG_HASH_SALT not set; using an ephemeral per-instance salt (IP hashes will not correlate across instances).',
		);
	}
	return FALLBACK_LOG_SALT;
}

async function isRateLimited(env: Env, ip: string): Promise<boolean> {
	if (!env.CONSULT_DB || !ip) return false;
	try {
		const ipHash = await hashIp(ip, getLogSalt(env));
		if (!ipHash) return false;
		const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
		const row = await env.CONSULT_DB.prepare(
			'SELECT COUNT(*) AS n FROM consult_logs WHERE ip_hash = ?1 AND created_at > ?2',
		)
			.bind(ipHash, since)
			.first<{ n: number }>();
		return (row?.n ?? 0) >= RATE_LIMIT_MAX;
	} catch (error) {
		console.error('rate limit check failed', error);
		return false;
	}
}

async function logConsult(
	env: Env,
	payload: {
		id: string;
		challenge: string;
		industry: string | null;
		mode: 'ai' | 'fallback' | 'error';
		statusCode: number;
		errorCode: string | null;
		model: string | null;
		latencyMs: number;
		ip: string;
		userAgent: string;
		analysisPreview: string;
		page: string;
	},
): Promise<void> {
	if (!env.CONSULT_DB) return;
	try {
		const ipHash = await hashIp(payload.ip, getLogSalt(env));
		await env.CONSULT_DB.prepare(`
        INSERT INTO consult_logs (
          id,
          created_at,
          industry,
          challenge,
          mode,
          status_code,
          error_code,
          model,
          latency_ms,
          ip_hash,
          user_agent,
          analysis_preview,
          page
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      `)
			.bind(
				payload.id,
				new Date().toISOString(),
				payload.industry,
				payload.challenge,
				payload.mode,
				payload.statusCode,
				payload.errorCode,
				payload.model,
				payload.latencyMs,
				ipHash,
				trimForStorage(payload.userAgent, 512),
				payload.analysisPreview,
				payload.page,
			)
			.run();
	} catch (error) {
		console.error('consult log write failed', error);
	}
}
