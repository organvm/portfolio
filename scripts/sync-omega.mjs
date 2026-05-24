import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from './lib/atomic-write.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OMEGA_PATH = path.join(__dirname, '../src/data/omega.json');
const TARGETS_PATH = path.join(__dirname, '../src/data/targets.json');

async function syncOmega() {
	console.log('🔄 Synchronizing Omega Scorecard with Intelligence Ledger...');

	const omega = JSON.parse(fs.readFileSync(OMEGA_PATH, 'utf8'));
	const targetsData = JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8'));

	const targetCount = targetsData.targets.length;

	const criterion5 = omega.criteria.find((c) => c.id === 5);
	if (criterion5) {
		criterion5.evidence = `Doris Duke / Mozilla Artists Make Technology Lab submitted 2026-02-24. ${targetCount} strategic AI-generated targeted applications deployed.`;

		// Automatically mark met if there are targets
		if (targetCount > 0 && criterion5.status !== 'met') {
			criterion5.status = 'met';
			criterion5.dateMet = new Date().toISOString().split('T')[0];
		}
	}

	// Recalculate summary metrics
	let metCount = 0;
	let inProgressCount = 0;
	let notStartedCount = 0;

	omega.criteria.forEach((c) => {
		if (c.status === 'met') metCount++;
		else if (c.status === 'in_progress') inProgressCount++;
		else notStartedCount++;
	});

	omega.summary = {
		met: metCount,
		in_progress: inProgressCount,
		not_started: notStartedCount,
		total: omega.criteria.length,
	};

	omega.generated = new Date().toISOString().split('T')[0];

	writeJsonAtomic(OMEGA_PATH, omega);
	console.log(
		`✅ Omega Scorecard synchronized. Horizon 2 (Criterion 5) linked to ${targetCount} active strike targets.`,
	);
}

syncOmega().catch(console.error);
