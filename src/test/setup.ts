/**
 * Neither happy-dom nor jsdom implement canvas rendering APIs by default.
 * A minimal stub keeps tests deterministic and signal-rich.
 */

/**
 * p5 >= 2.3.0 renders 2D shapes through Path2D (PrimitiveToPath2DConverter
 * initializes `new Path2D()` as a class field). Neither happy-dom nor jsdom
 * provide Path2D, so stub it with no-op methods.
 */
if (typeof window !== 'undefined' && typeof (globalThis as any).Path2D === 'undefined') {
	class Path2DStub {
		addPath() {}
		arc() {}
		arcTo() {}
		bezierCurveTo() {}
		closePath() {}
		ellipse() {}
		lineTo() {}
		moveTo() {}
		quadraticCurveTo() {}
		rect() {}
		roundRect() {}
	}
	(globalThis as any).Path2D = Path2DStub;
}

/**
 * p5 >= 2.3.0 ships a Friendly-Error-System sketch verifier whose presetup
 * lifecycle does `document.querySelectorAll('script')` and reads `.src` on
 * the last entry. Test DOMs contain no script elements, so that is
 * `undefined` and throws an unhandled TypeError. An empty inline script
 * keeps the verifier on its happy path (empty source parses cleanly).
 */
if (
	typeof document !== 'undefined' &&
	document.head &&
	document.querySelectorAll('script').length === 0
) {
	const placeholderScript = document.createElement('script');
	placeholderScript.setAttribute('data-test-placeholder', 'p5-sketch-verifier');
	document.head.appendChild(placeholderScript);
}

if (typeof HTMLCanvasElement !== 'undefined') {
	const contextStub = {
		canvas: null as HTMLCanvasElement | null,
		fillRect: () => {},
		clearRect: () => {},
		getImageData: () => ({ data: new Uint8ClampedArray() }),
		putImageData: () => {},
		createImageData: () => [],
		setTransform: () => {},
		drawImage: () => {},
		save: () => {},
		fillText: () => {},
		restore: () => {},
		beginPath: () => {},
		moveTo: () => {},
		lineTo: () => {},
		closePath: () => {},
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
	};

	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: function getContext() {
			contextStub.canvas = this;
			return contextStub;
		},
	});

	Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
		configurable: true,
		value: () => 'data:image/png;base64,',
	});
}
