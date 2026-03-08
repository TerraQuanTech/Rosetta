import { dirname, join, relative } from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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

export class TranslationFileStore {
	private localesDir: string;
	private store: TranslationStore = { locales: [], namespaces: [], translations: {} };

	/** Paths we just wrote to — skip the next chokidar event for these */
	private writeLocks = new Set<string>();

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
		const locales = await this.discoverLocales();
		const namespaceSet = new Set<string>();

		const translations: TranslationMap = {};

		for (const locale of locales) {
			const localeDir = join(this.localesDir, locale);
			const jsonFiles = await this.findJsonFiles(localeDir);

			for (const filePath of jsonFiles) {
				const relPath = relative(localeDir, filePath);
				const namespace = relPath.replace(/\.json$/, "").replace(/\\/g, "/");
				namespaceSet.add(namespace);

				try {
					const content = await readFile(filePath, "utf-8");
					const parsed = JSON.parse(content);
					const flat = flatten(parsed);

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

		const namespaces = this.buildNamespaceTree(Array.from(namespaceSet).sort());

		this.store = { locales, namespaces, translations };
		return this.store;
	}

	/** Reload a single file (called on file change) */
	async reloadFile(filePath: string): Promise<string | null> {
		const rel = relative(this.localesDir, filePath);
		const parts = rel.replace(/\\/g, "/").split("/");

		if (parts.length < 2) return null;

		const locale = parts[0];
		const namespace = parts
			.slice(1)
			.join("/")
			.replace(/\.json$/, "");

		if (!this.store.locales.includes(locale)) return null;

		try {
			const content = await readFile(filePath, "utf-8");
			const parsed = JSON.parse(content);
			const flat = flatten(parsed);

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

	/** Update a single translation value and write to disk */
	async updateKey(update: KeyUpdate): Promise<boolean> {
		const { namespace, key, locale, value } = update;

		if (!this.store.translations[namespace]) {
			this.store.translations[namespace] = {};
		}
		if (!this.store.translations[namespace][key]) {
			this.store.translations[namespace][key] = {};
		}
		this.store.translations[namespace][key][locale] = value;

		return this.writeNamespaceLocale(namespace, locale);
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

	/** Write the in-memory state for one namespace+locale back to its JSON file */
	private async writeNamespaceLocale(namespace: string, locale: string): Promise<boolean> {
		const filePath = join(this.localesDir, locale, `${namespace}.json`);

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

		const nested = unflatten(flat);

		try {
			// Ensure directory exists
			await mkdir(dirname(filePath), { recursive: true });

			this.writeLocks.add(filePath);
			await writeFile(filePath, JSON.stringify(nested, null, 4) + "\n", "utf-8");

			// Clear write lock after a short delay
			setTimeout(() => this.writeLocks.delete(filePath), 500);
			return true;
		} catch (err) {
			console.error(`Failed to write ${filePath}:`, err);
			this.writeLocks.delete(filePath);
			return false;
		}
	}

	/** Find all locale directories (en, ru, de, ...) */
	private async discoverLocales(): Promise<string[]> {
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
						parent = { name: parts[i], path: parentPath, children: [] };
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
