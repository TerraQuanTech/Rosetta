import { LocalePicker } from "./LocalePicker";
import { WindowControls } from "./WindowControls";

type FilterType = "all" | "missing" | "empty" | "unreviewed";
type SearchScope = "current" | "all";

interface ToolbarProps {
	search: string;
	onSearchChange: (value: string) => void;
	filter: FilterType;
	onFilterChange: (filter: FilterType) => void;
	totalKeys: number;
	missingCount: number;
	unreviewedCount?: number;
	onAddKey?: () => void;
	allLocales: string[];
	visibleLocales: string[];
	onVisibleLocalesChange: (locales: string[]) => void;
	onAddLocale?: (locale: string) => void;
	onRemoveLocale?: (locale: string) => void;
	saveMode: "auto" | "manual";
	pendingCount: number;
	onSave: () => void;
	onDiscard: () => void;
	hidden?: boolean;
	searchScope: SearchScope;
	onSearchScopeChange: (scope: SearchScope) => void;
}

export function Toolbar({
	search,
	onSearchChange,
	filter,
	onFilterChange,
	totalKeys,
	missingCount,
	unreviewedCount,
	onAddKey,
	allLocales,
	visibleLocales,
	onVisibleLocalesChange,
	onAddLocale,
	onRemoveLocale,
	saveMode,
	pendingCount,
	onSave,
	onDiscard,
	hidden,
	searchScope,
	onSearchScopeChange,
}: ToolbarProps) {
	const hasUnsaved = saveMode === "manual" && pendingCount > 0;

	if (hidden) {
		return <div className="toolbar electrobun-webkit-app-region-drag" />;
	}

	return (
		<div className="toolbar electrobun-webkit-app-region-drag">
			<div className="search-group">
				<input
					className="search-input"
					type="text"
					placeholder={
						searchScope === "all" ? "Search all namespaces..." : "Search current namespace..."
					}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
				/>
				<div className="scope-toggle">
					<button
						type="button"
						className={searchScope === "current" ? "active" : ""}
						onClick={() => onSearchScopeChange("current")}
						title="Search current namespace"
					>
						Current
					</button>
					<button
						type="button"
						className={searchScope === "all" ? "active" : ""}
						onClick={() => onSearchScopeChange("all")}
						title="Search all namespaces"
					>
						All
					</button>
				</div>
			</div>

			<div className="filter-group">
				<button
					type="button"
					className={`filter-chip ${filter === "all" ? "active" : ""}`}
					onClick={() => onFilterChange("all")}
				>
					All ({totalKeys})
				</button>
				<button
					type="button"
					className={`filter-chip ${filter === "missing" ? "active" : ""}`}
					onClick={() => onFilterChange("missing")}
				>
					Missing ({missingCount})
				</button>
				{unreviewedCount !== undefined && (
					<button
						type="button"
						className={`filter-chip ${filter === "unreviewed" ? "active" : ""}`}
						onClick={() => onFilterChange("unreviewed")}
					>
						Unreviewed ({unreviewedCount})
					</button>
				)}
			</div>

			<div className="toolbar-spacer" />

			{hasUnsaved && (
				<div className="save-group">
					<button type="button" className="toolbar-btn" onClick={onDiscard}>
						Discard
					</button>
					<button type="button" className="toolbar-btn primary" onClick={onSave}>
						Save ({pendingCount})
					</button>
				</div>
			)}

			<LocalePicker
				allLocales={allLocales}
				visibleLocales={visibleLocales}
				onChange={onVisibleLocalesChange}
				onAddLocale={onAddLocale}
				onRemoveLocale={onRemoveLocale}
			/>

			{onAddKey && (
				<button type="button" className="toolbar-btn primary" onClick={onAddKey}>
					+ Add Key
				</button>
			)}

			<WindowControls />
		</div>
	);
}
