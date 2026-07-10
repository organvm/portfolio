#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PREVIEW_HOST = 'localhost';
const PREVIEW_PORT = 4321;
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`;

async function isServerRunning(url) {
	try {
		const res = await fetch(url);
		return res.status === 200 || res.status === 404; // 404 is fine as long as server responds
	} catch {
		return false;
	}
}

async function waitForServer(url, timeoutMs = 30000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await isServerRunning(url)) return true;
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

function startServer(command, args) {
	console.log(`📡 Starting temporary server: ${command} ${args.join(' ')}`);
	const server = spawn(command, args, {
		stdio: 'ignore',
		detached: false,
	});
	return server;
}

async function main() {
	const needsServer = !(await isServerRunning(PREVIEW_URL));
	let serverProcess = null;

	if (needsServer) {
		const hasDist = existsSync(resolve('dist'));
		const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
		const args = hasDist ? ['run', 'preview'] : ['run', 'dev'];

		serverProcess = startServer(command, args);

		console.log('⏳ Waiting for server to stabilize...');
		const ready = await waitForServer(PREVIEW_URL);
		if (!ready) {
			console.error('❌ Server failed to start in time.');
			serverProcess.kill();
			process.exit(1);
		}
		console.log('✅ Server ready.');
	} else {
		console.log('✅ Existing server detected at', PREVIEW_URL);
	}

	console.log('🚀 Invoking PDF Generation Factory...');
	const genProcess = spawn('node', ['scripts/generate-resume-pdfs.mjs'], {
		stdio: 'inherit',
	});

	genProcess.on('exit', (code) => {
		if (serverProcess) {
			console.log('🛑 Killing temporary server...');
			serverProcess.kill();
		}
		process.exit(code);
	});
}

main().catch((err) => {
	console.error('💥 Orchestration failed:', err);
	process.exit(1);
});
