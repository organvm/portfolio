import { defineConfig } from '@playwright/test';

const browserOverride = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
	? {
			launchOptions: {
				executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
			},
		}
	: process.env.PLAYWRIGHT_BROWSER_CHANNEL
		? {
				channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
			}
		: {};

export default defineConfig({
	testDir: '../src/e2e',
	testMatch: '*.smoke.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60000,
	reporter: [['line'], ['json', { outputFile: '../.quality/e2e-smoke-report.json' }]],
	use: {
		baseURL: 'http://127.0.0.1:4173/portfolio/',
		headless: true,
		...browserOverride,
	},
	projects: [
		{
			name: 'mobile',
			use: {
				viewport: { width: 390, height: 844 },
			},
		},
		{
			name: 'desktop',
			use: {
				viewport: { width: 1440, height: 900 },
			},
		},
	],
	webServer: {
		command: 'npm run preview -- --host 127.0.0.1 --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});
