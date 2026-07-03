import { describe, expect, it } from 'vitest';
import worker from '../src/index';

describe('consult-api worker router and core logic', () => {
	const mockCtx = {
		waitUntil: () => {},
		passThroughOnException: () => {},
	};

	it('handles OPTIONS request with CORS headers', async () => {
		const req = new Request('http://localhost/api/consult', {
			method: 'OPTIONS',
			headers: { Origin: 'http://localhost:4321' },
		});
		const res = await worker.fetch(req, {} as any, mockCtx);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4321');
	});

	it('handles /health endpoint', async () => {
		const req = new Request('http://localhost/health');
		const res = await worker.fetch(req, {} as any, mockCtx);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ ok: true, service: 'consult-api' });
	});

	it('returns NOT_FOUND for unknown paths', async () => {
		const req = new Request('http://localhost/unknown', { method: 'POST' });
		const res = await worker.fetch(req, {} as any, mockCtx);
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Not found.' });
	});

	it('handles /api/checkout when not configured', async () => {
		const req = new Request('http://localhost/api/checkout', { method: 'POST' });
		const res = await worker.fetch(req, {} as any, mockCtx);
		expect(res.status).toBe(503);
		const data = await res.json();
		expect(data).toEqual({ ok: false, code: 'NOT_CONFIGURED', message: 'Checkout is not configured.' });
	});

	it('handles /api/stripe-webhook when not configured', async () => {
		const req = new Request('http://localhost/api/stripe-webhook', { method: 'POST' });
		const res = await worker.fetch(req, {} as any, mockCtx);
		expect(res.status).toBe(503);
		const data = await res.json();
		expect(data).toEqual({ ok: false, code: 'NOT_CONFIGURED', message: 'Webhook is not configured.' });
	});

	it('returns BAD_INPUT for invalid JSON on /api/consult', async () => {
		const req = new Request('http://localhost/api/consult', {
			method: 'POST',
			body: '{invalid}',
		});
		const res = await worker.fetch(req, {} as any, mockCtx);
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.code).toBe('BAD_INPUT');
		expect(data.message).toBe('Invalid JSON body.');
	});

	it('returns BAD_INPUT if challenge is too short', async () => {
		const req = new Request('http://localhost/api/consult', {
			method: 'POST',
			body: JSON.stringify({ challenge: 'short' }),
		});
		const env = { CONSULT_DB: { prepare: () => ({ bind: () => ({ run: async () => {} }) }) } };
		const res = await worker.fetch(req, env as any, mockCtx);
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.code).toBe('BAD_INPUT');
		expect(data.message).toContain('Challenge must be between 20');
	});
});
