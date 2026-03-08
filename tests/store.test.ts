import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { TranslationFileStore } from "../src/bun/store";

let tempDir: string;
let store: TranslationFileStore;

async function createLocaleFile(
	locale: string,
	namespace: string,
	content: Record<string, unknown>,
) {
	const dir = join(tempDir, locale, ...namespace.split("/").slice(0, -1));
	const fileName = namespace.split("/").pop()!;
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, `${fileName}.json`), JSON.stringify(content, null, 4) + "\n");
}

async function readLocaleFile(locale: string, namespace: string): Promise<Record<string, unknown>> {
	const filePath = join(tempDir, locale, `${namespace}.json`);
	const content = await readFile(filePath, "utf-8");
	return JSON.parse(content);
}

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "rosetta-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("TranslationFileStore", () => {
	describe("load", () => {
		test("discovers locales and loads flat JSON files", async () => {
			await createLocaleFile("en", "common", {
				title: "Hello",
				buttons: { save: "Save", cancel: "Cancel" },
			});
			await createLocaleFile("ru", "common", {
				title: "Привет",
				buttons: { save: "Сохранить", cancel: "Отмена" },
			});

			store = new TranslationFileStore(tempDir);
			const result = await store.load();

			expect(result.locales).toEqual(["en", "ru"]);
			expect(result.translations.common).toBeDefined();
			expect(result.translations.common.title).toEqual({
				en: "Hello",
				ru: "Привет",
			});
			expect(result.translations.common["buttons.save"]).toEqual({
				en: "Save",
				ru: "Сохранить",
			});
		});

		test("handles nested namespace directories", async () => {
			await createLocaleFile("en", "components/plot", {
				real: "Re",
				imag: "Im",
			});
			await createLocaleFile("en", "pages/home", {
				title: "Home",
			});

			store = new TranslationFileStore(tempDir);
			const result = await store.load();

			expect(result.translations["components/plot"]).toBeDefined();
			expect(result.translations["components/plot"].real.en).toBe("Re");
			expect(result.translations["pages/home"].title.en).toBe("Home");
		});

		test("builds correct namespace tree", async () => {
			await createLocaleFile("en", "common", { a: "1" });
			await createLocaleFile("en", "components/plot", { b: "2" });
			await createLocaleFile("en", "components/buttons", { c: "3" });
			await createLocaleFile("en", "pages/home", { d: "4" });

			store = new TranslationFileStore(tempDir);
			const result = await store.load();

			const rootNames = result.namespaces.map((n) => n.name);
			expect(rootNames).toContain("common");
			expect(rootNames).toContain("components");
			expect(rootNames).toContain("pages");

			const components = result.namespaces.find((n) => n.name === "components");
			expect(components?.children?.map((c) => c.name)).toContain("plot");
			expect(components?.children?.map((c) => c.name)).toContain("buttons");
		});

		test("handles missing translations across locales", async () => {
			await createLocaleFile("en", "common", { a: "English A", b: "English B" });
			await createLocaleFile("ru", "common", { a: "Russian A" });

			store = new TranslationFileStore(tempDir);
			const result = await store.load();

			expect(result.translations.common.a).toEqual({ en: "English A", ru: "Russian A" });
			expect(result.translations.common.b).toEqual({ en: "English B" });
			expect(result.translations.common.b.ru).toBeUndefined();
		});

		test("handles empty directory", async () => {
			store = new TranslationFileStore(tempDir);
			const result = await store.load();

			expect(result.locales).toEqual([]);
			expect(result.namespaces).toEqual([]);
			expect(result.translations).toEqual({});
		});
	});

	describe("updateKey", () => {
		test("updates a value and writes to disk", async () => {
			await createLocaleFile("en", "common", { title: "Old" });

			store = new TranslationFileStore(tempDir);
			await store.load();

			const ok = await store.updateKey({
				namespace: "common",
				key: "title",
				locale: "en",
				value: "New",
			});

			expect(ok).toBe(true);
			expect(store.getStore().translations.common.title.en).toBe("New");

			// Verify disk
			const onDisk = await readLocaleFile("en", "common");
			expect(onDisk.title).toBe("New");
		});

		test("adds a missing locale for an existing key", async () => {
			await createLocaleFile("en", "common", { title: "Hello" });
			await mkdir(join(tempDir, "ru"), { recursive: true });
			await createLocaleFile("ru", "common", {});

			store = new TranslationFileStore(tempDir);
			await store.load();

			const ok = await store.updateKey({
				namespace: "common",
				key: "title",
				locale: "ru",
				value: "Привет",
			});

			expect(ok).toBe(true);
			expect(store.getStore().translations.common.title.ru).toBe("Привет");
		});

		test("preserves nested structure when writing", async () => {
			await createLocaleFile("en", "common", {
				buttons: { save: "Save", cancel: "Cancel" },
				title: "App",
			});

			store = new TranslationFileStore(tempDir);
			await store.load();

			await store.updateKey({
				namespace: "common",
				key: "buttons.save",
				locale: "en",
				value: "Save Changes",
			});

			const onDisk = await readLocaleFile("en", "common");
			expect((onDisk.buttons as any).save).toBe("Save Changes");
			expect((onDisk.buttons as any).cancel).toBe("Cancel");
			expect(onDisk.title).toBe("App");
		});
	});

	describe("createKey", () => {
		test("creates a new key across locales", async () => {
			await createLocaleFile("en", "common", { title: "App" });
			await createLocaleFile("ru", "common", { title: "Приложение" });

			store = new TranslationFileStore(tempDir);
			await store.load();

			const ok = await store.createKey({
				namespace: "common",
				key: "subtitle",
				values: { en: "Welcome", ru: "Добро пожаловать" },
			});

			expect(ok).toBe(true);
			expect(store.getStore().translations.common.subtitle).toEqual({
				en: "Welcome",
				ru: "Добро пожаловать",
			});
		});
	});

	describe("deleteKey", () => {
		test("removes a key from all locales", async () => {
			await createLocaleFile("en", "common", { a: "1", b: "2" });
			await createLocaleFile("ru", "common", { a: "1", b: "2" });

			store = new TranslationFileStore(tempDir);
			await store.load();

			const ok = await store.deleteKey({ namespace: "common", key: "a" });

			expect(ok).toBe(true);
			expect(store.getStore().translations.common.a).toBeUndefined();
			expect(store.getStore().translations.common.b).toBeDefined();

			// Verify disk
			const enDisk = await readLocaleFile("en", "common");
			expect(enDisk.a).toBeUndefined();
			expect(enDisk.b).toBe("2");
		});
	});

	describe("renameKey", () => {
		test("renames a key across all locales", async () => {
			await createLocaleFile("en", "common", { old_name: "Value" });
			await createLocaleFile("ru", "common", { old_name: "Значение" });

			store = new TranslationFileStore(tempDir);
			await store.load();

			const ok = await store.renameKey({
				namespace: "common",
				oldKey: "old_name",
				newKey: "new_name",
			});

			expect(ok).toBe(true);
			expect(store.getStore().translations.common.old_name).toBeUndefined();
			expect(store.getStore().translations.common.new_name).toEqual({
				en: "Value",
				ru: "Значение",
			});
		});
	});
});
