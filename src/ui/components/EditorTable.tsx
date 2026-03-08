import { useMemo } from "react";
import type { KeyUpdate } from "../../shared/types";
import { EditableCell } from "./EditableCell";

interface EditorTableProps {
	locales: string[];
	/** flat key -> locale -> value */
	entries: Record<string, Record<string, string>>;
	namespace: string;
	search: string;
	filter: "all" | "missing" | "empty";
	onUpdateKey: (update: KeyUpdate) => void;
}

export function EditorTable({
	locales,
	entries,
	namespace,
	search,
	filter,
	onUpdateKey,
}: EditorTableProps) {
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
		}

		return keys;
	}, [entries, locales, search, filter]);

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
				{filteredKeys.map((key) => (
					<tr key={key}>
						<td>
							<div className="key-cell">{key}</div>
						</td>
						{locales.map((locale) => (
							<EditableCell
								key={`${key}-${locale}`}
								value={entries[key]?.[locale]}
								locale={locale}
								onSave={(value) => onUpdateKey({ namespace, key, locale, value })}
							/>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
