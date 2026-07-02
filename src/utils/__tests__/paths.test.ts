import { describe, expect, it } from 'vitest';
import { canonicalBase } from '../paths';

describe('paths', () => {
	it('canonicalBase is a valid HTTPS URL', () => {
		expect(() => new URL(canonicalBase)).not.toThrow();
		expect(canonicalBase).toMatch(/^https:\/\//);
	});

	it('canonicalBase is at the root path', () => {
		const url = new URL(canonicalBase);
		expect(url.pathname).toBe('/');
	});

	it('canonicalBase has no trailing slash', () => {
		expect(canonicalBase.endsWith('/')).toBe(false);
	});

	it('module exports base as a string', async () => {
		const mod = await import('../paths');
		expect(typeof mod.base).toBe('string');
		expect(mod.base.endsWith('/')).toBe(true);
	});
});
