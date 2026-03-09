import { describe, expect, test } from "bun:test";
import { flatten, unflatten } from "@shared/json";

describe("flatten", () => {
	test("flattens a simple nested object", () => {
		const input = { a: { b: "hello", c: "world" } };
		expect(flatten(input)).toEqual({
			"a.b": "hello",
			"a.c": "world",
		});
	});

	test("flattens deeply nested objects", () => {
		const input = { a: { b: { c: { d: "deep" } } } };
		expect(flatten(input)).toEqual({ "a.b.c.d": "deep" });
	});

	test("handles flat objects", () => {
		const input = { foo: "bar", baz: "qux" };
		expect(flatten(input)).toEqual({ foo: "bar", baz: "qux" });
	});

	test("skips non-string leaf values", () => {
		const input = { a: "keep", b: 42, c: true, d: null, e: [1, 2] } as any;
		expect(flatten(input)).toEqual({ a: "keep" });
	});

	test("handles empty objects", () => {
		expect(flatten({})).toEqual({});
	});

	test("handles nested empty objects", () => {
		const input = { a: { b: {} } };
		expect(flatten(input)).toEqual({});
	});

	test("handles real i18n structure", () => {
		const input = {
			measure: {
				title: "Measure",
				peaks: {
					title: "Peaks",
					count: "Peaks ({{count}})",
				},
			},
			real: "Re",
		};
		expect(flatten(input)).toEqual({
			"measure.title": "Measure",
			"measure.peaks.title": "Peaks",
			"measure.peaks.count": "Peaks ({{count}})",
			real: "Re",
		});
	});
});

describe("unflatten", () => {
	test("unflattens dot-notation keys", () => {
		const input = { "a.b": "hello", "a.c": "world" };
		expect(unflatten(input)).toEqual({ a: { b: "hello", c: "world" } });
	});

	test("unflattens deeply nested keys", () => {
		const input = { "a.b.c.d": "deep" };
		expect(unflatten(input)).toEqual({ a: { b: { c: { d: "deep" } } } });
	});

	test("handles flat keys", () => {
		const input = { foo: "bar", baz: "qux" };
		expect(unflatten(input)).toEqual({ foo: "bar", baz: "qux" });
	});

	test("handles empty object", () => {
		expect(unflatten({})).toEqual({});
	});

	test("merges sibling paths correctly", () => {
		const input = {
			"settings.display.theme": "dark",
			"settings.display.mode": "compact",
			"settings.general.title": "General",
		};
		expect(unflatten(input)).toEqual({
			settings: {
				display: { theme: "dark", mode: "compact" },
				general: { title: "General" },
			},
		});
	});
});

describe("flatten + unflatten roundtrip", () => {
	test("roundtrips a complex object", () => {
		const original = {
			common: {
				buttons: {
					save: "Save",
					cancel: "Cancel",
					delete: "Delete",
				},
				status: {
					connected: "Connected",
					disconnected: "Disconnected",
				},
			},
			title: "My App",
		};

		const flat = flatten(original);
		const restored = unflatten(flat);
		expect(restored).toEqual(original);
	});

	test("roundtrips real i18n data", () => {
		const original = {
			measure: {
				peaks: {
					title: "Peaks",
					threshold: "Threshold: {{value}}%",
					labels: "Labels",
				},
				history: {
					title: "Processing History",
					columns: {
						timestamp: "Time",
						operation: "Operation",
					},
				},
			},
		};

		expect(unflatten(flatten(original))).toEqual(original);
	});
});
