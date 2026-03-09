import { describe, expect, test } from "bun:test";
import { fuzzyMatch } from "@/utils/fuzzy";

describe("fuzzyMatch", () => {
	test("empty pattern matches anything", () => {
		expect(fuzzyMatch("", "hello")).toBe(true);
		expect(fuzzyMatch("", "")).toBe(true);
	});

	test("exact match", () => {
		expect(fuzzyMatch("hello", "hello")).toBe(true);
	});

	test("substring match", () => {
		expect(fuzzyMatch("ello", "hello")).toBe(true);
		expect(fuzzyMatch("hel", "hello")).toBe(true);
	});

	test("case insensitive", () => {
		expect(fuzzyMatch("HELLO", "hello")).toBe(true);
		expect(fuzzyMatch("hello", "HELLO")).toBe(true);
		expect(fuzzyMatch("HeLLo", "hElLO")).toBe(true);
	});

	test("prefix and near-matches with typo tolerance", () => {
		expect(fuzzyMatch("buton", "button")).toBe(true);
		expect(fuzzyMatch("commo", "common")).toBe(true);
		expect(fuzzyMatch("setings", "settings")).toBe(true);
	});

	test("rejects scattered character subsequences", () => {
		// This was the original problem — "Generator" matching "errors.page_error_message"
		expect(fuzzyMatch("btn", "button")).toBe(false);
		expect(fuzzyMatch("btsv", "buttons.save")).toBe(false);
		expect(fuzzyMatch("cmmn", "common")).toBe(false);
	});

	test("no match when characters are out of order", () => {
		expect(fuzzyMatch("ba", "ab")).toBe(false);
		expect(fuzzyMatch("olleh", "hello")).toBe(false);
	});

	test("no match when pattern is longer than target", () => {
		expect(fuzzyMatch("abcdef", "abc")).toBe(false);
	});

	test("no match when characters are missing", () => {
		expect(fuzzyMatch("xyz", "hello")).toBe(false);
		expect(fuzzyMatch("hellox", "hello")).toBe(false);
	});

	test("single character matches", () => {
		expect(fuzzyMatch("h", "hello")).toBe(true);
		expect(fuzzyMatch("o", "hello")).toBe(true);
		expect(fuzzyMatch("z", "hello")).toBe(false);
	});

	test("repeated characters", () => {
		expect(fuzzyMatch("oo", "foobar")).toBe(true);
		expect(fuzzyMatch("ooo", "foobar")).toBe(false);
	});

	test("realistic translation key searches", () => {
		expect(fuzzyMatch("nav", "navigation")).toBe(true);
		expect(fuzzyMatch("error", "error.message")).toBe(true);
		expect(fuzzyMatch("sett", "settings")).toBe(true);
		expect(fuzzyMatch("login", "login")).toBe(true);
		expect(fuzzyMatch("home", "home.title")).toBe(true);
		expect(fuzzyMatch("genertor", "generator")).toBe(true);
	});

	test("does not match unrelated strings", () => {
		expect(fuzzyMatch("generator", "errors.page_error_message")).toBe(false);
		expect(fuzzyMatch("button", "schedule")).toBe(false);
	});
});
