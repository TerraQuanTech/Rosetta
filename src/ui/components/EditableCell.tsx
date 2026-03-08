import { useCallback, useEffect, useRef, useState } from "react";

interface EditableCellProps {
	value: string | undefined;
	locale: string;
	reviewed?: boolean;
	onSave: (value: string) => void;
	onToggleReview?: (reviewed: boolean) => void;
}

export function EditableCell({ value, locale: _locale, reviewed, onSave, onToggleReview }: EditableCellProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? "");
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const isMissing = value === undefined;
	const isEmpty = value === "";

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
			inputRef.current.style.height = "auto";
			inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
		}
	}, [editing]);

	useEffect(() => {
		if (!editing) {
			setDraft(value ?? "");
		}
	}, [value, editing]);

	const startEdit = useCallback(() => {
		setDraft(value ?? "");
		setEditing(true);
	}, [value]);

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
			} else if (e.key === "Tab") {
				e.preventDefault();
				save();
			}
		},
		[cancel, save],
	);

	const cellClass = `value-cell${isMissing ? " missing" : ""}${isEmpty ? " empty" : ""}${reviewed ? " reviewed" : ""}`;

	if (editing) {
		return (
			<td className={cellClass}>
				<textarea
					ref={inputRef}
					className="value-input"
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
			</td>
		);
	}

	return (
		<td
			className={cellClass}
			onClick={startEdit}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					startEdit();
				}
			}}
		>
			{isMissing ? (
				<div className="value-display placeholder">missing</div>
			) : isEmpty ? (
				<div className="value-display placeholder empty-placeholder">empty</div>
			) : (
				<div className="value-display">{value}</div>
			)}
			{onToggleReview && !isMissing && (
				<button
					type="button"
					className={`review-btn${reviewed ? " reviewed" : ""}`}
					title={reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
					onClick={(e) => {
						e.stopPropagation();
						onToggleReview(!reviewed);
					}}
					aria-label={reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
				>
					{reviewed ? "\u2713" : ""}
				</button>
			)}
		</td>
	);
}
