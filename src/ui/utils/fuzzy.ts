import uFuzzy from "@leeoniya/ufuzzy";

const uf = new uFuzzy({
	intraMode: 1,
	intraIns: 3,
	interIns: 5,
	intraSub: 1,
	intraTrn: 1,
	intraDel: 1,
	// Recognize non-Latin scripts as word characters.
	// Ranges must survive uFuzzy's internal .toLowerCase() — use lowercase-safe blocks.
	alpha: [
		"a-zA-Z0-9",
		"\u00C0-\u024F", // Latin Extended (accented)
		"\u0370-\u03FF", // Greek
		"\u0400-\u04FF", // Cyrillic
		"\u0530-\u058F", // Armenian
		"\u0590-\u05FF", // Hebrew
		"\u0600-\u06FF", // Arabic
		"\u0900-\u097F", // Devanagari
		"\u0980-\u09FF", // Bengali
		"\u0B80-\u0BFF", // Tamil
		"\u0E00-\u0E7F", // Thai
		"\u10D0-\u10FF", // Georgian (Mkhedruli lowercase block — \u10A0 block breaks on toLowerCase)
		"\u1100-\u11FF", // Hangul Jamo
		"\u3040-\u30FF", // Hiragana + Katakana
		"\u3400-\u4DBF", // CJK Extension A
		"\u4E00-\u9FFF", // CJK Unified
		"\uAC00-\uD7AF", // Hangul Syllables
	].join(""),
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
