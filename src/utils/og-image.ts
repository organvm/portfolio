import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

// Satori requires raw TTF/OTF — woff2 is not supported.
// Prefer local fonts so static builds do not depend on network availability.
let fontDataCache: ArrayBuffer | null = null;

const LOCAL_FONT_PATHS = [
	'public/fonts/syne-latin.ttf',
	'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
	'/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
];

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
	return buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	) as ArrayBuffer;
}

async function fetchFontData(): Promise<ArrayBuffer> {
	const res = await fetch(
		'https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_3fvj6k.ttf',
	);
	if (!res.ok) {
		throw new Error(`Failed to fetch Syne font for OG image: ${res.status} ${res.statusText}`);
	}
	return res.arrayBuffer();
}

async function getFontData(): Promise<ArrayBuffer> {
	if (fontDataCache) return fontDataCache;

	for (const path of LOCAL_FONT_PATHS) {
		const fontPath = path.startsWith('/') ? path : resolve(process.cwd(), path);
		if (existsSync(fontPath)) {
			fontDataCache = bufferToArrayBuffer(readFileSync(fontPath));
			return fontDataCache;
		}
	}

	fontDataCache = await fetchFontData();
	return fontDataCache;
}

export async function generateOGImage(
	title: string,
	subtitle: string,
	accentColor = '#d4a853',
): Promise<Uint8Array> {
	const fontData = await getFontData();
	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'flex-end',
					padding: '60px',
					background: '#0a0a0b',
					fontFamily: 'Syne',
				},
				children: [
					{
						type: 'div',
						props: {
							style: {
								width: '80px',
								height: '4px',
								background: accentColor,
								marginBottom: '24px',
								borderRadius: '2px',
							},
						},
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: title.length > 40 ? '48px' : '56px',
								fontWeight: 700,
								color: '#e8e6e3',
								lineHeight: 1.2,
								marginBottom: '16px',
								letterSpacing: '-0.02em',
							},
							children: title,
						},
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: '24px',
								color: '#a09e9b',
								lineHeight: 1.4,
								marginBottom: '40px',
							},
							children: subtitle,
						},
					},
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'flex-end',
							},
							children: [
								{
									type: 'div',
									props: {
										style: {
											fontSize: '18px',
											color: '#6e6e71',
											letterSpacing: '0.05em',
										},
										children: '4444j99.github.io/portfolio',
									},
								},
								{
									type: 'div',
									props: {
										style: {
											fontSize: '20px',
											fontWeight: 700,
											color: accentColor,
										},
										children: '4444j99',
									},
								},
							],
						},
					},
				],
			},
		},
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: 'Syne',
					data: fontData,
					weight: 400,
					style: 'normal' as const,
				},
				{
					name: 'Syne',
					data: fontData,
					weight: 700,
					style: 'normal' as const,
				},
			],
		},
	);

	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: 1200 },
	});
	return resvg.render().asPng();
}
