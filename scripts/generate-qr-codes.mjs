import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const personasPath = path.join(__dirname, '../src/data/personas.json');
const personas = JSON.parse(fs.readFileSync(personasPath, 'utf8')).personas;

const OUTPUT_DIR = path.join(__dirname, '../public/qr');
const BASE_URL = 'https://organvm.github.io/portfolio/resume';

async function downloadQR(url, outputPath) {
	const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&color=d4a853&bgcolor=0a0a0b`;

	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(outputPath);
		https
			.get(apiUrl, (response) => {
				response.pipe(file);
				file.on('finish', () => {
					file.close();
					resolve();
				});
			})
			.on('error', (err) => {
				fs.unlink(outputPath, () => {});
				reject(err);
			});
	});
}

async function generateQRCodes() {
	console.log('🔮 Generating Omni-Link QR Codes...');

	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	for (const persona of personas) {
		const url = `${BASE_URL}/${persona.slug}/`;
		const outputPath = path.join(OUTPUT_DIR, `${persona.slug}-qr.png`);

		console.log(`📡 Generating QR for ${persona.title}...`);
		try {
			await downloadQR(url, outputPath);
			console.log(`✅ Saved to ${outputPath}`);
		} catch (err) {
			console.error(`❌ Failed to generate QR for ${persona.title}:`, err.message);
		}
	}

	console.log('🏁 QR Generation Complete.');
}

generateQRCodes().catch(console.error);
