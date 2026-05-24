import { renameSync, writeFileSync } from 'node:fs';

/**
 * Write JSON to disk atomically: serialize to a temp file in the same
 * directory, then rename over the target. rename(2) is atomic on a single
 * filesystem, so a crash or interruption mid-write leaves the original file
 * intact rather than truncated/corrupted.
 *
 * @param {string} filePath - Destination path.
 * @param {unknown} data - Value to JSON.stringify.
 * @param {{ indent?: number | string, trailingNewline?: boolean }} [opts]
 *   indent/trailingNewline preserve each caller's existing output format.
 */
export function writeJsonAtomic(filePath, data, opts = {}) {
	const { indent = 2, trailingNewline = true } = opts;
	const body = JSON.stringify(data, null, indent) + (trailingNewline ? '\n' : '');
	const tmpPath = `${filePath}.tmp-${process.pid}`;
	writeFileSync(tmpPath, body, 'utf8');
	renameSync(tmpPath, filePath);
}
