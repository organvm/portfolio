import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTargetJson } from './lib/parse-gemini-target.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTAKE_DIR = path.join(__dirname, '../intake/job-descriptions');
const PROCESSED_DIR = path.join(INTAKE_DIR, 'processed');
const PERSONAS_PATH = path.join(__dirname, '../src/data/personas.json');

async function sweep() {
	console.log(`
🌪️  Initializing Operative Sweep Protocol...`);

	if (!fs.existsSync(INTAKE_DIR)) {
		fs.mkdirSync(INTAKE_DIR, { recursive: true });
	}
	if (!fs.existsSync(PROCESSED_DIR)) {
		fs.mkdirSync(PROCESSED_DIR, { recursive: true });
	}

	const files = fs.readdirSync(INTAKE_DIR).filter((f) => f.endsWith('.txt') || f.endsWith('.md'));

	if (files.length === 0) {
		console.log(`
✅ No new job descriptions found in intake/job-descriptions/.
`);
		process.exit(0);
	}

	const personasData = JSON.parse(fs.readFileSync(PERSONAS_PATH, 'utf8')).personas;
	const personaContext = personasData
		.map((p) => `- ID: ${p.id} | Title: ${p.title} | Stack: ${p.stack.join(', ')}`)
		.join('\\n');

	for (const file of files) {
		const filePath = path.join(INTAKE_DIR, file);
		console.log(`
📡 Analyzing target file: ${file}...`);

		const content = fs.readFileSync(filePath, 'utf8').substring(0, 3000); // cap size to prevent token explosion

		const prompt = `
You are an elite AI system parsing a job description to determine the optimal targeted application strategy.
I have the following persona archetypes available:
${personaContext}

Analyze the following job description and extract three things:
1. The exact name of the Company.
2. The exact Role Title.
3. The most suitable Persona ID from my list above.

Output EXACTLY this JSON format and nothing else. No markdown, no backticks, no conversational text.
{"company": "Company Name", "role": "Role Title", "persona_id": "the-persona-id"}

Job Description:
"""
${content}
"""
    `.trim();

		try {
			console.log(`🧠 AI extracting metadata and matching persona...`);
			const output = execFileSync('gemini', ['-p', prompt], {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			});
			const parsed = parseTargetJson(output);

			console.log(
				`🎯 Target Locked: ${parsed.company} | ${parsed.role} | Persona: ${parsed.persona_id}`,
			);

			console.log(`🚀 Executing Strike Protocol...`);
			// Execute the strike command synchronously
			const strikeResult = spawnSync(
				'npm',
				['run', 'strike:new', '--', parsed.company, parsed.role, parsed.persona_id],
				{ stdio: 'inherit' },
			);
			if (strikeResult.status !== 0) {
				throw new Error(`strike:new exited with status ${strikeResult.status}`);
			}

			// Move file to processed
			fs.renameSync(filePath, path.join(PROCESSED_DIR, file));
			console.log(`📦 Moved ${file} to processed/ directory.`);
		} catch (error) {
			console.error(`❌ Failed to process ${file}: ${error.message}`);
			console.error(`Output received: ${error.stdout ? error.stdout.toString() : 'None'}`);
		}
	}

	console.log(`
🌪️  Sweep Complete.
`);
}

sweep().catch(console.error);
