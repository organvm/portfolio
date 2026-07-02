import type p5 from 'p5';
import vitals from '../../data/vitals.json';
import { getTextColor } from './palette';

interface TickerItem {
	text: string;
	x: number;
	sparkline: number[];
}

export default function tickerSketch(p: p5, container: HTMLElement) {
	let items: TickerItem[] = [];
	const scrollSpeed = 0.8;
	const isMobile = () => container.clientWidth < 768;

	const headlines = [
		'BREAKING: System achieves full autonomy',
		`${vitals.repos.total} repos | 8 organs | OPERATIONAL`,
		`Essay count: ${vitals.logos.essays} | ~${Math.round(vitals.logos.words / 1000)}K words`,
		'Engagement: +23% MoM',
		'Retention: 41% at month-6',
		'3,586 code files across system',
		'736 test files validated',
		'Promotion pipeline: ACTIVE',
		'Distribution: POSSE channels live',
	];

	p.setup = () => {
		p.createCanvas(container.clientWidth, container.clientHeight);
		p.frameRate(30);
		initItems();
	};

	function initItems() {
		items = [];
		let xOffset = p.width;
		headlines.forEach((text) => {
			const sparkline = Array.from({ length: 20 }, () => Math.random());
			items.push({ text, x: xOffset, sparkline });
			xOffset += (isMobile() ? 200 : 300) + text.length * (isMobile() ? 5 : 7);
		});
	}

	p.draw = () => {
		p.clear();
		const textRGB = getTextColor();
		const cy = p.height / 2;

		// Horizontal divider lines
		p.stroke(255, 255, 255, 15);
		p.strokeWeight(0.5);
		p.line(0, cy - 25, p.width, cy - 25);
		p.line(0, cy + 25, p.width, cy + 25);

		items.forEach((item) => {
			item.x -= scrollSpeed;

			// Draw sparkline
			const sparkW = isMobile() ? 30 : 50;
			const sparkH = 16;
			const sparkX = item.x;
			const sparkY = cy - sparkH / 2;

			p.noFill();
			p.stroke(255, 255, 255, 60);
			p.strokeWeight(1);
			p.beginShape();
			item.sparkline.forEach((v, i) => {
				const sx = sparkX + (i / (item.sparkline.length - 1)) * sparkW;
				const sy = sparkY + sparkH - v * sparkH;
				p.vertex(sx, sy);
			});
			p.endShape();

			// Draw text
			p.fill(...textRGB, 120);
			p.noStroke();
			p.textFont('JetBrains Mono, monospace');
			p.textSize(isMobile() ? 9 : 11);
			p.textAlign(p.LEFT, p.CENTER);
			p.text(item.text, sparkX + sparkW + 8, cy);

			// Separator dot
			const fullWidth = sparkW + 8 + p.textWidth(item.text) + 20;
			p.fill(255, 255, 255, 30);
			p.circle(item.x + fullWidth, cy, 3);
		});

		// Wrap items that scroll off-screen
		const lastItem = items[items.length - 1];
		const lastWidth = (isMobile() ? 30 : 50) + 8 + lastItem.text.length * (isMobile() ? 5 : 7) + 20;
		if (items[0].x + items[0].text.length * 8 < -100) {
			const removed = items.shift()!;
			removed.x = lastItem.x + lastWidth + 40;
			// Refresh sparkline
			removed.sparkline = Array.from({ length: 20 }, () => Math.random());
			items.push(removed);
		}
	};

	p.windowResized = () => {
		p.resizeCanvas(container.clientWidth, container.clientHeight);
		initItems();
	};
}
