import { useCallback, useEffect, useRef, useState } from "react";

interface LocalePickerProps {
	allLocales: string[];
	visibleLocales: string[];
	onChange: (locales: string[]) => void;
}

export function LocalePicker({ allLocales, visibleLocales, onChange }: LocalePickerProps) {
	const [open, setOpen] = useState(false);
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
				</div>
			)}
		</div>
	);
}
