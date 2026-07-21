import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../');
const scriptPath = resolve(root, 'scripts/check-policy-change-governance.mjs');
const tempDirs: string[] = [];

interface RunResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

function makeTempDir() {
	const dir = mkdtempSync(join(tmpdir(), 'policy-governance-'));
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

function git(cwd: string, cmd: string) {
	return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8' }).trim();
}

function initializeRepo(): { dir: string; baseSha: string; headSha: string } {
	const dir = makeTempDir();
	mkdirSync(join(dir, '.quality'), { recursive: true });
	writeFileSync(join(dir, '.quality/security-policy.json'), JSON.stringify({ version: 1 }) + '\n');

	git(dir, 'init -q');
	git(dir, 'config user.email "test@example.com"');
	git(dir, 'config user.name "Test Runner"');
	git(dir, 'add .');
	git(dir, 'commit -m "base" --quiet');
	const baseSha = git(dir, 'rev-parse HEAD');

	writeFileSync(join(dir, '.quality/security-policy.json'), JSON.stringify({ version: 2 }) + '\n');
	git(dir, 'add .quality/security-policy.json');
	git(dir, 'commit -m "security policy update" --quiet');
	const headSha = git(dir, 'rev-parse HEAD');

	return { dir, baseSha, headSha };
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

describe('check-policy-change-governance', () => {
	it('fails when security policy changed without required checklist acknowledgements', () => {
		const { dir, baseSha, headSha } = initializeRepo();
		const result = runNode(
			['--base', baseSha, '--head', headSha, '--pr-body', '- [ ] Security policy impact reviewed'],
			dir,
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Security policy files changed');
		expect(result.stderr).toContain('allowlist impact review');
	});

	it('passes when required security checklist acknowledgements are present', () => {
		const { dir, baseSha, headSha } = initializeRepo();
		const prBody = [
			'- [x] Security policy impact reviewed',
			'- [x] Security allowlist impact reviewed',
		].join('\n');

		const result = runNode(['--base', baseSha, '--head', headSha, '--pr-body', prBody], dir);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('Policy governance check passed.');
	});
});
