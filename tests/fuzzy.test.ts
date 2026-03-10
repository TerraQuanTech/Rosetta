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

	// --- Non-Latin script support ---

	test("Cyrillic (Russian, Ukrainian, Bulgarian, etc.)", () => {
		expect(fuzzyMatch("Часто", "Частота")).toBe(true);
		expect(fuzzyMatch("настр", "Настройка частоты")).toBe(true);
		expect(fuzzyMatch("загруз", "Загрузка данных")).toBe(true);
		expect(fuzzyMatch("Привіт", "Привіт світ")).toBe(true);
		expect(fuzzyMatch("абвгд", "язык")).toBe(false);
	});

	test("Greek", () => {
		expect(fuzzyMatch("Καλη", "Καλημέρα")).toBe(true);
		expect(fuzzyMatch("ρυθμ", "Ρυθμίσεις")).toBe(true);
		expect(fuzzyMatch("αβγ", "δεζ")).toBe(false);
	});

	test("Arabic", () => {
		expect(fuzzyMatch("مرح", "مرحبا")).toBe(true);
		expect(fuzzyMatch("إعدا", "الإعدادات")).toBe(true);
		expect(fuzzyMatch("سلام", "وداع")).toBe(false);
	});

	test("Hebrew", () => {
		expect(fuzzyMatch("שלו", "שלום")).toBe(true);
		expect(fuzzyMatch("הגדר", "הגדרות")).toBe(true);
		expect(fuzzyMatch("אבג", "תשר")).toBe(false);
	});

	test("Devanagari (Hindi, Sanskrit, etc.)", () => {
		expect(fuzzyMatch("नमस", "नमस्ते")).toBe(true);
		expect(fuzzyMatch("सेटिंग", "सेटिंग्स")).toBe(true);
		expect(fuzzyMatch("अबक", "घचछ")).toBe(false);
	});

	test("Bengali", () => {
		expect(fuzzyMatch("স্বাগ", "স্বাগতম")).toBe(true);
		expect(fuzzyMatch("সেটি", "সেটিংস")).toBe(true);
		expect(fuzzyMatch("কখগ", "ঘঙচ")).toBe(false);
	});

	test("Tamil", () => {
		expect(fuzzyMatch("வணக", "வணக்கம்")).toBe(true);
		expect(fuzzyMatch("அமை", "அமைப்புகள்")).toBe(true);
		expect(fuzzyMatch("அஆஇ", "உஊஎ")).toBe(false);
	});

	test("Thai", () => {
		expect(fuzzyMatch("สวัส", "สวัสดี")).toBe(true);
		expect(fuzzyMatch("การตั้ง", "การตั้งค่า")).toBe(true);
		expect(fuzzyMatch("กขค", "ฆงจ")).toBe(false);
	});

	test("Japanese (Hiragana + Katakana)", () => {
		expect(fuzzyMatch("こんに", "こんにちは")).toBe(true);
		expect(fuzzyMatch("せってい", "せっていがめん")).toBe(true);
		expect(fuzzyMatch("カタカ", "カタカナ")).toBe(true);
		expect(fuzzyMatch("あいう", "かきく")).toBe(false);
	});

	test("CJK (Chinese)", () => {
		expect(fuzzyMatch("设置", "设置页面")).toBe(true);
		expect(fuzzyMatch("你好", "你好世界")).toBe(true);
		expect(fuzzyMatch("加载", "正在加载")).toBe(true);
		expect(fuzzyMatch("天地", "山水")).toBe(false);
	});

	test("Korean (Hangul)", () => {
		expect(fuzzyMatch("안녕", "안녕하세요")).toBe(true);
		expect(fuzzyMatch("설정", "설정 페이지")).toBe(true);
		expect(fuzzyMatch("가나다", "라마바")).toBe(false);
	});

	test("Georgian", () => {
		expect(fuzzyMatch("გამარ", "გამარჯობა")).toBe(true);
		expect(fuzzyMatch("პარამ", "პარამეტრები")).toBe(true);
		expect(fuzzyMatch("აბგ", "დევ")).toBe(false);
	});

	test("Armenian", () => {
		expect(fuzzyMatch("Բարե", "Բարեւ ձեզ")).toBe(true);
		expect(fuzzyMatch("Կարգ", "Կարգավորում")).toBe(true);
		expect(fuzzyMatch("ԱԲԳ", "ԴԵԶ")).toBe(false);
	});

	test("Latin accented (French, German, Spanish, etc.)", () => {
		expect(fuzzyMatch("Paramètr", "Paramètres")).toBe(true);
		expect(fuzzyMatch("Einstellung", "Einstellungen")).toBe(true);
		expect(fuzzyMatch("Configuració", "Configuración")).toBe(true);
		expect(fuzzyMatch("über", "Übersicht")).toBe(true);
	});

	test("mixed scripts in value search", () => {
		expect(fuzzyMatch("配置", "系统配置页面")).toBe(true);
		expect(fuzzyMatch("Настр", "Настройки системы")).toBe(true);
		expect(fuzzyMatch("設定", "設定画面")).toBe(true);
	});
});
