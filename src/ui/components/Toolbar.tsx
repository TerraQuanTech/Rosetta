import { LocalePicker } from "./LocalePicker";

type FilterType = "all" | "missing" | "empty" | "unreviewed";

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
}: ToolbarProps) {
	return (
		<div className="toolbar">
			<input
				className="search-input"
				type="text"
				placeholder="Search all keys and values..."
				value={search}
				onChange={(e) => onSearchChange(e.target.value)}
			/>

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

			{allLocales.length > 1 && (
				<LocalePicker
					allLocales={allLocales}
					visibleLocales={visibleLocales}
					onChange={onVisibleLocalesChange}
				/>
			)}

			{onAddKey && (
				<button type="button" className="toolbar-btn primary" onClick={onAddKey}>
					+ Add Key
				</button>
			)}
		</div>
	);
}
