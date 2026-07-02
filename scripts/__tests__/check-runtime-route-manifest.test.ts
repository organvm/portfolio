import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../');
const scriptPath = resolve(root, 'scripts/check-runtime-route-manifest.mjs');
const tempDirs: string[] = [];

interface RunResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

function makeTempDir() {
	const dir = mkdtempSync(join(tmpdir(), 'runtime-route-manifest-'));
	tempDirs.push(dir);
	return dir;
}

function runNode(args: string[], cwd: string): RunResult {
	const result = spawnSync('node', [scriptPath, ...args], {
		cwd,
		encoding: 'utf-8',
	});
	return {
		status: result.status,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	};
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

describe('check-runtime-route-manifest', () => {
	it('fails when dist contains routes missing from runtime manifest', () => {
		const dir = makeTempDir();
		const distDir = join(dir, 'dist');
		const manifestPath = join(dir, 'runtime-a11y-routes.json');

		mkdirSync(join(distDir, 'about'), { recursive: true });
		writeFileSync(join(distDir, 'index.html'), '<html><body>root</body></html>\n');
		writeFileSync(join(distDir, 'about/index.html'), '<html><body>about</body></html>\n');
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					basePath: '',
					routes: [{ path: '/' }],
				},
				null,
				2,
			) + '\n',
		);

		const result = runNode(['--dist', distDir, '--manifest', manifestPath], dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('missing from manifest');
		expect(result.stderr).toContain('/about');
	});

	it('passes when manifest route set matches built route set', () => {
		const dir = makeTempDir();
		const distDir = join(dir, 'dist');
		const manifestPath = join(dir, 'runtime-a11y-routes.json');

		mkdirSync(join(distDir, 'about'), { recursive: true });
		writeFileSync(join(distDir, 'index.html'), '<html><body>root</body></html>\n');
		writeFileSync(join(distDir, 'about/index.html'), '<html><body>about</body></html>\n');
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					basePath: '',
					routes: [{ path: '/' }, { path: '/about' }],
				},
				null,
				2,
			) + '\n',
		);

		const result = runNode(['--dist', distDir, '--manifest', manifestPath], dir);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('Runtime route manifest sync check passed');
	});
});
