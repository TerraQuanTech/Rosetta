import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyUpdate, ReviewToggle } from "../../shared/types";
import { isRtlLocale } from "../utils/rtl";

interface ExpandedRowProps {
	translationKey: string;
	locales: string[];
	values: Record<string, string>;
	reviews: Record<string, boolean>;
	namespace: string;
	onUpdateKey: (update: KeyUpdate) => void;
	onToggleReview?: (toggle: ReviewToggle) => void;
}

export function ExpandedRow({
	translationKey,
	locales,
	values,
	reviews,
	namespace,
	onUpdateKey,
	onToggleReview,
}: ExpandedRowProps) {
	return (
		<div className="expanded-row">
			<div className="expanded-row-header">
				<span className="expanded-row-key">{translationKey}</span>
			</div>
			<div className="expanded-row-entries">
				{locales.map((locale) => (
					<ExpandedEntry
						key={locale}
						locale={locale}
						value={values[locale]}
						reviewed={reviews[locale] === true}
						onSave={(value) =>
							onUpdateKey({
								namespace,
								key: translationKey,
								locale,
								value,
							})
						}
						onToggleReview={
							onToggleReview
								? (reviewed) =>
										onToggleReview({
											namespace,
											key: translationKey,
											locale,
											reviewed,
										})
								: undefined
						}
					/>
				))}
			</div>
		</div>
	);
}

function ExpandedEntry({
	locale,
	value,
	reviewed,
	onSave,
	onToggleReview,
}: {
	locale: string;
	value: string | undefined;
	reviewed: boolean;
	onSave: (value: string) => void;
	onToggleReview?: (reviewed: boolean) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? "");
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const isMissing = value === undefined;
	const isEmpty = value === "";
	const isRtl = isRtlLocale(locale);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.style.height = "auto";
			inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
		}
	}, [editing]);

	useEffect(() => {
		if (!editing) setDraft(value ?? "");
	}, [value, editing]);

	const save = useCallback(() => {
		setEditing(false);
		if (draft !== (value ?? "")) {
			onSave(draft);
		}
	}, [draft, value, onSave]);

	const cancel = useCallback(() => {
		setEditing(false);
		setDraft(value ?? "");
	}, [value]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				cancel();
			} else if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				save();
			}
		},
		[cancel, save],
	);

	const statusClass = isMissing ? " missing" : isEmpty ? " empty" : reviewed ? " reviewed" : "";

	return (
		<div className={`expanded-entry${statusClass}`}>
			<div className="expanded-entry-locale">
				{locale.toUpperCase()}
				{onToggleReview && !isMissing && (
					<button
						type="button"
						className={`review-btn inline${reviewed ? " reviewed" : ""}`}
						title={reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
						onClick={() => onToggleReview(!reviewed)}
						aria-label={reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
					>
						{reviewed ? "\u2713" : ""}
					</button>
				)}
			</div>
			<div className="expanded-entry-value">
				{editing ? (
					<textarea
						ref={inputRef}
						className="expanded-entry-input"
						dir={isRtl ? "rtl" : "ltr"}
						value={draft}
						onChange={(e) => {
							setDraft(e.target.value);
							e.target.style.height = "auto";
							e.target.style.height = `${e.target.scrollHeight}px`;
						}}
						onBlur={save}
						onKeyDown={handleKeyDown}
						rows={1}
					/>
				) : (
					<button
						type="button"
						className={`expanded-entry-text${isMissing || isEmpty ? " placeholder" : ""}`}
						onClick={() => setEditing(true)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setEditing(true);
							}
						}}
						tabIndex={0}
					>
						<span dir={isRtl ? "rtl" : "ltr"}>
							{isMissing ? "missing" : isEmpty ? "empty" : value}
						</span>
					</button>
				)}
			</div>
		</div>
	);
}
