import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyCreate, RosettaSettings } from "../shared/types";
import { AddKeyDialog } from "./components/AddKeyDialog";
import { EditorTable } from "./components/EditorTable";
import { GlobalSearchResults } from "./components/GlobalSearchResults";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { UnsavedDialog } from "./components/UnsavedDialog";
import { useConnectorStatus } from "./hooks/useConnectorStatus";
import { useSettings } from "./hooks/useSettings";
import { useTranslationStore } from "./hooks/useStore";
import { findFirstLeaf } from "./utils/namespace";

type ViewMode = "editor" | "settings";

export default function App() {
	const {
		store,
		loading,
		updateKey,
		createKey,
		renameKey,
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
	const [renamingKey, setRenamingKey] = useState<string | null>(null);
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

	useEffect(() => {
		const base = store?.localesDir ? `Rosetta — ${store.localesDir}` : "Rosetta";
		const title = saveMode === "manual" && hasUnsaved ? `${base} *` : base;
		window.rpcBridge?.("setWindowTitle", { title });
	}, [hasUnsaved, saveMode, store?.localesDir]);

	const handleUpdateSettings = useCallback(
		(partial: Partial<RosettaSettings>) => {
			updateSettings(partial);
		},
		[updateSettings],
	);

	useEffect(() => {
		const theme = settings?.theme ?? "system";
		const isDark =
			theme === "dark" ||
			(theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

		document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
		document.body.classList.toggle("dark", isDark);
		document.body.classList.toggle("light", !isDark);
	}, [settings?.theme]);

	useEffect(() => {
		setSaveMode(saveMode);
	}, [saveMode, setSaveMode]);

	useEffect(() => {
		if (!hasUnsaved) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [hasUnsaved]);

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

	const theme = settings?.theme;
	useEffect(() => {
		if (!theme) return;
		if (theme === "system") {
			document.documentElement.removeAttribute("data-theme");
		} else {
			document.documentElement.setAttribute("data-theme", theme);
		}
	}, [theme]);

	useEffect(() => {
		if (settings?.visibleLocales && visibleLocales === null) {
			setVisibleLocales(settings.visibleLocales);
		}
	}, [settings, visibleLocales]);

	const effectiveNamespace = activeNamespace ?? findFirstLeaf(store?.namespaces ?? []);
	const effectiveLocales = visibleLocales ?? store?.locales ?? [];

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

	const handleFocusKey = useCallback((key: string, namespace?: string) => {
		if (namespace) {
			setActiveNamespace(namespace);
		}
		setSearch(key);
		setFilter("all");
		setSearchScope("current");
		setView("editor");
		setContextMenu(null);
	}, []);

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
				onOpenSettings={() => setView((v) => (v === "settings" ? "editor" : "settings"))}
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
								const rpcBridge = window.rpcBridge;
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
						onRenameKey={renameKey}
						onToggleReview={toggleReview}
						onFocusKey={(e, key) => handleContextMenu(e, "key", key, effectiveNamespace!)}
						renamingKey={renamingKey}
						onRenamingKeyChange={setRenamingKey}
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
					{contextMenu.type === "key" && (
						<button
							type="button"
							className="context-menu-item"
							onClick={() => {
								setRenamingKey(contextMenu.value);
								setContextMenu(null);
							}}
						>
							Rename key
						</button>
					)}
				</div>
			)}
		</div>
	);
}
