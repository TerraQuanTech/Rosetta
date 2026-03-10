import { getLocaleInfo, searchLocales } from "@/utils/locales";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LocalePickerProps {
	allLocales: string[];
	visibleLocales: string[];
	onChange: (locales: string[]) => void;
	onAddLocale?: (locale: string, copyFrom?: string) => void;
	onRemoveLocale?: (locale: string) => void;
}

function LocaleWithFlag({ code }: { code: string }) {
	const info = getLocaleInfo(code);
	return (
		<span className="locale-flag">
			{info ? (
				<>
					<span className="locale-flag-emoji">{info.flag}</span>
					<span className="locale-flag-code">{code.toUpperCase()}</span>
				</>
			) : (
				code.toUpperCase()
			)}
		</span>
	);
}

export function LocalePicker({
	allLocales,
	visibleLocales,
	onChange,
	onAddLocale,
	onRemoveLocale,
}: LocalePickerProps) {
	const [open, setOpen] = useState(false);
	const [showAddInput, setShowAddInput] = useState(false);
	const [newLocale, setNewLocale] = useState("");
	const [copyFrom, setCopyFrom] = useState<string | undefined>(undefined);
	const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const ref = useRef<HTMLDivElement>(null);

	const suggestions = useMemo(() => {
		if (!newLocale.trim()) return [];
		return searchLocales(newLocale, allLocales);
	}, [newLocale, allLocales]);

	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	useEffect(() => {
		if (showAddInput && inputRef.current) {
			inputRef.current.focus();
		}
	}, [showAddInput]);

	const toggle = useCallback(
		(locale: string) => {
			if (visibleLocales.includes(locale)) {
				if (visibleLocales.length <= 1) return;
				onChange(visibleLocales.filter((l) => l !== locale));
			} else {
				onChange([...visibleLocales, locale]);
			}
		},
		[visibleLocales, onChange],
	);

	const showAll = useCallback(() => {
		onChange([...allLocales]);
	}, [allLocales, onChange]);

	const handleAddFromSuggestion = useCallback(
		(code: string) => {
			if (onAddLocale) {
				onAddLocale(code, copyFrom);
				setNewLocale("");
				setCopyFrom(undefined);
				setShowAddInput(false);
				setShowSuggestions(false);
			}
		},
		[onAddLocale, copyFrom],
	);

	const handleManualAdd = useCallback(() => {
		const code = newLocale.trim().toLowerCase();
		if (code && !allLocales.includes(code)) {
			if (onAddLocale) {
				onAddLocale(code, copyFrom);
				setNewLocale("");
				setCopyFrom(undefined);
				setShowAddInput(false);
				setShowSuggestions(false);
			}
		}
	}, [newLocale, allLocales, onAddLocale, copyFrom]);

	const allVisible = visibleLocales.length === allLocales.length;
	const label = allVisible
		? `${allLocales.length} locales`
		: `${visibleLocales.length}/${allLocales.length} locales`;

	return (
		<div className="locale-picker" ref={ref}>
			<button type="button" className="toolbar-btn" onClick={() => setOpen((o) => !o)}>
				{label}
			</button>
			{open && (
				<div className="locale-picker-dropdown">
					{!allVisible && (
						<>
							<button type="button" className="locale-picker-action" onClick={showAll}>
								Show all
							</button>
							<div className="locale-picker-divider" />
						</>
					)}
					{allLocales.map((locale) => (
						<div key={locale} className="locale-picker-item-row">
							<button type="button" className="locale-picker-item" onClick={() => toggle(locale)}>
								<input
									type="checkbox"
									checked={visibleLocales.includes(locale)}
									readOnly
									tabIndex={-1}
								/>
								<LocaleWithFlag code={locale} />
							</button>
							{onRemoveLocale && allLocales.length > 1 && (
								<button
									type="button"
									className="locale-remove-btn"
									title={`Remove ${locale.toUpperCase()}`}
									onClick={(e) => {
										e.stopPropagation();
										e.preventDefault();
										setConfirmRemove(locale);
										setOpen(false);
									}}
								>
									&times;
								</button>
							)}
						</div>
					))}
					{onAddLocale && (
						<>
							<div className="locale-picker-divider" />
							{showAddInput ? (
								<div className="locale-add-form">
									<div className="locale-add-input-wrapper">
										<input
											ref={inputRef}
											type="text"
											className="search-input"
											placeholder="e.g. de, German, 日本語"
											value={newLocale}
											onChange={(e) => {
												setNewLocale(e.target.value);
												setShowSuggestions(true);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													if (suggestions.length === 1) {
														handleAddFromSuggestion(suggestions[0].code);
													} else {
														handleManualAdd();
													}
												}
												if (e.key === "Escape") {
													setShowAddInput(false);
													setNewLocale("");
													setCopyFrom(undefined);
													setShowSuggestions(false);
												}
											}}
											onFocus={() => setShowSuggestions(true)}
											onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
										/>
										{showSuggestions && suggestions.length > 0 && (
											<div className="locale-suggestions">
												{suggestions.map((suggestion) => (
													<button
														key={suggestion.code}
														type="button"
														className="locale-suggestion-item"
														onClick={() => handleAddFromSuggestion(suggestion.code)}
														title={suggestion.nativeName}
													>
														<span className="locale-flag-emoji">{suggestion.flag}</span>
														<span className="locale-suggestion-name">{suggestion.name}</span>
														<span className="locale-suggestion-code">{suggestion.code}</span>
													</button>
												))}
											</div>
										)}
									</div>
									{allLocales.length > 0 && (
										<>
											<div className="locale-copy-label">Copy from (optional):</div>
											<div className="locale-copy-options">
												{allLocales.map((locale) => (
													<button
														key={locale}
														type="button"
														className="locale-picker-item"
														onClick={() => setCopyFrom(copyFrom === locale ? undefined : locale)}
													>
														<input
															type="checkbox"
															checked={copyFrom === locale}
															readOnly
															tabIndex={-1}
														/>
														<LocaleWithFlag code={locale} />
													</button>
												))}
											</div>
										</>
									)}
									<div className="locale-add-actions">
										<button
											type="button"
											className="toolbar-btn"
											onClick={() => {
												setShowAddInput(false);
												setNewLocale("");
												setCopyFrom(undefined);
												setShowSuggestions(false);
											}}
										>
											Cancel
										</button>
										<button
											type="button"
											className="toolbar-btn primary"
											onClick={handleManualAdd}
											disabled={
												!newLocale.trim() || allLocales.includes(newLocale.trim().toLowerCase())
											}
										>
											Add
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									className="locale-picker-action"
									onClick={() => setShowAddInput(true)}
								>
									+ Add language
								</button>
							)}
						</>
					)}
				</div>
			)}

			{confirmRemove !== null && (
				<div
					className="dialog-overlay"
					onClick={(e) => {
						if (e.target === e.currentTarget) setConfirmRemove(null);
					}}
					onKeyDown={(e) => {
						if (e.key === "Escape") setConfirmRemove(null);
					}}
				>
					<div className="dialog">
						<h3>Remove locale</h3>
						<p style={{ color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
							Remove <strong>{confirmRemove.toUpperCase()}</strong>? This will delete all
							translation files for this locale.
						</p>
						<div className="dialog-actions">
							<button type="button" className="toolbar-btn" onClick={() => setConfirmRemove(null)}>
								Cancel
							</button>
							<button
								type="button"
								className="toolbar-btn"
								style={{ color: "var(--missing)" }}
								onClick={() => {
									onRemoveLocale?.(confirmRemove);
									setConfirmRemove(null);
								}}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
