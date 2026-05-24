/**
 * Shared CLI argument parsing utility.
 * Used across quality scripts that accept --flag or --flag=value arguments.
 */

const args = process.argv.slice(2);

/**
 * Parse a CLI option by name from process.argv.
 * Supports both `--name value` and `--name=value` formats.
 * @param {string} name - option name without leading dashes
 * @param {string|null} [fallback=null] - default if not found
 * @returns {string|null}
 */
export function parseOption(name, fallback = null) {
	const eq = args.find((entry) => entry.startsWith(`--${name}=`));
	if (eq) return eq.slice(eq.indexOf('=') + 1);
	const index = args.indexOf(`--${name}`);
	if (index >= 0) return args[index + 1] ?? fallback;
	return fallback;
}
