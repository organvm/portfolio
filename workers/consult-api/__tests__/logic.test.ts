import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';

describe('consult-api worker full logic', () => {
	const mockCtx = {
		waitUntil: vi.fn(),
		passThroughOnException: vi.fn(),
	};

	let originalFetch: typeof global.fetch;
	let originalCaches: any;

	beforeEach(() => {
		originalFetch = global.fetch;
		originalCaches = (global as any).caches;
		mockCtx.waitUntil.mockClear();
		
		(global as any).caches = {
			default: {
				match: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
			}
		};
	});

	afterEach(() => {
		global.fetch = originalFetch;
		(global as any).caches = originalCaches;
		vi.restoreAllMocks();
	});

	it('returns fallback response when AI is undefined and fetch fails', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
		
		const req = new Request('http://localhost/api/consult', {
			method: 'POST',
			body: JSON.stringify({ challenge: 'this is a challenge that is at least twenty chars', industry: 'education' }),
		});
		
		const env = { 
			CONSULT_DB: { 
				prepare: () => ({ 
					bind: () => ({ 
						first: async () => ({ n: 0 }),
						run: async () => {} 
					}) 
				}) 
			} 
		};
		
		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.mode).toBe('fallback');
		expect(data.analysisHtml).toContain('You are working on a Education &amp; EdTech challenge');
		expect(data.note).toBe('Workers AI binding is unavailable. Showing deterministic capability mapping.');
	});

	it('returns rate limited if DB says so', async () => {
		const req = new Request('http://localhost/api/consult', {
			method: 'POST',
			body: JSON.stringify({ challenge: 'this is a challenge that is at least twenty chars' }),
			headers: { 'CF-Connecting-IP': '127.0.0.1' }
		});
		
		const env = { 
			CONSULT_DB: { 
				prepare: () => ({ 
					bind: () => ({ 
						first: async () => ({ n: 100 }), // greater than RATE_LIMIT_MAX (12)
					}) 
				}) 
			} 
		};
		
		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(429);
		const data = await res.json();
		expect(data.code).toBe('RATE_LIMITED');
	});

	it('handles checkout success with configured env', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: 'sess_123', url: 'https://checkout.stripe.com/123' })
		} as any);

		const req = new Request('http://localhost/api/checkout', { method: 'POST' });
		const env = { 
			STRIPE_SECRET_KEY: 'sk_test_123',
			STRIPE_PRICE_ID: 'price_123'
		};

		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.id).toBe('sess_123');
		expect(data.url).toBe('https://checkout.stripe.com/123');
	});

	it('handles checkout error from stripe', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
		} as any);

		const req = new Request('http://localhost/api/checkout', { method: 'POST' });
		const env = { 
			STRIPE_SECRET_KEY: 'sk_test_123',
			STRIPE_PRICE_ID: 'price_123'
		};

		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(502);
		const data = await res.json();
		expect(data.code).toBe('STRIPE_ERROR');
	});

	it('handles stripe webhook with invalid signature', async () => {
		const req = new Request('http://localhost/api/stripe-webhook', { 
			method: 'POST',
			headers: { 'Stripe-Signature': 't=123,v1=invalidhex' },
			body: JSON.stringify({ type: 'checkout.session.completed' })
		});
		
		const env = { 
			STRIPE_WEBHOOK_SECRET: 'whsec_123'
		};

		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.code).toBe('BAD_SIGNATURE');
	});

	it('handles stripe webhook with valid signature', async () => {
		const secret = 'whsec_123';
		const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'sess_123' } } });
		const t = Date.now().toString();
		
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
		const v1 = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
		
		const req = new Request('http://localhost/api/stripe-webhook', { 
			method: 'POST',
			headers: { 'Stripe-Signature': `t=${t},v1=${v1}` },
			body: payload
		});
		
		const env = { 
			STRIPE_WEBHOOK_SECRET: secret
		};

		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.received).toBe(true);
	});

	it('uses AI when available', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false
		} as any);

		const req = new Request('http://localhost/api/consult', {
			method: 'POST',
			body: JSON.stringify({ challenge: 'this is a challenge that is at least twenty chars', industry: 'education' }),
		});
		
		const env = { 
			CONSULT_DB: { 
				prepare: () => ({ 
					bind: () => ({ 
						first: async () => ({ n: 0 }),
						run: async () => {} 
					}) 
				}) 
			},
			AI: {
				run: vi.fn().mockResolvedValue({ response: 'This is the AI response.' })
			}
		};
		
		const res = await worker.fetch(req, env as any, mockCtx as any);
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.mode).toBe('ai');
		expect(data.analysisText).toBe('This is the AI response.');
		expect(data.analysisHtml).toContain('This is the AI response.');
	});

	it('falls back when AI times out', async () => {
		vi.useFakeTimers();
		global.fetch = vi.fn().mockResolvedValue({
			ok: false
		} as any);

		const req = new Request('http://localhost/api/consult', {
			method: 'POST',
			body: JSON.stringify({ challenge: 'this is a challenge that is at least twenty chars' }),
		});
		
		const env = { 
			CONSULT_DB: { 
				prepare: () => ({ 
					bind: () => ({ 
						first: async () => ({ n: 0 }),
						run: async () => {} 
					}) 
				}) 
			},
			AI: {
				run: vi.fn().mockImplementation(() => new Promise(() => {})) // never resolves
			}
		};
		
		const resPromise = worker.fetch(req, env as any, mockCtx as any);
		await vi.advanceTimersByTimeAsync(8500);
		const res = await resPromise;

		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.mode).toBe('fallback');
		expect(data.note).toBe('Workers AI timed out. Showing deterministic capability mapping.');
		
		vi.useRealTimers();
	});
});
