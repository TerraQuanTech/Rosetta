import { dirname, join, relative } from "node:path";
import { applyEdits, findNodeAtLocation, modify, parseTree } from "jsonc-parser";
import { type FileFormat, detectFormat, stripBOM } from "./file-format";
import type { FileSystemAdapter } from "./fs-adapter";
import { flatten, unflatten } from "./json";
import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceNode,
	TranslationMap,
	TranslationStore,
} from "./types";

export class TranslationFileStore {
	private localesDir: string;
	private fs: FileSystemAdapter;
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

	constructor(localesDir: string, fs: FileSystemAdapter) {
		this.localesDir = localesDir;
		this.fs = fs;
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

	async load(): Promise<TranslationStore> {
		const entries = await this.fs.readDir(this.localesDir);
		const nestedDirs = entries
			.filter((e) => e.isDirectory && !e.name.startsWith("."))
			.map((e) => e.name);
		const rootJsonFiles = entries
			.filter((e) => e.isFile && e.name.endsWith(".json"))
			.map((e) => e.name);

		let locales: string[] = [];
		const namespaceSet = new Set<string>();
		const translations: TranslationMap = {};

		if (rootJsonFiles.length > 0 && nestedDirs.length === 0) {
			locales = rootJsonFiles.map((f) => f.replace(/\.json$/, "")).sort();

			for (const fileName of rootJsonFiles) {
				const locale = fileName.replace(/\.json$/, "");
				const filePath = join(this.localesDir, fileName);
				const namespace = "root";
				namespaceSet.add(namespace);
				await this.parseAndStoreFile(filePath, namespace, locale, translations);
			}
		} else {
			locales = nestedDirs;

			for (const locale of locales) {
				const localeDir = join(this.localesDir, locale);
				const jsonFiles = await this.findJsonFiles(localeDir);

				for (const filePath of jsonFiles) {
					const relPath = relative(localeDir, filePath);
					const namespace = relPath.replace(/\.json$/, "").replace(/\\/g, "/");
					namespaceSet.add(namespace);
					await this.parseAndStoreFile(filePath, namespace, locale, translations);
				}
			}
		}

		const namespaces = this.buildNamespaceTree(Array.from(namespaceSet).sort());

		this.store = { locales, namespaces, translations, reviews: {} };
		return this.store;
	}

	private async parseAndStoreFile(
		filePath: string,
		namespace: string,
		locale: string,
		translations: TranslationMap,
	): Promise<void> {
		try {
			const content = stripBOM(await this.fs.readFile(filePath));
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

	async reloadFile(filePath: string): Promise<string | null> {
		const rel = relative(this.localesDir, filePath);
		const parts = rel.replace(/\\/g, "/").split("/");

		let locale: string;
		let namespace: string;

		if (parts.length === 1) {
			locale = parts[0].replace(/\.json$/, "");
			namespace = "root";
		} else {
			if (parts.length < 2) return null;
			locale = parts[0];
			namespace = parts
				.slice(1)
				.join("/")
				.replace(/\.json$/, "");
		}

		if (!this.store.locales.includes(locale)) return null;

		try {
			const content = stripBOM(await this.fs.readFile(filePath));

			this.fileFormats.set(filePath, detectFormat(content));

			const parsed = JSON.parse(content);
			const flat = flatten(parsed);

			this.keyOrders.set(filePath, Object.keys(flat));

			if (this.store.translations[namespace]) {
				for (const key of Object.keys(this.store.translations[namespace])) {
					delete this.store.translations[namespace][key][locale];
				}
			} else {
				this.store.translations[namespace] = {};
			}

			for (const [key, value] of Object.entries(flat)) {
				if (!this.store.translations[namespace][key]) {
					this.store.translations[namespace][key] = {};
				}
				this.store.translations[namespace][key][locale] = value;
			}

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

	async updateKey(update: KeyUpdate): Promise<boolean> {
		const { namespace, key, locale, value } = update;

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
				content = stripBOM(await this.fs.readFile(filePath));
			} catch {
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

			if (format.trailingNewline && !output.endsWith("\n")) output += "\n";
			if (!format.trailingNewline && output.endsWith("\n")) output = output.replace(/\n$/, "");

			await this.fs.mkdir(dirname(filePath));
			this.writeLocks.add(filePath);
			await this.fs.writeFile(filePath, output);
			setTimeout(() => this.writeLocks.delete(filePath), 500);
			return true;
		} catch (err) {
			console.error(`Failed to patch ${filePath}:`, err);
			return false;
		}
	}

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

	async renameKey(rename: KeyRename): Promise<boolean> {
		const { namespace, oldKey, newKey } = rename;

		if (!this.store.translations[namespace]?.[oldKey]) return false;

		const values = this.store.translations[namespace][oldKey];
		this.store.translations[namespace][newKey] = values;
		delete this.store.translations[namespace][oldKey];

		for (const locale of this.store.locales) {
			const filePath =
				namespace === "root"
					? join(this.localesDir, `${locale}.json`)
					: join(this.localesDir, locale, `${namespace}.json`);
			const order = this.keyOrders.get(filePath);
			if (order) {
				const idx = order.indexOf(oldKey);
				if (idx !== -1) {
					order[idx] = newKey;
				}
			}
		}

		let ok = true;
		for (const locale of this.store.locales) {
			if (values[locale] !== undefined) {
				if (!(await this.renameKeyInJsonFile(namespace, locale, oldKey, newKey))) {
					ok = false;
				}
			}
		}
		return ok;
	}

	/**
	 * Rename a dot-notation key in a JSON file, preserving formatting and key order.
	 *
	 * When only the leaf segment changes (e.g. "buttons.save" → "buttons.confirm"),
	 * we do an in-place property name replacement that preserves all whitespace.
	 * Otherwise we fall back to remove + add via jsonc-parser.
	 */
	private async renameKeyInJsonFile(
		namespace: string,
		locale: string,
		oldDotKey: string,
		newDotKey: string,
	): Promise<boolean> {
		const filePath =
			namespace === "root"
				? join(this.localesDir, `${locale}.json`)
				: join(this.localesDir, locale, `${namespace}.json`);

		try {
			let content = stripBOM(await this.fs.readFile(filePath));
			const format = this.fileFormats.get(filePath) ?? {
				indent: "    ",
				trailingNewline: true,
			};
			const fmtOpts = {
				formattingOptions: {
					tabSize: format.indent === "\t" ? 1 : format.indent.length,
					insertSpaces: format.indent !== "\t",
				},
			};

			const oldParts = oldDotKey.split(".");
			const newParts = newDotKey.split(".");

			const canInPlaceRename =
				oldParts.length === newParts.length &&
				oldParts.slice(0, -1).every((seg, i) => seg === newParts[i]);

			if (canInPlaceRename) {
				const tree = parseTree(content);
				const node = tree ? findNodeAtLocation(tree, oldParts) : undefined;
				if (node?.parent?.children?.[0]) {
					const keyNode = node.parent.children[0];
					const before = content.slice(0, keyNode.offset);
					const after = content.slice(keyNode.offset + keyNode.length);
					content = `${before}${JSON.stringify(newParts[newParts.length - 1])}${after}`;
				}
			} else {
				const tree = parseTree(content);
				const node = tree ? findNodeAtLocation(tree, oldParts) : undefined;
				const value = node
					? JSON.parse(content.slice(node.offset, node.offset + node.length))
					: undefined;

				const removeEdits = modify(content, oldParts, undefined, fmtOpts);
				content = applyEdits(content, removeEdits);

				const addEdits = modify(content, newParts, value, fmtOpts);
				content = applyEdits(content, addEdits);
			}

			if (format.trailingNewline && !content.endsWith("\n")) content += "\n";
			if (!format.trailingNewline && content.endsWith("\n")) content = content.replace(/\n$/, "");

			this.writeLocks.add(filePath);
			await this.fs.writeFile(filePath, content);
			setTimeout(() => this.writeLocks.delete(filePath), 500);
			return true;
		} catch (err) {
			console.error(`Failed to rename key in ${filePath}:`, err);
			return false;
		}
	}

	async createNamespace(namespace: string): Promise<boolean> {
		if (this.store.translations[namespace]) return false; // already exists

		this.store.translations[namespace] = {};

		let ok = true;
		for (const locale of this.store.locales) {
			if (!(await this.writeNamespaceLocale(namespace, locale))) {
				ok = false;
			}
		}

		const nsPaths = Object.keys(this.store.translations).sort();
		this.store.namespaces = this.buildNamespaceTree(nsPaths);

		return ok;
	}

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
				await this.fs.rm(filePath);
			} catch {}
		}

		const nsPaths = Object.keys(this.store.translations).sort();
		this.store.namespaces = this.buildNamespaceTree(nsPaths);

		return ok;
	}

	private async writeNamespaceLocale(namespace: string, locale: string): Promise<boolean> {
		const filePath =
			namespace === "root"
				? join(this.localesDir, `${locale}.json`)
				: join(this.localesDir, locale, `${namespace}.json`);

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

		this.keyOrders.set(filePath, Object.keys(flat));

		const format = this.fileFormats.get(filePath) ?? {
			indent: "    ",
			trailingNewline: true,
		};
		let output = JSON.stringify(nested, null, format.indent);
		if (format.trailingNewline) {
			output += "\n";
		}

		try {
			await this.fs.mkdir(dirname(filePath));

			this.writeLocks.add(filePath);
			await this.fs.writeFile(filePath, output);

			setTimeout(() => this.writeLocks.delete(filePath), 500);
			return true;
		} catch (err) {
			console.error(`Failed to write ${filePath}:`, err);
			this.writeLocks.delete(filePath);
			return false;
		}
	}

	async addLocale(locale: string, copyFrom?: string): Promise<boolean> {
		if (this.store.locales.includes(locale)) return false;

		try {
			if (Object.keys(this.store.translations).includes("root")) {
				const filePath = join(this.localesDir, `${locale}.json`);
				if (copyFrom && this.store.locales.includes(copyFrom)) {
					const sourcePath = join(this.localesDir, `${copyFrom}.json`);
					try {
						const content = await this.fs.readFile(sourcePath);
						await this.fs.writeFile(filePath, content);
					} catch {
						await this.fs.writeFile(filePath, "{}\n");
					}
				} else {
					await this.fs.writeFile(filePath, "{}\n");
				}
			} else {
				const localeDir = join(this.localesDir, locale);
				await this.fs.mkdir(localeDir);

				for (const namespace of Object.keys(this.store.translations)) {
					const filePath = join(localeDir, `${namespace}.json`);
					await this.fs.mkdir(dirname(filePath));
					if (copyFrom && this.store.locales.includes(copyFrom)) {
						const sourcePath = join(this.localesDir, copyFrom, `${namespace}.json`);
						try {
							const content = await this.fs.readFile(sourcePath);
							await this.fs.writeFile(filePath, content);
						} catch {
							await this.fs.writeFile(filePath, "{}\n");
						}
					} else {
						await this.fs.writeFile(filePath, "{}\n");
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

	async removeLocale(locale: string): Promise<boolean> {
		if (!this.store.locales.includes(locale)) return false;
		if (this.store.locales.length <= 1) return false; // don't remove the last locale

		try {
			const isFlat = Object.keys(this.store.translations).includes("root");

			if (isFlat) {
				const filePath = join(this.localesDir, `${locale}.json`);
				try {
					await this.fs.rm(filePath);
				} catch {}
			} else {
				const localeDir = join(this.localesDir, locale);
				try {
					await this.fs.rm(localeDir, { recursive: true });
				} catch {}
			}
		} catch {
			return false;
		}

		this.store.locales = this.store.locales.filter((l) => l !== locale);

		for (const ns of Object.keys(this.store.translations)) {
			for (const key of Object.keys(this.store.translations[ns])) {
				delete this.store.translations[ns][key][locale];
			}
		}

		return true;
	}

	private async findJsonFiles(dir: string): Promise<string[]> {
		const results: string[] = [];

		const entries = await this.fs.readDir(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory) {
				results.push(...(await this.findJsonFiles(fullPath)));
			} else if (entry.name.endsWith(".json")) {
				results.push(fullPath);
			}
		}

		return results;
	}

	private buildNamespaceTree(paths: string[]): NamespaceNode[] {
		const root: NamespaceNode[] = [];

		for (const path of paths) {
			const parts = path.split("/");

			if (parts.length === 1) {
				root.push({ name: parts[0], path });
			} else {
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
