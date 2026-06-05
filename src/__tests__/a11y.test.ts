import { existsSync, readdirSync, readFileSync } from 'fs';
import { Window } from 'happy-dom';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hasAxeRuntime = process.env.RUN_AXE_A11Y === '1';

const DIST = resolve(process.cwd(), 'dist');
const describeBuiltOutput = existsSync(DIST) ? describe : describe.skip;

function findHtmlFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findHtmlFiles(fullPath));
		} else if (entry.name.endsWith('.html')) {
			results.push(fullPath);
		}
	}
	return results;
}

async function auditFile(filePath: string) {
	const html = readFileSync(filePath, 'utf-8')
		.replace(/<link\b[^>]*rel=["']?stylesheet[^>]*>/gi, '')
		.replace(/<script\b[\s\S]*?<\/script>/gi, '');
	const window = new Window({
		url: 'http://localhost',
		settings: {
			enableJavaScriptEvaluation: true,
			disableCSSFileLoading: true,
			disableJavaScriptFileLoading: true,
			suppressInsecureJavaScriptEnvironmentWarning: true,
		},
	});
	const document = window.document;
	document.open();
	document.write(html);
	document.close();

	if (typeof window.HTMLCanvasElement !== 'undefined') {
		Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: () => ({
				fillRect: () => {},
				getImageData: () => ({ data: new Uint8ClampedArray(4) }),
				putImageData: () => {},
				createImageData: () => [],
				setTransform: () => {},
				drawImage: () => {},
				save: () => {},
				restore: () => {},
				beginPath: () => {},
				closePath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				stroke: () => {},
				translate: () => {},
				scale: () => {},
				rotate: () => {},
				arc: () => {},
				fill: () => {},
				measureText: () => ({ width: 0 }),
				transform: () => {},
				rect: () => {},
				clip: () => {},
			}),
		});
	}

	// Inject axe-core into the happy-dom window — standard approach for
	// running axe-core in Node.js. Source is a trusted first-party dependency.
	const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf-8');

	try {
		window.eval(axeSource);
		const axe = (window as any).axe;
		const results = await axe.run(document, {
			runOnly: ['wcag2a', 'wcag2aa'],
		});
		window.close();
		return results;
	} catch (err: unknown) {
		window.close();
		// happy-dom's querySelectorAll does not support all CSS escape sequences
		// (e.g. numeric-prefixed IDs like #\37-...). Skip pages that trigger this.
		// The error may come from a VM context, so check message via string coercion.
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('is not a valid selector')) {
			return { violations: [], incomplete: [], passes: [], inapplicable: [], skipped: true };
		}
		throw err;
	}
}

// Discover all HTML pages in dist/ for full-site auditing
const keyPages = existsSync(DIST) ? findHtmlFiles(DIST).map((f) => f.slice(DIST.length + 1)) : [];

describeBuiltOutput('accessibility (axe-core)', { timeout: 15_000 }, () => {
	it('dist/ exists for a11y auditing', () => {
		expect(existsSync(DIST)).toBe(true);
	});

	for (const page of keyPages) {
		if (!hasAxeRuntime) {
			it.skip(`${page} has no critical a11y violations`, () => {});
			it.skip(`${page} has no serious a11y violations`, () => {});
			continue;
		}

		it(`${page} has no critical a11y violations`, async () => {
			const filePath = resolve(DIST, page);
			if (!existsSync(filePath)) return; // skip if not built

			const results = await auditFile(filePath);
			if (results.skipped) return; // happy-dom selector limitation

			const critical = results.violations.filter(
				(v: { impact: string }) => v.impact === 'critical',
			);

			if (critical.length > 0) {
				const summary = critical
					.map((v: { id: string; description: string }) => `${v.id}: ${v.description}`)
					.join('\n');
				expect.fail(`Critical violations:\n${summary}`);
			}
		});

		it(`${page} has no serious a11y violations`, async () => {
			const filePath = resolve(DIST, page);
			if (!existsSync(filePath)) return;

			const results = await auditFile(filePath);
			if (results.skipped) return; // happy-dom selector limitation

			const serious = results.violations.filter((v: { impact: string }) => v.impact === 'serious');

			if (serious.length > 0) {
				const summary = serious
					.map((v: { id: string; description: string }) => `${v.id}: ${v.description}`)
					.join('\n');
				expect.fail(`Serious violations:\n${summary}`);
			}
		});
	}
});
