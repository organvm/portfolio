/**
 * Centralized base-path helpers.
 *
 * Astro's `import.meta.env.BASE_URL` can return `/portfolio` or `/portfolio/`
 * depending on context. These helpers normalise the value so every consumer
 * gets a consistent trailing-slash form.
 */

/** Base path with a guaranteed trailing slash, e.g. `/`. */
export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Full canonical origin + base, e.g. `https://4444j99.dev`. */
export const canonicalBase = 'https://4444j99.dev';
