import type { ReviewToggle } from "../../shared/types";
import { EditorTable } from "./EditorTable";

export function GlobalSearchResults({
	results,
	reviews,
	locales,
	search,
	filter,
	onUpdateKey,
	onToggleReview,
	onFocusNamespace,
	onFocusKey,
}: {
	results: Record<string, Record<string, Record<string, string>>>;
	reviews: Record<string, Record<string, Record<string, boolean>>>;
	locales: string[];
	search: string;
	filter: "all" | "missing" | "empty" | "unreviewed";
	onUpdateKey: (update: { namespace: string; key: string; locale: string; value: string }) => void;
	onToggleReview: (toggle: ReviewToggle) => void;
	onFocusNamespace: (e: React.MouseEvent, ns: string) => void;
	onFocusKey: (e: React.MouseEvent, key: string, namespace?: string) => void;
}) {
	const namespaces = Object.keys(results)
		.filter((ns) => {
			const entries = results[ns];
			let keys = Object.keys(entries);
			if (keys.length === 0) return false;

			if (search) {
				const q = search.toLowerCase();
				keys = keys.filter((key) => {
					if (key.toLowerCase().includes(q)) return true;
					return Object.values(entries[key]).some((v) => v.toLowerCase().includes(q));
				});
			}

			if (filter === "missing") {
				keys = keys.filter((key) => locales.some((l) => entries[key][l] === undefined));
			} else if (filter === "empty") {
				keys = keys.filter((key) =>
					locales.some((l) => entries[key][l] === undefined || entries[key][l] === ""),
				);
			} else if (filter === "unreviewed") {
				keys = keys.filter((key) =>
					locales.some((l) => {
						const hasValue = entries[key][l] !== undefined;
						const isReviewed = reviews?.[ns]?.[key]?.[l] === true;
						return hasValue && !isReviewed;
					}),
				);
			}

			return keys.length > 0;
		})
		.sort();

	if (namespaces.length === 0) {
		return (
			<div className="empty-state">
				<h2>No keys</h2>
				<p>
					{search
						? `No translation keys match "${search}" across any namespace.`
						: "No translation keys found."}
				</p>
			</div>
		);
	}

	return (
		<div className="global-search-results">
			{namespaces.map((ns) => (
				<div key={ns}>
					<div
						className="search-result-namespace"
						onContextMenu={(e) => {
							onFocusNamespace(e, ns);
						}}
					>
						{ns}
					</div>
					<EditorTable
						locales={locales}
						entries={results[ns]}
						reviews={reviews?.[ns]}
						namespace={ns}
						search={search}
						filter={filter}
						onUpdateKey={onUpdateKey}
						onToggleReview={onToggleReview}
						onFocusKey={(e, key) => onFocusKey(e, key, ns)}
						hideEmptyFiltered
					/>
				</div>
			))}
		</div>
	);
}
