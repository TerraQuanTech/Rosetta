import { describe, expect, test } from "bun:test";
import { KNOWN_LOCALES, getLocaleInfo, searchLocales } from "@/utils/locales";

describe("KNOWN_LOCALES", () => {
	test("has fr and fr-CA but not fr-FR", () => {
		const fr = KNOWN_LOCALES.find((l) => l.code === "fr");
		const frCA = KNOWN_LOCALES.find((l) => l.code === "fr-CA");
		const frFR = KNOWN_LOCALES.find((l) => l.code === "fr-FR");

		expect(fr).toBeDefined();
		expect(fr?.name).toBe("French");
		expect(frCA).toBeDefined();
		expect(frCA?.name).toBe("French (Canada)");
		expect(frFR).toBeUndefined();
	});

	test("has en and en-US and en-GB but not en-UK", () => {
		const en = KNOWN_LOCALES.find((l) => l.code === "en");
		const enUS = KNOWN_LOCALES.find((l) => l.code === "en-US");
		const enGB = KNOWN_LOCALES.find((l) => l.code === "en-GB");
		const enUK = KNOWN_LOCALES.find((l) => l.code === "en-UK");

		expect(en).toBeDefined();
		expect(enUS).toBeDefined();
		expect(enGB).toBeDefined();
		expect(enUK).toBeUndefined();
	});

	test("all locales have required fields", () => {
		for (const locale of KNOWN_LOCALES) {
			expect(locale.code).toBeDefined();
			expect(locale.name).toBeDefined();
			expect(locale.nativeName).toBeDefined();
			expect(locale.flag).toBeDefined();
		}
	});
});

describe("getLocaleInfo", () => {
	test("returns correct info for known codes", () => {
		const fr = getLocaleInfo("fr");
		expect(fr?.name).toBe("French");
		expect(fr?.flag).toBe("🇫🇷");
	});

	test("returns undefined for unknown codes", () => {
		expect(getLocaleInfo("xyz")).toBeUndefined();
		expect(getLocaleInfo("fr-FR")).toBeUndefined();
	});
});

describe("searchLocales", () => {
	test("searching fr returns fr, fr-CA at top, then other matches", () => {
		const results = searchLocales("fr", ["en"]);

		expect(results.length).toBeGreaterThan(0);
		expect(results[0].code).toBe("fr");
		expect(results[1]?.code).toBe("fr-CA");
	});

	test("searching en returns en, en-US, en-GB at top", () => {
		const results = searchLocales("en", []);

		expect(results[0].code).toBe("en");
		expect(results[1]?.code).toBe("en-US");
		expect(results[2]?.code).toBe("en-GB");
	});

	test("searching by language name returns matches", () => {
		const results = searchLocales("German", []);

		expect(results.some((r) => r.code === "de")).toBe(true);
	});

	test("searching by native name returns matches", () => {
		const results = searchLocales("日本語", []);

		expect(results.some((r) => r.code === "ja")).toBe(true);
	});

	test("excludes existing locales from results", () => {
		const results = searchLocales("fr", ["fr", "fr-CA"]);

		expect(results.some((r) => r.code === "fr")).toBe(false);
		expect(results.some((r) => r.code === "fr-CA")).toBe(false);
	});

	test("empty query returns empty array", () => {
		expect(searchLocales("", [])).toEqual([]);
		expect(searchLocales("   ", [])).toEqual([]);
	});

	test("unknown query returns empty or minimal results", () => {
		const results = searchLocales("xyz", []);
		expect(results.length).toBeLessThanOrEqual(8);
	});
});
