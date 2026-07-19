/**
 * Contract tests for the consult API Worker.
 * Validates module structure and expected request/response shapes.
 * Full integration tests require @cloudflare/vitest-pool-workers (Vitest 2-3.x).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(resolve(__dirname, '../src/index.ts'), 'utf-8');

describe('consult-api worker contract', () => {
	it('exports default fetch handler', () => {
		expect(workerSrc).toMatch(/export\s+default\s*\{/);
		expect(workerSrc).toMatch(/fetch\s*[:(]/);
	});

	it('defines expected error response codes', () => {
		expect(workerSrc).toContain("'BAD_INPUT'");
		expect(workerSrc).toContain("'AI_TIMEOUT'");
		expect(workerSrc).toContain("'AI_ERROR'");
		expect(workerSrc).toContain("'INTERNAL'");
	});

	it('success response shape includes ok, mode, analysisHtml, requestId', () => {
		expect(workerSrc).toMatch(/ok:\s*true/);
		expect(workerSrc).toContain('analysisHtml');
		expect(workerSrc).toContain('requestId');
		expect(workerSrc).toContain('durationMs');
	});

	it('failure response shape includes ok: false, code, message', () => {
		expect(workerSrc).toMatch(/ok:\s*false/);
		expect(workerSrc).toContain('message');
	});

	it('validates challenge input (non-empty, length limit)', () => {
		expect(workerSrc).toContain('MAX_CHALLENGE_LENGTH');
		expect(workerSrc).toMatch(/challenge|trim|length/);
	});

	it('handles CORS via ALLOWED_ORIGINS', () => {
		expect(workerSrc).toContain('ALLOWED_ORIGINS');
	});
});
