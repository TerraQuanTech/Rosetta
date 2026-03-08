interface ToolbarProps {
	search: string;
	onSearchChange: (value: string) => void;
	filter: "all" | "missing" | "empty";
	onFilterChange: (filter: "all" | "missing" | "empty") => void;
	totalKeys: number;
	missingCount: number;
	onAddKey?: () => void;
}

export function Toolbar({
	search,
	onSearchChange,
	filter,
	onFilterChange,
	totalKeys,
	missingCount,
	onAddKey,
}: ToolbarProps) {
	return (
		<div className="toolbar">
			<input
				className="search-input"
				type="text"
				placeholder="Search keys or values..."
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
			</div>

			<div className="toolbar-spacer" />

			{onAddKey && (
				<button type="button" className="toolbar-btn primary" onClick={onAddKey}>
					+ Add Key
				</button>
			)}
		</div>
	);
}
