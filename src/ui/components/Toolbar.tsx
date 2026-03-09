import type { FilterType, SaveMode, SearchScope } from "@shared/types";
import { useEffect, useRef } from "react";
import { LocalePicker } from "./LocalePicker";

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
	saveMode: SaveMode;
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
	const searchRef = useRef<HTMLInputElement>(null);
	const hasUnsaved = saveMode === "manual" && pendingCount > 0;

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			if (e.key === "f") {
				e.preventDefault();
				searchRef.current?.focus();
			} else if (e.key === "l") {
				e.preventDefault();
				onSearchScopeChange("all");
				searchRef.current?.focus();
			} else if (e.key === "k") {
				e.preventDefault();
				onSearchScopeChange("current");
				searchRef.current?.focus();
			} else if (e.key === "m") {
				e.preventDefault();
				onFilterChange(filter === "missing" ? "all" : "missing");
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onSearchScopeChange, onFilterChange, filter]);

	if (hidden) {
		return <div className="toolbar electrobun-webkit-app-region-drag" />;
	}

	return (
		<div className="toolbar electrobun-webkit-app-region-drag">
			<div className="search-group">
				<div className="search-input-wrapper">
					<input
						ref={searchRef}
						className="search-input"
						type="text"
						placeholder={
							searchScope === "all" ? "Search all namespaces..." : "Search current namespace..."
						}
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								(e.target as HTMLInputElement).blur();
							}
						}}
					/>
					{search ? (
						<button
							type="button"
							className="search-clear-btn"
							onClick={() => onSearchChange("")}
							title="Clear search"
						>
							&times;
						</button>
					) : (
						<kbd className="search-shortcut-hint">
							{navigator.platform.startsWith("Mac") ? "\u2318" : "Ctrl"}+F
						</kbd>
					)}
				</div>
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
		</div>
	);
}
