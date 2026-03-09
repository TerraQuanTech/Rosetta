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

	test("characters in order but not contiguous", () => {
		expect(fuzzyMatch("btn", "button")).toBe(true);
		expect(fuzzyMatch("btsv", "buttons.save")).toBe(true);
		expect(fuzzyMatch("cmmn", "common")).toBe(true);
		expect(fuzzyMatch("hlo", "hello")).toBe(true);
	});

	test("dot-separated key paths", () => {
		expect(fuzzyMatch("btn.sv", "buttons.save")).toBe(true);
		expect(fuzzyMatch("usr.prof", "user.profile")).toBe(true);
		expect(fuzzyMatch("a.b.c", "alpha.beta.gamma")).toBe(false);
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

	test("repeated characters consume left-to-right", () => {
		expect(fuzzyMatch("oo", "foobar")).toBe(true);
		expect(fuzzyMatch("ooo", "foobar")).toBe(false);
	});

	test("realistic translation key searches", () => {
		expect(fuzzyMatch("nav", "navigation")).toBe(true);
		expect(fuzzyMatch("errmsg", "error.message")).toBe(true);
		expect(fuzzyMatch("sttgs", "settings")).toBe(true);
		expect(fuzzyMatch("lgn", "login")).toBe(true);
		expect(fuzzyMatch("hm.ttl", "home.title")).toBe(true);
	});
});
