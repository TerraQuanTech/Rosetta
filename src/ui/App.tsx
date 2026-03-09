import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyCreate, ReviewToggle, RosettaSettings } from "../shared/types";
import { AddKeyDialog } from "./components/AddKeyDialog";
import { EditorTable } from "./components/EditorTable";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { useConnectorStatus } from "./hooks/useConnectorStatus";
import { useSettings } from "./hooks/useSettings";
import { useTranslationStore } from "./hooks/useStore";

type ViewMode = "editor" | "settings";

export default function App() {
	const {
		store,
		loading,
		updateKey,
		createKey,
		createNamespace,
		deleteNamespace,
		addLocale,
		removeLocale,
		toggleReview,
		openFolder,
		pendingChanges,
		saveAll,
		discardChanges,
		setSaveMode,
	} = useTranslationStore();
	const { settings, updateSettings } = useSettings();
	const connectorStatus = useConnectorStatus();

	// Signal the bun side that the UI has painted (triggers Windows resize hack)
	useEffect(() => {
		window.rpcBridge?.("windowReady", {});
	}, []);

	const [activeNamespace, setActiveNamespace] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "missing" | "empty" | "unreviewed">("all");
	const [visibleLocales, setVisibleLocales] = useState<string[] | null>(null);
	const [view, setView] = useState<ViewMode>("editor");
	const [showAddKey, setShowAddKey] = useState(false);
	const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
	const [searchScope, setSearchScope] = useState<"current" | "all">("current");
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		type: "namespace" | "key";
		value: string;
		namespace?: string;
	} | null>(null);

	const saveMode = settings?.saveMode ?? "auto";
	const pendingCount = pendingChanges.size;
	const hasUnsaved = pendingCount > 0;

	// Update window title with unsaved indicator
	useEffect(() => {
		const base = store?.localesDir ? `Rosetta — ${store.localesDir}` : "Rosetta";
		const title = saveMode === "manual" && hasUnsaved ? `${base} *` : base;
		(window as any).rpcBridge?.("setWindowTitle", { title });
	}, [hasUnsaved, saveMode, store?.localesDir]);

	// Wrap updateSettings to emit theme changes to the main process
	const handleUpdateSettings = useCallback(
		(partial: Partial<RosettaSettings>) => {
			updateSettings(partial);
		},
		[updateSettings],
	);

	// Apply theme to body
	useEffect(() => {
		const theme = settings?.theme ?? "system";
		const isDark =
			theme === "dark" ||
			(theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

		document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
		document.body.classList.toggle("dark", isDark);
		document.body.classList.toggle("light", !isDark);
	}, [settings?.theme]);

	// Keep saveMode ref in sync
	useEffect(() => {
		setSaveMode(saveMode);
	}, [saveMode, setSaveMode]);

	// Warn on close/refresh with unsaved changes
	useEffect(() => {
		if (!hasUnsaved) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [hasUnsaved]);

	// Cmd+S / Ctrl+S to save in manual mode
	useEffect(() => {
		if (saveMode !== "manual") return;
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				if (hasUnsaved) saveAll();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [saveMode, hasUnsaved, saveAll]);

	// Cmd/Ctrl+. to toggle settings
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === ".") {
				e.preventDefault();
				setView((v) => (v === "settings" ? "editor" : "settings"));
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	// Apply theme
	const theme = settings?.theme;
	useEffect(() => {
		if (!theme) return;
		if (theme === "system") {
			document.documentElement.removeAttribute("data-theme");
		} else {
			document.documentElement.setAttribute("data-theme", theme);
		}
	}, [theme]);

	// Initialize visible locales from settings
	useEffect(() => {
		if (settings?.visibleLocales && visibleLocales === null) {
			setVisibleLocales(settings.visibleLocales);
		}
	}, [settings, visibleLocales]);

	const effectiveNamespace = activeNamespace ?? findFirstLeaf(store?.namespaces ?? []);
	const effectiveLocales = visibleLocales ?? store?.locales ?? [];

	// Global view: show all namespaces when scope is "all"
	const isGlobalView = searchScope === "all";

	const entries = useMemo(() => {
		if (!store || !effectiveNamespace) return {};
		return store.translations[effectiveNamespace] ?? {};
	}, [store, effectiveNamespace]);

	const nsReviews = useMemo(() => {
		if (!store || !effectiveNamespace) return {};
		return store.reviews?.[effectiveNamespace] ?? {};
	}, [store, effectiveNamespace]);

	const globalEntries = useMemo(() => {
		if (!store || !isGlobalView) return {};
		return store.translations;
	}, [store, isGlobalView]);

	const stats = useMemo(() => {
		if (!store) return { total: 0, missing: 0, unreviewed: 0 };

		if (searchScope === "all") {
			let total = 0;
			let missing = 0;
			let unreviewed = 0;
			for (const [ns, keys] of Object.entries(store.translations)) {
				const nsKeys = Object.keys(keys);
				total += nsKeys.length;
				for (const key of nsKeys) {
					for (const locale of effectiveLocales) {
						if (keys[key]?.[locale] === undefined) {
							missing++;
						} else if (!store.reviews?.[ns]?.[key]?.[locale]) {
							unreviewed++;
						}
					}
				}
			}
			return { total, missing, unreviewed };
		}

		if (!effectiveNamespace) return { total: 0, missing: 0, unreviewed: 0 };

		const keys = Object.keys(entries);
		let missing = 0;
		let unreviewed = 0;

		for (const key of keys) {
			for (const locale of effectiveLocales) {
				if (entries[key]?.[locale] === undefined) {
					missing++;
				} else if (!nsReviews[key]?.[locale]) {
					unreviewed++;
				}
			}
		}

		return { total: keys.length, missing, unreviewed };
	}, [entries, store, effectiveNamespace, effectiveLocales, nsReviews, searchScope]);

	const handleSelectNamespace = useCallback((path: string) => {
		setActiveNamespace(path);
		setView("editor");
	}, []);

	const handleAddKey = useCallback(
		(key: string, values: Record<string, string>) => {
			if (!effectiveNamespace) return;
			const create: KeyCreate = { namespace: effectiveNamespace, key, values };
			createKey(create);
		},
		[effectiveNamespace, createKey],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent, type: "namespace" | "key", value: string, namespace?: string) => {
			e.preventDefault();
			setContextMenu({ x: e.clientX, y: e.clientY, type, value, namespace });
		},
		[],
	);

	const handleFocusNamespace = useCallback((ns: string) => {
		setSearch("");
		setFilter("all");
		setActiveNamespace(ns);
		setView("editor");
		setSearchScope("current");
		setContextMenu(null);
	}, []);

	const handleFocusKey = useCallback(
		(key: string, namespace?: string) => {
			if (namespace) {
				setActiveNamespace(namespace);
			}
			setSearch(key);
			setFilter("all");
			setSearchScope("current");
			setView("editor");
			setContextMenu(null);
		},
		[],
	);

	if (loading) {
		return (
			<div className="app">
				<div className="empty-state" style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}>
					<h2>Loading...</h2>
				</div>
			</div>
		);
	}

	if (!store || store.locales.length === 0) {
		return (
			<div className="app">
				<div className="empty-state" style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}>
					<h2>No translations loaded</h2>
					<p>Select a locales directory to start editing translations.</p>
					<button type="button" className="open-folder-btn" onClick={openFolder}>
						Open Folder
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			className="app"
			onClick={() => contextMenu && setContextMenu(null)}
			onKeyDown={(e) => {
				if (e.key === "Escape") setContextMenu(null);
			}}
		>
			<Sidebar
				namespaces={store.namespaces}
				activeNamespace={view === "settings" ? null : effectiveNamespace}
				onSelect={handleSelectNamespace}
				onOpenSettings={() => setView("settings")}
				onCreateNamespace={(ns) => createNamespace({ namespace: ns })}
				onDeleteNamespace={(ns) => {
					if (effectiveNamespace === ns) setActiveNamespace(null);
					deleteNamespace({ namespace: ns });
				}}
				onAddKeyToNamespace={(ns) => {
					setActiveNamespace(ns);
					setView("editor");
					setShowAddKey(true);
				}}
				isSettingsActive={view === "settings"}
			/>

			<Toolbar
				search={search}
				onSearchChange={setSearch}
				filter={filter}
				onFilterChange={setFilter}
				totalKeys={stats.total}
				missingCount={stats.missing}
				unreviewedCount={stats.unreviewed}
				onAddKey={view === "editor" && effectiveNamespace ? () => setShowAddKey(true) : undefined}
				allLocales={store.locales}
				visibleLocales={effectiveLocales}
				onVisibleLocalesChange={setVisibleLocales}
				onAddLocale={addLocale}
				onRemoveLocale={removeLocale}
				saveMode={saveMode}
				pendingCount={pendingCount}
				onSave={saveAll}
				onDiscard={() => setShowUnsavedDialog(true)}
				hidden={view === "settings"}
				searchScope={searchScope}
				onSearchScopeChange={setSearchScope}
			/>

			<div className="editor-area">
				{view === "settings" && settings ? (
					<SettingsPanel
						settings={settings}
						onUpdate={handleUpdateSettings}
						onBrowseFolder={openFolder}
						currentDir={store?.localesDir ?? null}
						onInstallCli={async () => {
							try {
								const rpcBridge = (window as any).rpcBridge;
								if (!rpcBridge) {
									return { success: false, message: "RPC not available" };
								}
								const result = await rpcBridge("installCli", {});
								return result as { success: boolean; message: string };
							} catch (err) {
								return {
									success: false,
									message: `Error: ${err instanceof Error ? err.message : String(err)}`,
								};
							}
						}}
					/>
				) : isGlobalView ? (
					<GlobalSearchResults
						results={globalEntries}
						reviews={store.reviews}
						locales={effectiveLocales}
						search={search}
						filter={filter}
						onUpdateKey={updateKey}
						onToggleReview={toggleReview}
						onFocusNamespace={(e, ns) => handleContextMenu(e, "namespace", ns)}
						onFocusKey={(e, key, ns) => handleContextMenu(e, "key", key, ns)}
					/>
				) : effectiveNamespace ? (
					<EditorTable
						locales={effectiveLocales}
						entries={entries}
						reviews={nsReviews}
						namespace={effectiveNamespace}
						search={search}
						filter={filter}
						onUpdateKey={updateKey}
						onToggleReview={toggleReview}
						onFocusKey={(e, key) => handleContextMenu(e, "key", key, effectiveNamespace!)}
					/>
				) : (
					<div className="empty-state">
						<h2>Select a namespace</h2>
						<p>Choose a namespace from the sidebar to start editing translations.</p>
					</div>
				)}
			</div>

			<StatusBar
				totalKeys={stats.total}
				missingCount={stats.missing}
				connectorConnected={connectorStatus.connected}
				activeNamespace={isGlobalView ? "All namespaces" : effectiveNamespace}
				saveMode={saveMode}
				pendingCount={pendingCount}
				onShowMissing={() => {
					setSearchScope("all");
					setFilter("missing");
					setView("editor");
				}}
			/>

			{showAddKey && effectiveNamespace && (
				<AddKeyDialog
					namespace={effectiveNamespace}
					locales={store.locales}
					existingKeys={Object.keys(store.translations[effectiveNamespace] ?? {})}
					onAdd={handleAddKey}
					onClose={() => setShowAddKey(false)}
				/>
			)}

			{showUnsavedDialog && (
				<UnsavedDialog
					pendingCount={pendingCount}
					onSave={async () => {
						await saveAll();
						setShowUnsavedDialog(false);
					}}
					onDiscard={() => {
						discardChanges();
						setShowUnsavedDialog(false);
					}}
					onCancel={() => setShowUnsavedDialog(false)}
				/>
			)}

			{contextMenu && (
				<div
					className="context-menu"
					style={{
						position: "fixed",
						left: `${contextMenu.x}px`,
						top: `${contextMenu.y}px`,
						zIndex: 10000,
					}}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<button
						type="button"
						className="context-menu-item"
						onClick={() => {
							if (contextMenu.type === "namespace") {
								handleFocusNamespace(contextMenu.value);
							} else {
								handleFocusKey(contextMenu.value, contextMenu.namespace);
							}
						}}
					>
						Focus on {contextMenu.type === "namespace" ? "namespace" : "key"}
					</button>
				</div>
			)}
		</div>
	);
}

function UnsavedDialog({
	pendingCount,
	onSave,
	onDiscard,
	onCancel,
}: {
	pendingCount: number;
	onSave: () => void;
	onDiscard: () => void;
	onCancel: () => void;
}) {
	return (
		<div
			className="dialog-overlay"
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onCancel();
			}}
		>
			<div className="dialog">
				<h3>Unsaved changes</h3>
				<p style={{ color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
					You have {pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}. What would
					you like to do?
				</p>
				<div className="dialog-actions">
					<button type="button" className="toolbar-btn" onClick={onDiscard}>
						Discard
					</button>
					<button type="button" className="toolbar-btn" onClick={onCancel}>
						Cancel
					</button>
					<button type="button" className="toolbar-btn primary" onClick={onSave}>
						Save All
					</button>
				</div>
			</div>
		</div>
	);
}

/** Global search results — shows entries grouped by namespace */
function GlobalSearchResults({
	results,
	reviews,
	locales,
	search,
	filter,
	onUpdateKey,
	onToggleReview,
	onFocusNamespace,
	onFocusKey,
}: {
	results: Record<string, Record<string, Record<string, string>>>;
	reviews: Record<string, Record<string, Record<string, boolean>>>;
	locales: string[];
	search: string;
	filter: "all" | "missing" | "empty" | "unreviewed";
	onUpdateKey: (update: { namespace: string; key: string; locale: string; value: string }) => void;
	onToggleReview: (toggle: ReviewToggle) => void;
	onFocusNamespace: (e: React.MouseEvent, ns: string) => void;
	onFocusKey: (e: React.MouseEvent, key: string, namespace?: string) => void;
}) {
	// Filter out namespaces with no keys surviving search + filter
	const namespaces = Object.keys(results)
		.filter((ns) => {
			const entries = results[ns];
			let keys = Object.keys(entries);
			if (keys.length === 0) return false;

			if (search) {
				const q = search.toLowerCase();
				keys = keys.filter((key) => {
					if (key.toLowerCase().includes(q)) return true;
					return Object.values(entries[key]).some((v) => v.toLowerCase().includes(q));
				});
			}

			if (filter === "missing") {
				keys = keys.filter((key) => locales.some((l) => entries[key][l] === undefined));
			} else if (filter === "empty") {
				keys = keys.filter((key) =>
					locales.some((l) => entries[key][l] === undefined || entries[key][l] === ""),
				);
			} else if (filter === "unreviewed") {
				keys = keys.filter((key) =>
					locales.some((l) => {
						const hasValue = entries[key][l] !== undefined;
						const isReviewed = reviews?.[ns]?.[key]?.[l] === true;
						return hasValue && !isReviewed;
					}),
				);
			}

			return keys.length > 0;
		})
		.sort();

	if (namespaces.length === 0) {
		return (
			<div className="empty-state">
				<h2>No keys</h2>
				<p>
					{search
						? `No translation keys match "${search}" across any namespace.`
						: "No translation keys found."}
				</p>
			</div>
		);
	}

	return (
		<div className="global-search-results">
			{namespaces.map((ns) => (
				<div key={ns}>
					<div
						className="search-result-namespace"
						onContextMenu={(e) => {
							onFocusNamespace(e, ns);
						}}
					>
						{ns}
					</div>
					<EditorTable
						locales={locales}
						entries={results[ns]}
						reviews={reviews?.[ns]}
						namespace={ns}
						search={search}
						filter={filter}
						onUpdateKey={onUpdateKey}
						onToggleReview={onToggleReview}
						onFocusKey={(e, key) => onFocusKey(e, key, ns)}
						hideEmptyFiltered
					/>
				</div>
			))}
		</div>
	);
}

function findFirstLeaf(
	nodes: { path: string; children?: { path: string; children?: any[] }[] }[],
): string | null {
	for (const node of nodes) {
		if (!node.children || node.children.length === 0) {
			return node.path;
		}
		const leaf = findFirstLeaf(node.children);
		if (leaf) return leaf;
	}
	return null;
}
