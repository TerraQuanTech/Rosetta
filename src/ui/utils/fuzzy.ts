import uFuzzy from "@leeoniya/ufuzzy";

const uf = new uFuzzy({
	intraMode: 1,
	intraIns: 3,
	interIns: 5,
	intraSub: 1,
	intraTrn: 1,
	intraDel: 1,
});

/**
 * Fuzzy match using uFuzzy. Returns true if the target is
 * a quality match for the given pattern.
 */
export function fuzzyMatch(pattern: string, target: string): boolean {
	if (pattern.length === 0) return true;
	if (pattern.length > target.length) return false;

	const haystack = [target];
	const idxs = uf.filter(haystack, pattern);

	return idxs !== null && idxs.length > 0;
}
