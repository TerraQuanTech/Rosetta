import { Fragment, useCallback, useMemo, useState } from "react";
import type { KeyUpdate, ReviewToggle } from "../../shared/types";
import { EditableCell } from "./EditableCell";
import { ExpandedRow } from "./ExpandedRow";

interface EditorTableProps {
	locales: string[];
	/** flat key -> locale -> value */
	entries: Record<string, Record<string, string>>;
	/** key -> locale -> reviewed */
	reviews?: Record<string, Record<string, boolean>>;
	namespace: string;
	search: string;
	filter: "all" | "missing" | "empty" | "unreviewed";
	onUpdateKey: (update: KeyUpdate) => void;
	onToggleReview?: (toggle: ReviewToggle) => void;
}

export function EditorTable({
	locales,
	entries,
	reviews,
	namespace,
	search,
	filter,
	onUpdateKey,
	onToggleReview,
}: EditorTableProps) {
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

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

	const filteredKeys = useMemo(() => {
		let keys = Object.keys(entries).sort();

		// Search filter
		if (search) {
			const q = search.toLowerCase();
			keys = keys.filter((key) => {
				if (key.toLowerCase().includes(q)) return true;
				const localeValues = entries[key];
				return Object.values(localeValues).some((v) => v.toLowerCase().includes(q));
			});
		}

		// Status filter
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
							<tr className={isExpanded ? "row-expanded" : ""}>
								<td>
									<div
										className="key-cell"
										onClick={() => toggleExpand(key)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												toggleExpand(key);
											}
										}}
										role="button"
										tabIndex={0}
									>
										<span className={`expand-chevron${isExpanded ? " open" : ""}`}>&#9656;</span>
										{key}
									</div>
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
