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

/** Persistent app settings */
export interface RosettaSettings {
	defaultLocalesDir: string | null;
	visibleLocales: string[] | null;
	connectorPort: number;
	connectorEnabled: boolean;
	theme: "system" | "dark" | "light";
	saveMode: "auto" | "manual";
}

/** RPC schema for Electrobun communication */
export type RosettaRPC = {
	bun: {
		requests: {
			getStore: { params: Record<string, never>; response: TranslationStore };
			updateKey: { params: KeyUpdate; response: { ok: boolean } };
			createKey: { params: KeyCreate; response: { ok: boolean } };
			deleteKey: { params: KeyDelete; response: { ok: boolean } };
			renameKey: { params: KeyRename; response: { ok: boolean } };
			createNamespace: { params: NamespaceCreate; response: { ok: boolean } };
			deleteNamespace: { params: NamespaceDelete; response: { ok: boolean } };
			addLocale: { params: { locale: string; copyFrom?: string }; response: { ok: boolean } };
			removeLocale: { params: { locale: string }; response: { ok: boolean } };
			openLocalesDir: { params: Record<string, never>; response: { path: string | null } };
			getConnectorStatus: {
				params: Record<string, never>;
				response: { connected: boolean; port: number };
			};
			getSettings: { params: Record<string, never>; response: RosettaSettings };
			updateSettings: { params: Partial<RosettaSettings>; response: { ok: boolean } };
			toggleReview: { params: ReviewToggle; response: { ok: boolean } };
			getMissingKeys: { params: Record<string, never>; response: MissingKeysReport[] };
			getCoverageStats: { params: Record<string, never>; response: CoverageStats };
			installCli: {
				params: Record<string, never>;
				response: { success: boolean; message: string };
			};
		};
		messages: Record<string, never>;
	};
	webview: {
		requests: Record<string, never>;
		messages: {
			storeUpdated: TranslationStore;
			fileChanged: { namespace: string; locale: string };
			settingsUpdated: RosettaSettings;
			connectorStatusChanged: { connected: boolean; clientCount: number; apps: string[] };
			themeChanged: { theme: "system" | "light" | "dark" };
		};
	};
};
