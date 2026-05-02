import { describe, expect, test } from "bun:test";
import type { PptxSyncPayload } from "@terraquantech/rosetta-core";
import { PptxTranslationStore } from "@terraquantech/rosetta-pptx";

function makeSyncPayload(): PptxSyncPayload {
	return {
		sourceLocale: "en",
		slides: [
			{
				index: 0,
				name: "Slide 1",
				shapes: [
					{
						name: "Title 1",
						paragraphs: [
							{
								text: "Welcome to Our Product",
								runs: [
									{ text: "Welcome to ", bold: true, fontSize: 36 },
									{ text: "Our Product", bold: true, fontSize: 36, color: "#0066CC" },
								],
							},
						],
					},
					{
						name: "Subtitle 1",
						paragraphs: [
							{
								text: "The best translation tool",
								runs: [{ text: "The best translation tool", fontSize: 18 }],
							},
						],
					},
				],
			},
			{
				index: 1,
				name: "Slide 2",
				shapes: [
					{
						name: "Content 1",
						paragraphs: [
							{
								text: "First point",
								runs: [{ text: "First point" }],
							},
							{
								text: "Second point",
								runs: [{ text: "Second point" }],
							},
						],
					},
				],
			},
		],
	};
}

describe("PptxTranslationStore", () => {
	test("populateFromSync creates correct store structure", () => {
		const store = new PptxTranslationStore();
		const result = store.populateFromSync(makeSyncPayload());

		expect(result.mode).toBe("pptx");
		expect(result.locales).toEqual(["en"]);
		expect(result.namespaces).toHaveLength(2);
		expect(result.namespaces[0].name).toBe("Slide 1");
		expect(result.namespaces[1].name).toBe("Slide 2");
	});

	test("populateFromSync extracts text with correct keys", () => {
		const store = new PptxTranslationStore();
		const result = store.populateFromSync(makeSyncPayload());

		expect(result.translations["Slide 1"]["Title 1.p0"]["en"]).toBe("Welcome to Our Product");
		expect(result.translations["Slide 1"]["Subtitle 1.p0"]["en"]).toBe("The best translation tool");
		expect(result.translations["Slide 2"]["Content 1.p0"]["en"]).toBe("First point");
		expect(result.translations["Slide 2"]["Content 1.p1"]["en"]).toBe("Second point");
	});

	test("updateKey modifies translation value", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());

		const ok = await store.updateKey({
			namespace: "Slide 1",
			key: "Title 1.p0",
			locale: "en",
			value: "Updated Title",
		});

		expect(ok).toBe(true);
		expect(store.getStore().translations["Slide 1"]["Title 1.p0"]["en"]).toBe("Updated Title");
	});

	test("addLocale creates new language column with source text", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());

		const ok = await store.addLocale("fr");
		expect(ok).toBe(true);

		const result = store.getStore();
		expect(result.locales).toEqual(["en", "fr"]);
		expect(result.translations["Slide 1"]["Title 1.p0"]["fr"]).toBe("Welcome to Our Product");
		expect(result.translations["Slide 2"]["Content 1.p1"]["fr"]).toBe("Second point");
	});

	test("addLocale with copyFrom copies from specified locale", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());
		await store.addLocale("fr");

		await store.updateKey({
			namespace: "Slide 1",
			key: "Title 1.p0",
			locale: "fr",
			value: "Bienvenue",
		});

		await store.addLocale("fr-CA", "fr");
		expect(store.getStore().translations["Slide 1"]["Title 1.p0"]["fr-CA"]).toBe("Bienvenue");
	});

	test("removeLocale removes language column", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());
		await store.addLocale("fr");

		const ok = await store.removeLocale("fr");
		expect(ok).toBe(true);
		expect(store.getStore().locales).toEqual(["en"]);
		expect(store.getStore().translations["Slide 1"]["Title 1.p0"]["fr"]).toBeUndefined();
	});

	test("removeLocale rejects removing source locale", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());

		const ok = await store.removeLocale("en");
		expect(ok).toBe(false);
		expect(store.getStore().locales).toEqual(["en"]);
	});

	test("createKey/deleteKey/renameKey return false (unsupported)", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());

		expect(await store.createKey({ namespace: "Slide 1", key: "new", values: {} })).toBe(false);
		expect(await store.deleteKey({ namespace: "Slide 1", key: "Title 1.p0" })).toBe(false);
		expect(await store.renameKey({ namespace: "Slide 1", oldKey: "Title 1.p0", newKey: "x" })).toBe(false);
	});

	test("createNamespace/deleteNamespace return false (unsupported)", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());

		expect(await store.createNamespace("Slide 99")).toBe(false);
		expect(await store.deleteNamespace("Slide 1")).toBe(false);
	});

	test("re-sync preserves existing translations for added locales", async () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());
		await store.addLocale("fr");

		await store.updateKey({
			namespace: "Slide 1",
			key: "Title 1.p0",
			locale: "fr",
			value: "Bienvenue",
		});

		// Simulate re-sync (user clicked "Sync" in the add-in)
		store.populateFromSync(makeSyncPayload());

		const result = store.getStore();
		expect(result.locales).toContain("fr");
		expect(result.translations["Slide 1"]["Title 1.p0"]["fr"]).toBe("Bienvenue");
		expect(result.translations["Slide 1"]["Title 1.p0"]["en"]).toBe("Welcome to Our Product");
	});

	test("getMeta stores shape formatting data", () => {
		const store = new PptxTranslationStore();
		store.populateFromSync(makeSyncPayload());

		const meta = store.getMeta();
		expect(meta.sourceLocale).toBe("en");
		expect(meta.shapes["Slide 1"]["Title 1"]).toBeDefined();
		expect(meta.shapes["Slide 1"]["Title 1"].paragraphs[0].runs[0].bold).toBe(true);
		expect(meta.shapes["Slide 1"]["Title 1"].paragraphs[0].runs[1].color).toBe("#0066CC");
	});
});
