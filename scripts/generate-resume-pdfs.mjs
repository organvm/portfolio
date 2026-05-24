import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const personasPath = path.join(__dirname, '../src/data/personas.json');
const personas = JSON.parse(fs.readFileSync(personasPath, 'utf8')).personas;

const targetsPath = path.join(__dirname, '../src/data/targets.json');
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8')).targets;

const OUTPUT_DIR = path.join(__dirname, '../public/resume');
const BASE_URL = 'http://localhost:4321/portfolio';

async function generatePDFs() {
	console.log('🚀 Starting Colossal Concurrent PDF Generation Factory...');

	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	const browser = await chromium.launch();

	// Create an array of tasks to execute in parallel
	const generationTasks = [];

	// Helper function to process a single URL
	const generateSinglePDF = async (url, outputPath, logPrefix) => {
		const page = await browser.newPage();
		try {
			await page.goto(url, { waitUntil: 'networkidle' });
			await page.pdf({
				path: outputPath,
				format: 'Letter',
				printBackground: true,
				tagged: true,
				outline: true,
				margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
			});
			console.log(`✅ [${logPrefix}] Saved to ${outputPath}`);
		} catch (err) {
			console.error(`❌ [${logPrefix}] Failed to generate PDF:`, err.message);
		} finally {
			await page.close();
		}
	};

	// 1. Queue Persona PDFs
	for (const persona of personas) {
		const url = `${BASE_URL}/resume/${persona.slug}/`;
		const outputPath = path.join(OUTPUT_DIR, `Anthony_James_Padavano_${persona.pdfName}.pdf`);
		generationTasks.push(generateSinglePDF(url, outputPath, `Persona: ${persona.title}`));
	}

	// 2. Queue Targeted Application Bundles
	for (const target of targets) {
		const url = `${BASE_URL}/for/${target.slug}/`;
		const outputPath = path.join(
			OUTPUT_DIR,
			`Anthony_James_Padavano_App_${target.company.replace(/\s+/g, '_')}.pdf`,
		);
		generationTasks.push(generateSinglePDF(url, outputPath, `Target: ${target.company}`));
	}

	// 3. Queue Full Polymath PDF
	const polymathPath = path.join(OUTPUT_DIR, 'Anthony_James_Padavano_CV_Polymath.pdf');
	generationTasks.push(
		generateSinglePDF(`${BASE_URL}/resume/polymath/`, polymathPath, `Polymath CV`),
	);

	// Await all parallel tasks
	await Promise.all(generationTasks);

	await browser.close();
	console.log('🏁 Colossal PDF Generation Factory Complete in record time!');
}

generatePDFs().catch(console.error);
