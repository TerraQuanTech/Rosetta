import { useCallback, useMemo, useState } from "react";
import { EditorTable } from "./components/EditorTable";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { useTranslationStore } from "./hooks/useStore";

export default function App() {
	const { store, loading, updateKey, openFolder } = useTranslationStore();
	const [activeNamespace, setActiveNamespace] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "missing" | "empty">("all");

	// Auto-select first namespace if none selected
	const effectiveNamespace = activeNamespace ?? findFirstLeaf(store?.namespaces ?? []);

	const entries = useMemo(() => {
		if (!store || !effectiveNamespace) return {};
		return store.translations[effectiveNamespace] ?? {};
	}, [store, effectiveNamespace]);

	const stats = useMemo(() => {
		if (!store || !effectiveNamespace) return { total: 0, missing: 0 };

		const keys = Object.keys(entries);
		let missing = 0;

		for (const key of keys) {
			for (const locale of store.locales) {
				if (entries[key]?.[locale] === undefined) {
					missing++;
				}
			}
		}

		return { total: keys.length, missing };
	}, [entries, store, effectiveNamespace]);

	const handleSelectNamespace = useCallback((path: string) => {
		setActiveNamespace(path);
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
		<div className="app">
			<Sidebar
				namespaces={store.namespaces}
				activeNamespace={effectiveNamespace}
				onSelect={handleSelectNamespace}
			/>

			<Toolbar
				search={search}
				onSearchChange={setSearch}
				filter={filter}
				onFilterChange={setFilter}
				totalKeys={stats.total}
				missingCount={stats.missing}
			/>

			<div className="editor-area">
				{effectiveNamespace ? (
					<EditorTable
						locales={store.locales}
						entries={entries}
						namespace={effectiveNamespace}
						search={search}
						filter={filter}
						onUpdateKey={updateKey}
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
				connectorConnected={false}
				activeNamespace={effectiveNamespace}
			/>
		</div>
	);
}

/** Find the first leaf node in the namespace tree */
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
