import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOGImage } from './generate-og-images.mjs';
import { writeJsonAtomic } from './lib/atomic-write.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGETS_PATH = path.join(__dirname, '../src/data/targets.json');
const PUBLIC_DIR = path.join(__dirname, '../public');

function generateAIIntro(company, role, persona) {
	console.log(`🧠 AI Engine generating targeted synthesis for ${company}...`);
	const prompt = `Write a professional 2-sentence introduction for an application to ${company} for the role of ${role}. Write in the first person. Frame my background around the '${persona}' persona, emphasizing system architecture, generative AI, and logical integrity. Do not include greetings or sign-offs, just the two sentences.`;

	try {
		const output = execFileSync('gemini', ['-p', prompt], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		const lines = output
			.replace(/\u001b\[[0-9;]*m/g, '')
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		const cleanOutput = lines
			.filter(
				(l) =>
					!l.startsWith('Loading ') &&
					!l.startsWith('Server ') &&
					!l.startsWith('Tools ') &&
					!l.startsWith('Loaded ') &&
					!l.includes('tool update notification'),
			)
			.join(' ')
			.trim();
		return (
			cleanOutput ||
			`[DRAFT] Put your high-value synthesis here linking ${company}'s mission to your proven capabilities.`
		);
	} catch (error) {
		console.warn('⚠️ AI generation failed. Falling back to draft template.');
		return `[DRAFT] Put your high-value synthesis here linking ${company}'s mission to your proven capabilities.`;
	}
}

function generateAIProposal(company, role, persona) {
	console.log(`🧠 AI Engine generating comprehensive proposal for ${company}...`);
	const prompt = `Write a compelling 3-paragraph executive proposal for an application to ${company} for the role of ${role}. Frame my background around the '${persona}' persona. The proposal must be highly opinionated, focusing on systemic architecture, logocentric design, and quality assurance. Do not use generic corporate jargon. Be direct and authoritative. Do not include a greeting or signature. Output the response in raw HTML format using only <p>, <strong>, and <ul>/<li> tags. Do not use markdown backticks.`;

	try {
		const output = execFileSync('gemini', ['-p', prompt], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		const lines = output
			.replace(/\u001b\[[0-9;]*m/g, '')
			.split('\n')
			.filter((l) => l.trim().length > 0);
		const cleanOutput = lines
			.filter(
				(l) =>
					!l.startsWith('Loading ') &&
					!l.startsWith('Server ') &&
					!l.startsWith('Tools ') &&
					!l.startsWith('Loaded ') &&
					!l.includes('tool update notification'),
			)
			.join('\n')
			.trim();
		return cleanOutput || `<p>[DRAFT PROPOSAL] Detailed architectural proposal goes here.</p>`;
	} catch (error) {
		console.warn('⚠️ AI proposal generation failed. Falling back to draft template.');
		return `<p>[DRAFT PROPOSAL] Detailed architectural proposal goes here.</p>`;
	}
}

async function createStrike() {
	const company = process.argv[2];
	const role = process.argv[3];
	const persona = process.argv[4] || 'systems-architect';

	if (!company || !role) {
		console.error('Usage: npm run strike:new "Company Name" "Target Role" ["persona-id"]');
		process.exit(1);
	}

	const slug = company
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

	const data = JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8'));

	if (data.targets.some((t) => t.slug === slug)) {
		console.error(`\n❌ Error: Target '${slug}' already exists in the intelligence ledger.`);
		process.exit(1);
	}

	const aiIntro = generateAIIntro(company, role, persona);
	const aiProposal = generateAIProposal(company, role, persona);

	const newTarget = {
		slug,
		company,
		role,
		tier: 'Strategic',
		channel: 'Direct',
		persona_id: persona,
		keyword_focus: ['Architecture', 'System Design'],
		intro: aiIntro,
		proposal: aiProposal,
	};

	data.targets.unshift(newTarget);

	writeJsonAtomic(TARGETS_PATH, data);

	// Generate bespoke OG image
	console.log(`🎨 Generating bespoke social card for ${company}...`);
	const ogPath = path.join(PUBLIC_DIR, 'og', 'strikes', `${slug}.png`);
	const personaTitle = persona
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
	await generateOGImage(ogPath, `For ${company}`, personaTitle);

	console.log(`\n✅ Strike target generated: ${company}`);
	console.log(`\n  1. Target injected into src/data/targets.json`);
	console.log(`  2. Review the file to customize the 'intro' and 'keyword_focus'.`);
	console.log(`  3. The tailored application will be available at: /for/${slug}`);
	console.log(`  4. Run 'npm run build:resume' to generate the tailored PDF.\n`);
}

createStrike().catch(console.error);
