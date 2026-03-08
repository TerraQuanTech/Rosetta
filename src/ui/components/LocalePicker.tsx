import { useCallback, useEffect, useRef, useState } from "react";

interface LocalePickerProps {
	allLocales: string[];
	visibleLocales: string[];
	onChange: (locales: string[]) => void;
	onAddLocale?: (locale: string, copyFrom?: string) => void;
}

export function LocalePicker({ allLocales, visibleLocales, onChange, onAddLocale }: LocalePickerProps) {
	const [open, setOpen] = useState(false);
	const [showAddInput, setShowAddInput] = useState(false);
	const [newLocale, setNewLocale] = useState("");
	const [copyFrom, setCopyFrom] = useState<string | undefined>(undefined);
	const ref = useRef<HTMLDivElement>(null);

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

	const toggle = useCallback(
		(locale: string) => {
			if (visibleLocales.includes(locale)) {
				// Don't allow deselecting the last locale
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
						<button
							type="button"
							key={locale}
							className="locale-picker-item"
							onClick={() => toggle(locale)}
						>
							<input
								type="checkbox"
								checked={visibleLocales.includes(locale)}
								readOnly
								tabIndex={-1}
							/>
							{locale.toUpperCase()}
						</button>
					))}
					{onAddLocale && (
						<>
							<div className="locale-picker-divider" />
							{showAddInput ? (
								<div style={{ padding: "8px" }}>
									<input
										type="text"
										className="search-input"
										placeholder="e.g. de"
										value={newLocale}
										onChange={(e) => setNewLocale(e.target.value.toLowerCase())}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												const code = newLocale.trim();
												if (code && !allLocales.includes(code)) {
													onAddLocale(code, copyFrom);
													setNewLocale("");
													setCopyFrom(undefined);
													setShowAddInput(false);
												}
											}
											if (e.key === "Escape") {
												setShowAddInput(false);
												setNewLocale("");
												setCopyFrom(undefined);
											}
										}}
										style={{ width: "100%", height: 24, fontSize: 12, marginBottom: 8 }}
										autoFocus
									/>
									{allLocales.length > 0 && (
										<div style={{ fontSize: 12, marginBottom: 6, color: "#999" }}>
											Copy from (optional):
										</div>
									)}
									{allLocales.map((locale) => (
										<button
											key={locale}
											type="button"
											className="locale-picker-item"
											onClick={() => setCopyFrom(copyFrom === locale ? undefined : locale)}
											style={{ fontSize: 12, paddingLeft: 12 }}
										>
											<input
												type="checkbox"
												checked={copyFrom === locale}
												readOnly
												tabIndex={-1}
											/>
											{locale.toUpperCase()}
										</button>
									))}
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
		</div>
	);
}
