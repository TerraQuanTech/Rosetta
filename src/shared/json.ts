/**
 * Flatten a nested object into dot-notation keys.
 *
 *   { a: { b: 1, c: { d: 2 } } }  =>  { "a.b": 1, "a.c.d": 2 }
 *
 * Only string leaf values are included (arrays and non-string values are skipped).
 */
export function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			Object.assign(result, flatten(value as Record<string, unknown>, fullKey));
		} else if (typeof value === "string") {
			result[fullKey] = value;
		}
	}

	return result;
}

/**
 * Unflatten dot-notation keys back into a nested object.
 *
 *   { "a.b": 1, "a.c.d": 2 }  =>  { a: { b: 1, c: { d: 2 } } }
 */
export function unflatten(flat: Record<string, string>): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	// Sort keys to ensure parent paths are created before children
	const sortedKeys = Object.keys(flat).sort();

	for (const key of sortedKeys) {
		const parts = key.split(".");
		let current = result;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (!(part in current) || typeof current[part] !== "object") {
				current[part] = {};
			}
			current = current[part] as Record<string, unknown>;
		}

		current[parts[parts.length - 1]] = flat[key];
	}

	return result;
}
