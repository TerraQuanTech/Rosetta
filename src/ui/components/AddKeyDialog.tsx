import { isRtlLocale } from "@/utils/rtl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AddKeyDialogProps {
	namespace: string;
	locales: string[];
	existingKeys: string[];
	onAdd: (key: string, values: Record<string, string>) => void;
	onClose: () => void;
}

export function AddKeyDialog({
	namespace,
	locales,
	existingKeys,
	onAdd,
	onClose,
}: AddKeyDialogProps) {
	const [prefix, setPrefix] = useState("");
	const [suffix, setSuffix] = useState("");
	const [values, setValues] = useState<Record<string, string>>(() =>
		Object.fromEntries(locales.map((l) => [l, ""])),
	);
	const [justAdded, setJustAdded] = useState<string | null>(null);
	const suffixRef = useRef<HTMLInputElement>(null);

	// Extract unique prefixes from existing keys (all intermediate dot-paths)
	const prefixes = useMemo(() => {
		const set = new Set<string>();
		for (const key of existingKeys) {
			const parts = key.split(".");
			for (let i = 1; i < parts.length; i++) {
				set.add(parts.slice(0, i).join("."));
			}
		}
		return Array.from(set).sort();
	}, [existingKeys]);

	const suggestions = useMemo(() => {
		if (!prefix) return prefixes.slice(0, 8);
		const q = prefix.toLowerCase();
		return prefixes.filter((p) => p.toLowerCase().includes(q)).slice(0, 8);
	}, [prefix, prefixes]);

	const fullKey = prefix ? `${prefix}.${suffix}` : suffix;

	const resetForm = useCallback(() => {
		setSuffix("");
		setValues(Object.fromEntries(locales.map((l) => [l, ""])));
		setJustAdded(null);
	}, [locales]);

	const handleAdd = useCallback(
		(keepOpen: boolean) => {
			if (!suffix.trim()) return;
			const key = fullKey.trim();
			if (!key) return;
			onAdd(key, values);
			setJustAdded(key);
			if (keepOpen) {
				resetForm();
				setTimeout(() => suffixRef.current?.focus(), 0);
			} else {
				onClose();
			}
		},
		[suffix, fullKey, values, onAdd, onClose, resetForm],
	);

	useEffect(() => {
		suffixRef.current?.focus();
	}, []);

	const [showSuggestions, setShowSuggestions] = useState(false);

	return (
		<div
			className="dialog-overlay"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			<div className="dialog" style={{ minWidth: 400 }}>
				<h3>Add key to {namespace}</h3>

				{justAdded && (
					<div
						style={{
							fontSize: 12,
							color: "var(--success)",
							marginBottom: 8,
							opacity: 0.8,
						}}
					>
						Added: {justAdded}
					</div>
				)}

				<div className="dialog-field">
					<label htmlFor="add-key-prefix">Prefix</label>
					<div style={{ position: "relative" }}>
						<input
							id="add-key-prefix"
							type="text"
							placeholder="e.g. buttons"
							value={prefix}
							onChange={(e) => {
								setPrefix(e.target.value);
								setShowSuggestions(true);
							}}
							onFocus={() => setShowSuggestions(true)}
							onBlur={() => {
								// Delay to allow click on suggestion
								setTimeout(() => setShowSuggestions(false), 150);
							}}
							autoComplete="off"
						/>
						{showSuggestions && suggestions.length > 0 && (
							<div className="prefix-suggestions">
								{suggestions.map((s) => (
									<button
										type="button"
										key={s}
										className="prefix-suggestion-item"
										onMouseDown={(e) => {
											e.preventDefault();
											setPrefix(s);
											setShowSuggestions(false);
											suffixRef.current?.focus();
										}}
									>
										{s}
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="dialog-field">
					<label htmlFor="add-key-suffix">Key{prefix ? ` (after ${prefix}.)` : ""}</label>
					<input
						ref={suffixRef}
						id="add-key-suffix"
						type="text"
						placeholder={prefix ? "e.g. submit" : "e.g. buttons.submit"}
						value={suffix}
						onChange={(e) => setSuffix(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && e.metaKey) {
								handleAdd(false);
							} else if (e.key === "Enter") {
								handleAdd(true);
							}
						}}
					/>
					{fullKey && (
						<div
							style={{
								fontSize: 11,
								color: "var(--text-muted)",
								marginTop: 2,
							}}
						>
							{fullKey}
						</div>
					)}
				</div>

				{locales.map((locale) => (
					<div className="dialog-field" key={locale}>
						<label htmlFor={`add-key-${locale}`}>{locale.toUpperCase()}</label>
						<input
							id={`add-key-${locale}`}
							type="text"
							dir={isRtlLocale(locale) ? "rtl" : "ltr"}
							placeholder={`Translation for ${locale}`}
							value={values[locale] ?? ""}
							onChange={(e) => setValues((v) => ({ ...v, [locale]: e.target.value }))}
							onKeyDown={(e) => {
								if (e.key === "Enter" && e.metaKey) {
									handleAdd(false);
								} else if (e.key === "Enter") {
									handleAdd(true);
								}
							}}
						/>
					</div>
				))}

				<div className="dialog-actions">
					<button type="button" className="toolbar-btn" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="toolbar-btn"
						onClick={() => handleAdd(true)}
						disabled={!suffix.trim()}
						title="Add and keep dialog open (Enter)"
					>
						Add Another
					</button>
					<button
						type="button"
						className="toolbar-btn primary"
						onClick={() => handleAdd(false)}
						disabled={!suffix.trim()}
						title="Add and close (⌘+Enter)"
					>
						Add &amp; Close
					</button>
				</div>
			</div>
		</div>
	);
}
