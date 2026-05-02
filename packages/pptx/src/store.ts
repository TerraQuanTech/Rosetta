import type {
	FileSystemAdapter,
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceNode,
	PptxShapeData,
	PptxSyncPayload,
	TranslationMap,
	TranslationStore,
	TranslationStoreProvider,
} from "@terraquantech/rosetta-core";

export interface PptxMeta {
	sourceLocale: string;
	sourceFile?: string;
	/** Shape metadata per slide for formatting preservation */
	shapes: Record<string, Record<string, PptxShapeData>>;
}

export class PptxTranslationStore implements TranslationStoreProvider {
	private store: TranslationStore = {
		locales: [],
		namespaces: [],
		translations: {},
		reviews: {},
		mode: "pptx",
	};

	private meta: PptxMeta = {
		sourceLocale: "en",
		shapes: {},
	};

	private sidecarDir: string | null = null;
	private fs: FileSystemAdapter | null = null;

	constructor(fs?: FileSystemAdapter, sidecarDir?: string) {
		this.fs = fs ?? null;
		this.sidecarDir = sidecarDir ?? null;
	}

	getStore(): TranslationStore {
		return this.store;
	}

	getMeta(): PptxMeta {
		return this.meta;
	}

	async load(): Promise<TranslationStore> {
		if (!this.sidecarDir || !this.fs) return this.store;

		try {
			const translationsPath = `${this.sidecarDir}/translations.json`;
			const metaPath = `${this.sidecarDir}/meta.json`;

			const [translationsRaw, metaRaw] = await Promise.all([
				this.fs.readFile(translationsPath).catch(() => null),
				this.fs.readFile(metaPath).catch(() => null),
			]);

			if (metaRaw) {
				this.meta = JSON.parse(metaRaw);
			}

			if (translationsRaw) {
				const saved = JSON.parse(translationsRaw) as {
					locales: string[];
					translations: TranslationMap;
				};
				this.store.locales = saved.locales;
				this.store.translations = saved.translations;
				this.store.namespaces = this.buildNamespaces(Object.keys(saved.translations));
			}
		} catch {
			// sidecar doesn't exist yet
		}

		return this.store;
	}

	populateFromSync(payload: PptxSyncPayload): TranslationStore {
		const { sourceLocale, slides, savedTranslations, savedLocales } = payload;
		this.meta.sourceLocale = sourceLocale;

		const translations: TranslationMap = {};
		const namespaceNames: string[] = [];

		for (const slide of slides) {
			const ns = slide.name;
			namespaceNames.push(ns);
			translations[ns] = {};

			this.meta.shapes[ns] = {};

			for (const shape of slide.shapes) {
				this.meta.shapes[ns][shape.name] = shape;

				for (let pi = 0; pi < shape.paragraphs.length; pi++) {
					const para = shape.paragraphs[pi];
					const key = `${shape.name}.p${pi}`;

					if (!translations[ns][key]) {
						translations[ns][key] = {};
					}

					// Start with saved translations from the .pptx file
					const saved = savedTranslations?.[ns]?.[key] ?? {};
					const existing = this.store.translations[ns]?.[key] ?? {};
					translations[ns][key] = {
						...saved,
						...existing,
						[sourceLocale]: para.text,
					};
				}
			}
		}

		// Merge locales: saved (from .pptx) + existing (from current session) + source
		const savedLocaleSet = new Set(savedLocales ?? []);
		const existingLocales = this.store.locales.filter((l) => l !== sourceLocale);
		for (const l of existingLocales) savedLocaleSet.add(l);
		savedLocaleSet.delete(sourceLocale);
		const locales = [sourceLocale, ...savedLocaleSet];

		// Fill in missing target locale entries
		for (const ns of namespaceNames) {
			for (const key of Object.keys(translations[ns])) {
				for (const locale of locales) {
					if (locale === sourceLocale) continue;
					if (translations[ns][key][locale] === undefined) {
						translations[ns][key][locale] = "";
					}
				}
			}
		}

		this.store = {
			locales,
			namespaces: this.buildNamespaces(namespaceNames),
			translations,
			reviews: this.store.reviews,
			mode: "pptx",
			sourceFile: this.meta.sourceFile,
		};

		this.persist();
		return this.store;
	}

	async updateKey(update: KeyUpdate): Promise<boolean> {
		const ns = this.store.translations[update.namespace];
		if (!ns) return false;

		if (!ns[update.key]) {
			ns[update.key] = {};
		}
		ns[update.key][update.locale] = update.value;

		await this.persist();
		return true;
	}

	async createKey(_create: KeyCreate): Promise<boolean> {
		return false;
	}

	async deleteKey(_del: KeyDelete): Promise<boolean> {
		return false;
	}

	async renameKey(_rename: KeyRename): Promise<boolean> {
		return false;
	}

	async addLocale(locale: string, copyFrom?: string): Promise<boolean> {
		if (this.store.locales.includes(locale)) return false;

		this.store.locales.push(locale);
		const source = copyFrom ?? this.meta.sourceLocale;

		for (const ns of Object.keys(this.store.translations)) {
			for (const key of Object.keys(this.store.translations[ns])) {
				this.store.translations[ns][key][locale] = this.store.translations[ns][key][source] ?? "";
			}
		}

		await this.persist();
		return true;
	}

	async removeLocale(locale: string): Promise<boolean> {
		if (locale === this.meta.sourceLocale) return false;

		const idx = this.store.locales.indexOf(locale);
		if (idx === -1) return false;

		this.store.locales.splice(idx, 1);

		for (const ns of Object.keys(this.store.translations)) {
			for (const key of Object.keys(this.store.translations[ns])) {
				delete this.store.translations[ns][key][locale];
			}
		}

		await this.persist();
		return true;
	}

	async createNamespace(_ns: string): Promise<boolean> {
		return false;
	}

	async deleteNamespace(_ns: string): Promise<boolean> {
		return false;
	}

	private buildNamespaces(names: string[]): NamespaceNode[] {
		return names.map((name) => ({
			name,
			path: name,
		}));
	}

	private async persist(): Promise<void> {
		if (!this.sidecarDir || !this.fs) return;

		try {
			await this.fs.mkdir(this.sidecarDir);
		} catch {
			// already exists
		}

		const translationsData = JSON.stringify(
			{
				locales: this.store.locales,
				translations: this.store.translations,
			},
			null,
			"\t",
		);

		const metaData = JSON.stringify(this.meta, null, "\t");

		await Promise.all([
			this.fs.writeFile(`${this.sidecarDir}/translations.json`, translationsData),
			this.fs.writeFile(`${this.sidecarDir}/meta.json`, metaData),
		]);
	}
}
