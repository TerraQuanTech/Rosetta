/**
 * Simple fuzzy match: all characters of the pattern must appear in order
 * in the target string (case-insensitive). Returns true if matched.
 */
export function fuzzyMatch(pattern: string, target: string): boolean {
	const p = pattern.toLowerCase();
	const t = target.toLowerCase();

	if (p.length === 0) return true;
	if (p.length > t.length) return false;

	// Fast path: substring match
	if (t.includes(p)) return true;

	let pi = 0;
	for (let ti = 0; ti < t.length && pi < p.length; ti++) {
		if (t[ti] === p[pi]) pi++;
	}
	return pi === p.length;
}
