import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyCreate, ReviewToggle } from "../shared/types";
import { AddKeyDialog } from "./components/AddKeyDialog";
import { EditorTable } from "./components/EditorTable";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { useSettings } from "./hooks/useSettings";
import { useTranslationStore } from "./hooks/useStore";

type ViewMode = "editor" | "settings";

export default function App() {
	const { store, loading, updateKey, createKey, createNamespace, deleteNamespace, toggleReview, openFolder } = useTranslationStore();
	const { settings, updateSettings } = useSettings();
	const [activeNamespace, setActiveNamespace] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "missing" | "empty" | "unreviewed">("all");
	const [visibleLocales, setVisibleLocales] = useState<string[] | null>(null);
	const [view, setView] = useState<ViewMode>("editor");
	const [showAddKey, setShowAddKey] = useState(false);

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

	// Global search: search across ALL namespaces
	const globalSearchResults = useMemo(() => {
		if (!store || !search) return null;
		const q = search.toLowerCase();
		const results: { namespace: string; key: string }[] = [];

		for (const [ns, keys] of Object.entries(store.translations)) {
			for (const [key, localeMap] of Object.entries(keys)) {
				if (key.toLowerCase().includes(q)) {
					results.push({ namespace: ns, key });
					continue;
				}
				if (Object.values(localeMap).some((v) => v.toLowerCase().includes(q))) {
					results.push({ namespace: ns, key });
				}
			}
		}
		return results;
	}, [store, search]);

	// When searching, show results from matching namespaces
	const isGlobalSearch = search.length > 0;

	const entries = useMemo(() => {
		if (!store || !effectiveNamespace) return {};
		return store.translations[effectiveNamespace] ?? {};
	}, [store, effectiveNamespace]);

	const nsReviews = useMemo(() => {
		if (!store || !effectiveNamespace) return {};
		return store.reviews?.[effectiveNamespace] ?? {};
	}, [store, effectiveNamespace]);

	// Entries for global search (merged from all namespaces)
	const globalEntries = useMemo(() => {
		if (!store || !globalSearchResults) return {};
		const grouped: Record<string, Record<string, Record<string, string>>> = {};
		for (const { namespace, key } of globalSearchResults) {
			if (!grouped[namespace]) grouped[namespace] = {};
			grouped[namespace][key] = store.translations[namespace]?.[key] ?? {};
		}
		return grouped;
	}, [store, globalSearchResults]);

	const stats = useMemo(() => {
		if (!store || !effectiveNamespace) return { total: 0, missing: 0, unreviewed: 0 };

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
	}, [entries, store, effectiveNamespace, effectiveLocales, nsReviews]);

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
		<div className="app">
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
			/>

			<div className="editor-area">
				{view === "settings" && settings ? (
					<SettingsPanel
						settings={settings}
						onUpdate={updateSettings}
						onBrowseFolder={openFolder}
						currentDir={store?.localesDir ?? null}
					/>
				) : isGlobalSearch ? (
					<GlobalSearchResults
						results={globalEntries}
						reviews={store.reviews}
						locales={effectiveLocales}
						search={search}
						filter={filter}
						onUpdateKey={updateKey}
						onToggleReview={toggleReview}
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
					/>
				) : (
					<div className="empty-state">
						<h2>Select a namespace</h2>
						<p>Choose a namespace from the sidebar to start editing translations.</p>
					</div>
				)}
			</div>

			<StatusBar
				totalKeys={isGlobalSearch ? (globalSearchResults?.length ?? 0) : stats.total}
				missingCount={stats.missing}
				connectorConnected={false}
				activeNamespace={isGlobalSearch ? `Search: "${search}"` : effectiveNamespace}
			/>

			{showAddKey && effectiveNamespace && (
				<AddKeyDialog
					namespace={effectiveNamespace}
					locales={store.locales}
					onAdd={handleAddKey}
					onClose={() => setShowAddKey(false)}
				/>
			)}
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
}: {
	results: Record<string, Record<string, Record<string, string>>>;
	reviews: Record<string, Record<string, Record<string, boolean>>>;
	locales: string[];
	search: string;
	filter: "all" | "missing" | "empty" | "unreviewed";
	onUpdateKey: (update: { namespace: string; key: string; locale: string; value: string }) => void;
	onToggleReview: (toggle: ReviewToggle) => void;
}) {
	const namespaces = Object.keys(results).sort();

	if (namespaces.length === 0) {
		return (
			<div className="empty-state">
				<h2>No matches</h2>
				<p>No translation keys match &ldquo;{search}&rdquo; across any namespace.</p>
			</div>
		);
	}

	return (
		<div>
			{namespaces.map((ns) => (
				<div key={ns}>
					<div className="search-result-namespace">{ns}</div>
					<EditorTable
						locales={locales}
						entries={results[ns]}
						reviews={reviews[ns]}
						namespace={ns}
						search={search}
						filter={filter}
						onUpdateKey={onUpdateKey}
						onToggleReview={onToggleReview}
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
