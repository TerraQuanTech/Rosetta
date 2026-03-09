import { fuzzyMatch } from "@/utils/fuzzy";
import type {
	FilterType,
	KeyRename,
	KeyUpdate,
	LocaleReviews,
	LocaleValues,
	ReviewToggle,
} from "@shared/types";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditableCell } from "./EditableCell";
import { ExpandedRow } from "./ExpandedRow";

interface EditorTableProps {
	locales: string[];
	/** flat key -> locale -> value */
	entries: Record<string, LocaleValues>;
	/** key -> locale -> reviewed */
	reviews?: Record<string, LocaleReviews>;
	namespace: string;
	search: string;
	filter: FilterType;
	onUpdateKey: (update: KeyUpdate) => void;
	onRenameKey?: (rename: KeyRename) => void;
	onToggleReview?: (toggle: ReviewToggle) => void;
	/** When true, return null instead of empty state when no keys match */
	hideEmptyFiltered?: boolean;
	/** Called when right-clicking a row to focus on that key */
	onFocusKey?: (e: React.MouseEvent, key: string) => void;
	/** Called when right-clicking namespace header to focus on that namespace */
	onFocusNamespace?: () => void;
	/** Externally triggered key to rename (from context menu) */
	renamingKey?: string | null;
	onRenamingKeyChange?: (key: string | null) => void;
}

export function EditorTable({
	locales,
	entries,
	reviews,
	namespace,
	search,
	filter,
	onUpdateKey,
	onRenameKey,
	onToggleReview,
	hideEmptyFiltered,
	onFocusKey,
	renamingKey: externalRenamingKey,
	onRenamingKeyChange,
}: EditorTableProps) {
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const [internalRenamingKey, setInternalRenamingKey] = useState<string | null>(null);
	const renamingKey = externalRenamingKey ?? internalRenamingKey;
	const setRenamingKey = useCallback(
		(key: string | null) => {
			setInternalRenamingKey(key);
			onRenamingKeyChange?.(key);
		},
		[onRenamingKeyChange],
	);

	const toggleExpand = useCallback((key: string) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleCellClick = useCallback(
		(key: string) => {
			if (renamingKey === key) return;
			if (!onRenameKey) {
				toggleExpand(key);
				return;
			}
			if (clickTimer.current) {
				clearTimeout(clickTimer.current);
				clickTimer.current = null;
				return;
			}
			clickTimer.current = setTimeout(() => {
				clickTimer.current = null;
				toggleExpand(key);
			}, 50);
		},
		[renamingKey, onRenameKey, toggleExpand],
	);

	const handleCellDoubleClick = useCallback(
		(key: string) => {
			if (!onRenameKey) return;
			if (clickTimer.current) {
				clearTimeout(clickTimer.current);
				clickTimer.current = null;
			}
			setRenamingKey(key);
		},
		[onRenameKey, setRenamingKey],
	);

	const filteredKeys = useMemo(() => {
		let keys = Object.keys(entries).sort();

		if (search) {
			keys = keys.filter((key) => {
				if (fuzzyMatch(search, key)) return true;
				const localeValues = entries[key];
				return Object.values(localeValues).some((v) => fuzzyMatch(search, v));
			});
		}

		if (filter === "missing") {
			keys = keys.filter((key) => locales.some((locale) => entries[key][locale] === undefined));
		} else if (filter === "empty") {
			keys = keys.filter((key) =>
				locales.some((locale) => entries[key][locale] === undefined || entries[key][locale] === ""),
			);
		} else if (filter === "unreviewed") {
			keys = keys.filter((key) =>
				locales.some((locale) => {
					const hasValue = entries[key][locale] !== undefined;
					const isReviewed = reviews?.[key]?.[locale] === true;
					return hasValue && !isReviewed;
				}),
			);
		}

		return keys;
	}, [entries, locales, search, filter, reviews]);

	if (filteredKeys.length === 0) {
		if (hideEmptyFiltered) return null;
		return (
			<div className="empty-state">
				<h2>{search ? "No matches" : "No keys"}</h2>
				<p>
					{search
						? `No translation keys match "${search}"`
						: "This namespace has no translation keys yet."}
				</p>
			</div>
		);
	}

	const colCount = locales.length + 1;

	return (
		<table className="editor-table">
			<thead>
				<tr>
					<th className="key-col">Key</th>
					{locales.map((locale) => (
						<th key={locale}>{locale.toUpperCase()}</th>
					))}
				</tr>
			</thead>
			<tbody>
				{filteredKeys.map((key) => {
					const isExpanded = expandedKeys.has(key);
					return (
						<Fragment key={key}>
							<tr
								className={isExpanded ? "row-expanded" : ""}
								onContextMenu={(e) => {
									if (onFocusKey) {
										onFocusKey(e, key);
									}
								}}
							>
								<td
									className="key-cell"
									onClick={() => handleCellClick(key)}
									onDoubleClick={() => handleCellDoubleClick(key)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleCellClick(key);
										}
									}}
								>
									<span className={`expand-chevron${isExpanded ? " open" : ""}`}>&#9656;</span>
									{renamingKey === key ? (
										<InlineKeyRename
											currentKey={key}
											onCommit={(newKey) => {
												setRenamingKey(null);
												if (newKey !== key) {
													onRenameKey!({ namespace, oldKey: key, newKey });
												}
											}}
											onCancel={() => setRenamingKey(null)}
										/>
									) : (
										<span className="key-cell-text">{breakByDot(key)}</span>
									)}
								</td>
								{locales.map((locale) => (
									<EditableCell
										key={`${key}-${locale}`}
										value={entries[key]?.[locale]}
										locale={locale}
										reviewed={reviews?.[key]?.[locale] === true}
										onSave={(value) => onUpdateKey({ namespace, key, locale, value })}
										onToggleReview={
											onToggleReview
												? (reviewed) => onToggleReview({ namespace, key, locale, reviewed })
												: undefined
										}
									/>
								))}
							</tr>
							{isExpanded && (
								<tr className="expanded-detail-row">
									<td colSpan={colCount}>
										<ExpandedRow
											translationKey={key}
											locales={locales}
											values={entries[key] ?? {}}
											reviews={reviews?.[key] ?? {}}
											namespace={namespace}
											onUpdateKey={onUpdateKey}
											onToggleReview={onToggleReview}
										/>
									</td>
								</tr>
							)}
						</Fragment>
					);
				})}
			</tbody>
		</table>
	);
}

/** Insert zero-width spaces after dots so the browser can line-break there */
function breakByDot(text: string): string {
	return text.replaceAll(".", ".\u200B");
}

function InlineKeyRename({
	currentKey,
	onCommit,
	onCancel,
}: {
	currentKey: string;
	onCommit: (newKey: string) => void;
	onCancel: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [draft, setDraft] = useState(currentKey);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	return (
		<input
			ref={inputRef}
			className="key-rename-input"
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => onCommit(draft.trim() || currentKey)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					onCommit(draft.trim() || currentKey);
				} else if (e.key === "Escape") {
					e.preventDefault();
					onCancel();
				}
			}}
			onClick={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
		/>
	);
}
