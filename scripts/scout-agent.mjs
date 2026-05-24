#!/usr/bin/env node

/**
 * Scout Agent
 * Autonomous discovery of new strike candidates.
 * Searches for roles matching core personas and generates draft intelligence.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES_PATH = path.join(__dirname, '../src/data/scout-candidates.json');
const PERSONAS_PATH = path.join(__dirname, '../src/data/personas.json');

const personas = JSON.parse(fs.readFileSync(PERSONAS_PATH, 'utf8')).personas;

async function scout() {
	console.log('🔭 Scout Agent activating...');

	const candidates = existsSync(CANDIDATES_PATH)
		? JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'))
		: { last_scout: null, candidates: [] };

	for (const persona of personas) {
		console.log(`🔍 Scouting for persona: ${persona.title}...`);

		// Simulate web search for job roles
		// In a real environment, we'd use searchWeb here
		// For this implementation, we use gemini to find relevant companies/roles
		const searchPrompt = `List 3 companies and specific open roles (e.g. "Senior AI Engineer at OpenAI") that would be a perfect fit for a "${persona.title}" with a focus on "${persona.thesis}". Provide only the company name, role, and a one-sentence justification. Format as JSON: [{"company": "...", "role": "...", "reason": "..."}]`;

		try {
			const output = execFileSync('gemini', ['-p', searchPrompt], {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			});
			const jsonMatch = output.match(/\[.*\]/s);
			if (jsonMatch) {
				const found = JSON.parse(jsonMatch[0]);

				for (const item of found) {
					if (
						!candidates.candidates.some((c) => c.company === item.company && c.role === item.role)
					) {
						console.log(`✨ Found candidate: ${item.company} - ${item.role}`);
						candidates.candidates.push({
							...item,
							persona_id: persona.id,
							status: 'triage',
							discovered_at: new Date().toISOString(),
						});
					}
				}
			}
		} catch (error) {
			console.warn(`⚠️ Scouting failed for ${persona.id}`);
		}
	}

	candidates.last_scout = new Date().toISOString();
	fs.writeFileSync(CANDIDATES_PATH, JSON.stringify(candidates, null, 2));
	console.log(`
✅ Scouting complete. ${candidates.candidates.filter((c) => c.status === 'triage').length} candidates in triage.`);
}

function existsSync(p) {
	try {
		fs.accessSync(p);
		return true;
	} catch {
		return false;
	}
}

scout().catch(console.error);
