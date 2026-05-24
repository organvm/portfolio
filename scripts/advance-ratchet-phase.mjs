#!/usr/bin/env node
/**
 * Advance or sync the quality ratchet default phase across policy, workflow, and CI.
 * Updates: ratchet-policy.json defaultPhase, ci.yml QUALITY_PHASE, README.md thresholds.
 *
 * Usage:
 *   node scripts/advance-ratchet-phase.mjs --phase W10 --dry-run   # preview
 *   node scripts/advance-ratchet-phase.mjs --phase W10 --confirm   # apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POLICY_PATH = path.join(ROOT, '.quality/ratchet-policy.json');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/ci.yml');
const README_PATH = path.join(ROOT, 'README.md');

function parseArgs() {
	const args = process.argv.slice(2);
	let phase = null;
	let dryRun = false;
	let confirm = false;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--phase' && args[i + 1]) {
			phase = args[i + 1];
			i++;
		} else if (args[i] === '--dry-run') {
			dryRun = true;
		} else if (args[i] === '--confirm') {
			confirm = true;
		}
	}

	return { phase, dryRun, confirm };
}

function main() {
	const { phase, dryRun, confirm } = parseArgs();

	const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf-8'));
	const VALID_PHASES = Object.keys(policy.phases || {});

	if (!phase) {
		console.error(
			`Usage: node scripts/advance-ratchet-phase.mjs --phase <PHASE> [--dry-run] [--confirm]`,
		);
		console.error(`Available phases: ${VALID_PHASES.join(', ')}`);
		console.error('  --dry-run                 Preview changes without writing');
		console.error('  --confirm                 Required to write; prevents accidental runs');
		process.exit(1);
	}

	if (!VALID_PHASES.includes(phase)) {
		console.error(`Error: Phase must be one of ${VALID_PHASES.join(', ')}`);
		process.exit(1);
	}

	if (!dryRun && !confirm) {
		console.error('Error: --confirm required to apply changes. Use --dry-run to preview.');
		process.exit(1);
	}

	const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
	const readme = fs.readFileSync(README_PATH, 'utf-8');

	const currentPhase = policy.defaultPhase;
	const policyChanged = currentPhase !== phase;
	const workflowNeedsUpdate = !workflow.includes(`QUALITY_PHASE: ${phase}`);

	// Minimal check for README (we could be more thorough here)
	const readmeNeedsUpdate = false; // We will generate the update string and check diff

	if (!policyChanged && !workflowNeedsUpdate && !readmeNeedsUpdate) {
		console.log(`No changes needed. Default phase is already ${phase}.`);
		// But wait, what if README is out of sync? Let's proceed to generate README anyway.
	}

	console.log('Planned changes:');
	if (policyChanged) {
		console.log(`  ratchet-policy.json: defaultPhase ${currentPhase} → ${phase}`);
	}
	if (workflowNeedsUpdate) {
		console.log(`  ci.yml: QUALITY_PHASE → ${phase}`);
	}

	// Generate README updates
	const coverageLines = VALID_PHASES.map((p) => {
		const c = policy.phases[p].coverage;
		return `${p} \`${c.statements}/${c.branches}/${c.functions}/${c.lines}\``;
	}).join(', ');

	const hintLines = VALID_PHASES.map((p) => {
		const h = policy.phases[p].typecheck.hintsMax;
		return `${p} \`${h === 0 ? '=0' : `<=${h}`}\``;
	}).join(', ');

	let updatedReadme = readme.replace(
		/Coverage ratchet policy:.*?\./,
		`Coverage ratchet policy: ${coverageLines} (Statements/Branches/Functions/Lines).`,
	);
	updatedReadme = updatedReadme.replace(
		/Typecheck hint budget policy:.*?\./,
		`Typecheck hint budget policy: ${hintLines}.`,
	);

	const readmeChanged = updatedReadme !== readme;
	if (readmeChanged) {
		console.log('  README.md: update ratchet schedules');
	}

	if (!policyChanged && !workflowNeedsUpdate && !readmeChanged) {
		console.log('No changes needed.');
		process.exit(0);
	}

	if (dryRun) {
		console.log('\n[--dry-run] No files modified.');
		process.exit(0);
	}

	if (policyChanged) {
		policy.defaultPhase = phase;
		fs.writeFileSync(POLICY_PATH, JSON.stringify(policy, null, 2) + '\n');
		console.log('  ✓ Updated ratchet-policy.json');
	}

	if (workflowNeedsUpdate) {
		const updated = workflow.replace(/QUALITY_PHASE:\s*\w+/g, `QUALITY_PHASE: ${phase}`);
		fs.writeFileSync(WORKFLOW_PATH, updated);
		console.log('  ✓ Updated ci.yml');
	}

	if (readmeChanged) {
		fs.writeFileSync(README_PATH, updatedReadme);
		console.log('  ✓ Updated README.md');
	}

	console.log('\nDone. Run "npm run test" to verify quality governance tests pass.');
}

main();
