import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { applyEdits, modify } from "jsonc-parser";
import { flatten, unflatten } from "../shared/json";
import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceNode,
	TranslationMap,
	TranslationStore,
} from "../shared/types";

/** Detected formatting for a JSON file */
interface FileFormat {
	indent: string;
	trailingNewline: boolean;
}

/** Remove BOM (Byte Order Mark) from content if present */
function stripBOM(content: string): string {
	return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/** Detect indent style from raw JSON content */
function detectFormat(content: string): FileFormat {
	const trailingNewline = content.endsWith("\n");

	// Find first indented line to detect indent style
	const lines = content.split("\n");
	for (const line of lines) {
		const match = line.match(/^(\s+)\S/);
		if (match) {
			const whitespace = match[1];
			// If it starts with tab, use tab indent
			if (whitespace[0] === "\t") {
				return { indent: "\t", trailingNewline };
			}
			// Otherwise use the detected space indent
			return { indent: whitespace, trailingNewline };
		}
	}

	// Default: 4 spaces
	return { indent: "    ", trailingNewline: true };
}

export class TranslationFileStore {
	private localesDir: string;
	private store: TranslationStore = {
		locales: [],
		namespaces: [],
		translations: {},
		reviews: {},
	};

	/** Paths we just wrote to — skip the next chokidar event for these */
	private writeLocks = new Set<string>();

	/** Remembered formatting per file path */
	private fileFormats = new Map<string, FileFormat>();

	/** Remembered key order per file path (flat dot-notation keys in original order) */
	private keyOrders = new Map<string, string[]>();

	constructor(localesDir: string) {
		this.localesDir = localesDir;
	}

	getStore(): TranslationStore {
		return this.store;
	}

	isWriteLocked(path: string): boolean {
		return this.writeLocks.has(path);
	}

	clearWriteLock(path: string): void {
		this.writeLocks.delete(path);
	}

	/** Scan the locales directory and load everything into memory */
	async load(): Promise<TranslationStore> {
		const entries = await readdir(this.localesDir, { withFileTypes: true });
		const nestedDirs = entries
			.filter((e) => e.isDirectory() && !e.name.startsWith("."))
			.map((e) => e.name);
		const rootJsonFiles = entries
			.filter((e) => e.isFile() && e.name.endsWith(".json"))
			.map((e) => e.name);

		let locales: string[] = [];
		const namespaceSet = new Set<string>();
		const translations: TranslationMap = {};

		// Detect layout: nested (locales/en/common.json) or flat (locales/en.json)
		if (rootJsonFiles.length > 0 && nestedDirs.length === 0) {
			// Flat layout: extract locale codes from filenames
			locales = rootJsonFiles.map((f) => f.replace(/\.json$/, "")).sort();

			for (const fileName of rootJsonFiles) {
				const locale = fileName.replace(/\.json$/, "");
				const filePath = join(this.localesDir, fileName);
				const namespace = "root"; // Use 'root' as the namespace for flat layout
				namespaceSet.add(namespace);

				try {
					const content = stripBOM(await readFile(filePath, "utf-8"));
					this.fileFormats.set(filePath, detectFormat(content));
					const parsed = JSON.parse(content);
					const flat = flatten(parsed);
					this.keyOrders.set(filePath, Object.keys(flat));

					if (!translations[namespace]) {
						translations[namespace] = {};
					}

					for (const [key, value] of Object.entries(flat)) {
						if (!translations[namespace][key]) {
							translations[namespace][key] = {};
						}
						translations[namespace][key][locale] = value;
					}
				} catch (err) {
					console.error(`Failed to parse ${filePath}:`, err);
				}
			}
		} else {
			// Nested layout: locale folders with namespace files inside
			locales = nestedDirs;

			for (const locale of locales) {
				const localeDir = join(this.localesDir, locale);
				const jsonFiles = await this.findJsonFiles(localeDir);

				for (const filePath of jsonFiles) {
					const relPath = relative(localeDir, filePath);
					const namespace = relPath.replace(/\.json$/, "").replace(/\\/g, "/");
					namespaceSet.add(namespace);

					try {
						const content = stripBOM(await readFile(filePath, "utf-8"));
						this.fileFormats.set(filePath, detectFormat(content));
						const parsed = JSON.parse(content);
						const flat = flatten(parsed);
						this.keyOrders.set(filePath, Object.keys(flat));

						if (!translations[namespace]) {
							translations[namespace] = {};
						}

						for (const [key, value] of Object.entries(flat)) {
							if (!translations[namespace][key]) {
								translations[namespace][key] = {};
							}
							translations[namespace][key][locale] = value;
						}
					} catch (err) {
						console.error(`Failed to parse ${filePath}:`, err);
					}
				}
			}
		}

		const namespaces = this.buildNamespaceTree(Array.from(namespaceSet).sort());

		this.store = { locales, namespaces, translations, reviews: {} };
		return this.store;
	}

	/** Reload a single file (called on file change) */
	async reloadFile(filePath: string): Promise<string | null> {
		const rel = relative(this.localesDir, filePath);
		const parts = rel.replace(/\\/g, "/").split("/");

		let locale: string;
		let namespace: string;

		// Detect flat vs nested layout
		if (parts.length === 1) {
			// Flat layout: locales/en.json
			locale = parts[0].replace(/\.json$/, "");
			namespace = "root";
		} else {
			// Nested layout: locales/en/common.json
			if (parts.length < 2) return null;
			locale = parts[0];
			namespace = parts
				.slice(1)
				.join("/")
				.replace(/\.json$/, "");
		}

		if (!this.store.locales.includes(locale)) return null;

		try {
			const content = stripBOM(await readFile(filePath, "utf-8"));

			// Update remembered formatting
			this.fileFormats.set(filePath, detectFormat(content));

			const parsed = JSON.parse(content);
			const flat = flatten(parsed);

			// Update remembered key order
			this.keyOrders.set(filePath, Object.keys(flat));

			// Clear existing entries for this namespace+locale
			if (this.store.translations[namespace]) {
				for (const key of Object.keys(this.store.translations[namespace])) {
					delete this.store.translations[namespace][key][locale];
				}
			} else {
				this.store.translations[namespace] = {};
			}

			// Re-populate
			for (const [key, value] of Object.entries(flat)) {
				if (!this.store.translations[namespace][key]) {
					this.store.translations[namespace][key] = {};
				}
				this.store.translations[namespace][key][locale] = value;
			}

			// Clean up keys that no longer have any locale
			for (const key of Object.keys(this.store.translations[namespace])) {
				if (Object.keys(this.store.translations[namespace][key]).length === 0) {
					delete this.store.translations[namespace][key];
				}
			}

			return namespace;
		} catch {
			return null;
		}
	}

	/** Update a single translation value and write to disk (preserving file formatting) */
	async updateKey(update: KeyUpdate): Promise<boolean> {
		const { namespace, key, locale, value } = update;

		// Update in-memory store
		if (!this.store.translations[namespace]) {
			this.store.translations[namespace] = {};
		}
		if (!this.store.translations[namespace][key]) {
			this.store.translations[namespace][key] = {};
		}

		if (value === "") {
			delete this.store.translations[namespace][key][locale];
		} else {
			this.store.translations[namespace][key][locale] = value;
		}

		// Surgically update the JSON file instead of rebuilding it
		return this.patchJsonFile(namespace, locale, key, value);
	}

	/**
	 * Read the existing JSON file, apply a single key change using jsonc-parser,
	 * which preserves all formatting/whitespace for unaffected parts of the file.
	 */
	private async patchJsonFile(
		namespace: string,
		locale: string,
		dotKey: string,
		value: string,
	): Promise<boolean> {
		// Handle flat layout (namespace="root") vs nested layout
		const filePath =
			namespace === "root"
				? join(this.localesDir, `${locale}.json`)
				: join(this.localesDir, locale, `${namespace}.json`);
		const format = this.fileFormats.get(filePath) ?? {
			indent: "    ",
			trailingNewline: true,
		};
		const jsonPath = dotKey.split(".");

		try {
			let content: string;
			try {
				content = stripBOM(await readFile(filePath, "utf-8"));
			} catch {
				// File doesn't exist — create with just this key
				content = "{}";
			}

			const edits = modify(
				content,
				jsonPath,
				value === "" ? undefined : value, // undefined = remove
				{
					formattingOptions: {
						tabSize: format.indent === "\t" ? 1 : format.indent.length,
						insertSpaces: format.indent !== "\t",
					},
				},
			);
			let output = applyEdits(content, edits);

			// Preserve trailing newline preference
			if (format.trailingNewline && !output.endsWith("\n")) output += "\n";
			if (!format.trailingNewline && output.endsWith("\n")) output = output.replace(/\n$/, "");

			await mkdir(dirname(filePath), { recursive: true });
			this.writeLocks.add(filePath);
			await writeFile(filePath, output, "utf-8");
			setTimeout(() => this.writeLocks.delete(filePath), 500);
			return true;
		} catch (err) {
			console.error(`Failed to patch ${filePath}:`, err);
			return false;
		}
	}

	/** Create a new key across all specified locales */
	async createKey(create: KeyCreate): Promise<boolean> {
		const { namespace, key, values } = create;

		if (!this.store.translations[namespace]) {
			this.store.translations[namespace] = {};
		}
		this.store.translations[namespace][key] = { ...values };

		let ok = true;
		for (const locale of Object.keys(values)) {
			if (!(await this.writeNamespaceLocale(namespace, locale))) {
				ok = false;
			}
		}
		return ok;
	}

	/** Delete a key from all locales */
	async deleteKey(del: KeyDelete): Promise<boolean> {
		const { namespace, key } = del;

		if (!this.store.translations[namespace]?.[key]) return false;

		const locales = Object.keys(this.store.translations[namespace][key]);
		delete this.store.translations[namespace][key];

		let ok = true;
		for (const locale of locales) {
			if (!(await this.writeNamespaceLocale(namespace, locale))) {
				ok = false;
			}
		}
		return ok;
	}

	/** Rename a key across all locales */
	async renameKey(rename: KeyRename): Promise<boolean> {
		const { namespace, oldKey, newKey } = rename;

		if (!this.store.translations[namespace]?.[oldKey]) return false;

		this.store.translations[namespace][newKey] = this.store.translations[namespace][oldKey];
		delete this.store.translations[namespace][oldKey];

		let ok = true;
		for (const locale of this.store.locales) {
			if (this.store.translations[namespace][newKey][locale] !== undefined) {
				if (!(await this.writeNamespaceLocale(namespace, locale))) {
					ok = false;
				}
			}
		}
		return ok;
	}

	/** Create a new empty namespace (creates empty JSON files for all locales) */
	async createNamespace(namespace: string): Promise<boolean> {
		if (this.store.translations[namespace]) return false; // already exists

		this.store.translations[namespace] = {};

		let ok = true;
		for (const locale of this.store.locales) {
			if (!(await this.writeNamespaceLocale(namespace, locale))) {
				ok = false;
			}
		}

		// Rebuild namespace tree
		const nsPaths = Object.keys(this.store.translations).sort();
		this.store.namespaces = this.buildNamespaceTree(nsPaths);

		return ok;
	}

	/** Delete a namespace (removes JSON files for all locales) */
	async deleteNamespace(namespace: string): Promise<boolean> {
		if (!this.store.translations[namespace]) return false;

		delete this.store.translations[namespace];

		const ok = true;
		for (const locale of this.store.locales) {
			const filePath =
				namespace === "root"
					? join(this.localesDir, `${locale}.json`)
					: join(this.localesDir, locale, `${namespace}.json`);
			try {
				await rm(filePath);
			} catch {
				// File may not exist for all locales
			}
		}

		// Rebuild namespace tree
		const nsPaths = Object.keys(this.store.translations).sort();
		this.store.namespaces = this.buildNamespaceTree(nsPaths);

		return ok;
	}

	/** Write the in-memory state for one namespace+locale back to its JSON file */
	private async writeNamespaceLocale(namespace: string, locale: string): Promise<boolean> {
		const filePath =
			namespace === "root"
				? join(this.localesDir, `${locale}.json`)
				: join(this.localesDir, locale, `${namespace}.json`);

		// Collect all keys for this namespace+locale
		const flat: Record<string, string> = {};
		const nsData = this.store.translations[namespace];
		if (nsData) {
			for (const [key, localeMap] of Object.entries(nsData)) {
				if (localeMap[locale] !== undefined) {
					flat[key] = localeMap[locale];
				}
			}
		}

		const nested = unflatten(flat, this.keyOrders.get(filePath));

		// Update remembered key order (preserves original + appends new keys)
		this.keyOrders.set(filePath, Object.keys(flat));

		// Use the remembered formatting, or default to 4 spaces
		const format = this.fileFormats.get(filePath) ?? {
			indent: "    ",
			trailingNewline: true,
		};
		let output = JSON.stringify(nested, null, format.indent);
		if (format.trailingNewline) {
			output += "\n";
		}

		try {
			// Ensure directory exists
			await mkdir(dirname(filePath), { recursive: true });

			this.writeLocks.add(filePath);
			await writeFile(filePath, output, "utf-8");

			// Clear write lock after a short delay
			setTimeout(() => this.writeLocks.delete(filePath), 500);
			return true;
		} catch (err) {
			console.error(`Failed to write ${filePath}:`, err);
			this.writeLocks.delete(filePath);
			return false;
		}
	}

	/** Add a new locale — creates the directory and empty JSON files for each namespace */
	async addLocale(locale: string, copyFrom?: string): Promise<boolean> {
		if (this.store.locales.includes(locale)) return false;

		try {
			// For flat layout (root namespace), just create the locale.json file
			if (Object.keys(this.store.translations).includes("root")) {
				const filePath = join(this.localesDir, `${locale}.json`);
				if (copyFrom && this.store.locales.includes(copyFrom)) {
					const sourcePath = join(this.localesDir, `${copyFrom}.json`);
					try {
						const content = await readFile(sourcePath, "utf-8");
						await writeFile(filePath, content, "utf-8");
					} catch {
						await writeFile(filePath, "{}\n", "utf-8");
					}
				} else {
					await writeFile(filePath, "{}\n", "utf-8");
				}
			} else {
				// For nested layout, create locale directory and namespace files
				const localeDir = join(this.localesDir, locale);
				await mkdir(localeDir, { recursive: true });

				for (const namespace of Object.keys(this.store.translations)) {
					const filePath = join(localeDir, `${namespace}.json`);
					await mkdir(dirname(filePath), { recursive: true });
					if (copyFrom && this.store.locales.includes(copyFrom)) {
						const sourcePath = join(this.localesDir, copyFrom, `${namespace}.json`);
						try {
							const content = await readFile(sourcePath, "utf-8");
							await writeFile(filePath, content, "utf-8");
						} catch {
							await writeFile(filePath, "{}\n", "utf-8");
						}
					} else {
						await writeFile(filePath, "{}\n", "utf-8");
					}
				}
			}
		} catch {
			return false;
		}

		this.store.locales.push(locale);
		this.store.locales.sort();
		return true;
	}

	/** Remove a locale — deletes files/directories and purges from in-memory store */
	async removeLocale(locale: string): Promise<boolean> {
		if (!this.store.locales.includes(locale)) return false;
		if (this.store.locales.length <= 1) return false; // don't remove the last locale

		try {
			const isFlat = Object.keys(this.store.translations).includes("root");

			if (isFlat) {
				const filePath = join(this.localesDir, `${locale}.json`);
				await rm(filePath).catch(() => {});
			} else {
				const localeDir = join(this.localesDir, locale);
				await rm(localeDir, { recursive: true }).catch(() => {});
			}
		} catch {
			return false;
		}

		// Remove from in-memory store
		this.store.locales = this.store.locales.filter((l) => l !== locale);

		// Remove locale entries from all translations
		for (const ns of Object.keys(this.store.translations)) {
			for (const key of Object.keys(this.store.translations[ns])) {
				delete this.store.translations[ns][key][locale];
			}
		}

		return true;
	}

	/** Find all locale directories (en, ru, de, ...) */
	private async discoverLocales(): Promise<string[]> {
		if (!this.localesDir) return [];
		const entries = await readdir(this.localesDir, { withFileTypes: true });
		return entries
			.filter((e) => e.isDirectory() && !e.name.startsWith("."))
			.map((e) => e.name)
			.sort();
	}

	/** Recursively find all .json files in a directory */
	private async findJsonFiles(dir: string): Promise<string[]> {
		const results: string[] = [];

		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...(await this.findJsonFiles(fullPath)));
			} else if (entry.name.endsWith(".json")) {
				results.push(fullPath);
			}
		}

		return results;
	}

	/** Build a tree of namespace nodes from flat paths */
	private buildNamespaceTree(paths: string[]): NamespaceNode[] {
		const root: NamespaceNode[] = [];

		for (const path of paths) {
			const parts = path.split("/");

			if (parts.length === 1) {
				root.push({ name: parts[0], path });
			} else {
				// Find or create parent nodes
				let children = root;
				for (let i = 0; i < parts.length - 1; i++) {
					const parentPath = parts.slice(0, i + 1).join("/");
					let parent = children.find((n) => n.path === parentPath);
					if (!parent) {
						parent = {
							name: parts[i],
							path: parentPath,
							children: [],
						};
						children.push(parent);
					}
					if (!parent.children) parent.children = [];
					children = parent.children;
				}

				children.push({ name: parts[parts.length - 1], path });
			}
		}

		return root;
	}
}
