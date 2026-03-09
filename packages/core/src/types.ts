/** A namespace represents a single JSON file (e.g. "common", "pages/home", "components/plot") */
export interface NamespaceNode {
	/** Display name (e.g. "plot") */
	name: string;
	/** Full path relative to locale root, without extension (e.g. "components/plot") */
	path: string;
	/** Child namespaces (subdirectories) */
	children?: NamespaceNode[];
}

/**
 * The complete translation store.
 *
 * `translations` is indexed as:
 *   namespace path -> flat dot-key -> locale -> value
 *
 * Example:
 *   { "components/plot": { "measure.title": { "en": "Measure", "ru": "Измерения" } } }
 */
export interface TranslationStore {
	locales: string[];
	namespaces: NamespaceNode[];
	translations: TranslationMap;
	reviews: ReviewMap;
	/** The filesystem path to the locales directory */
	localesDir?: string;
}

/** namespace -> flatKey -> locale -> value */
export type TranslationMap = Record<string, Record<string, Record<string, string>>>;

/** A single key update */
export interface KeyUpdate {
	namespace: string;
	key: string;
	locale: string;
	value: string;
}

/** Missing keys for a specific locale and namespace */
export interface MissingKeysReport {
	namespace: string;
	locale: string;
	missingKeys: string[];
}

/** Translation coverage statistics */
export interface CoverageStats {
	[locale: string]: {
		translated: number;
		total: number;
		percentage: number;
	};
}

/** Request to create a new key */
export interface KeyCreate {
	namespace: string;
	key: string;
	values: Record<string, string>;
}

/** Request to delete a key */
export interface KeyDelete {
	namespace: string;
	key: string;
}

/** Request to rename a key */
export interface KeyRename {
	namespace: string;
	oldKey: string;
	newKey: string;
}

/** Request to create a new namespace */
export interface NamespaceCreate {
	namespace: string;
}

/** Request to delete a namespace */
export interface NamespaceDelete {
	namespace: string;
}

/** Review status map: namespace -> key -> locale -> reviewed */
export type ReviewMap = Record<string, Record<string, Record<string, boolean>>>;

/** Toggle review status for a single translation */
export interface ReviewToggle {
	namespace: string;
	key: string;
	locale: string;
	reviewed: boolean;
}

/** Translation filter mode */
export type FilterType = "all" | "missing" | "empty" | "unreviewed";

/** Save mode for the editor */
export type SaveMode = "auto" | "manual";

/** Search scope */
export type SearchScope = "current" | "all";

/** Theme preference */
export type Theme = "system" | "dark" | "light";

/** locale -> value */
export type LocaleValues = Record<string, string>;

/** locale -> reviewed */
export type LocaleReviews = Record<string, boolean>;

/** Persistent app settings */
export interface RosettaSettings {
	defaultLocalesDir: string | null;
	visibleLocales: string[] | null;
	connectorPort: number;
	connectorEnabled: boolean;
	theme: Theme;
	saveMode: SaveMode;
}
