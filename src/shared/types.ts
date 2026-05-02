// Re-export all data types from core (no duplication)
export type {
	CoverageStats,
	FilterType,
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	LocaleReviews,
	LocaleValues,
	MissingKeysReport,
	NamespaceCreate,
	NamespaceDelete,
	NamespaceNode,
	PptxSlideData,
	PptxSyncPayload,
	ReviewMap,
	ReviewToggle,
	RosettaSettings,
	SaveMode,
	SearchScope,
	Theme,
	TranslationMap,
	TranslationStore,
	TranslationStoreProvider,
} from "@terraquantech/rosetta-core";

import type {
	CoverageStats,
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	MissingKeysReport,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
	RosettaSettings,
	Theme,
	TranslationStore,
} from "@terraquantech/rosetta-core";

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
			windowReady: { params: Record<string, never>; response: { ok: boolean } };
			setWindowTitle: { params: { title: string }; response: { ok: boolean } };
			installCli: {
				params: Record<string, never>;
				response: { success: boolean; message: string };
			};
			installPptxAddin: {
				params: Record<string, never>;
				response: { success: boolean; message: string };
			};
			openPptxFile: {
				params: Record<string, never>;
				response: { path: string | null };
			};
			exportPptx: {
				params: { locales: string[]; outputDir: string };
				response: { ok: boolean; files: string[] };
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
			connectorFocusKey: { namespace: string; key: string };
			themeChanged: { theme: Theme };
			forceRelayout: Record<string, never>;
		};
	};
};

/** Bun-side RPC request definitions */
export type BunRequests = RosettaRPC["bun"]["requests"];

/** Typed RPC call function matching the bun request schema */
export type RpcRequestFn = <M extends keyof BunRequests>(
	method: M,
	params: BunRequests[M]["params"],
) => Promise<BunRequests[M]["response"]>;
