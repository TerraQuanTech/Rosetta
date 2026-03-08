import { useCallback, useState } from "react";

interface AddKeyDialogProps {
	namespace: string;
	locales: string[];
	onAdd: (key: string, values: Record<string, string>) => void;
	onClose: () => void;
}

export function AddKeyDialog({ namespace, locales, onAdd, onClose }: AddKeyDialogProps) {
	const [key, setKey] = useState("");
	const [values, setValues] = useState<Record<string, string>>(() =>
		Object.fromEntries(locales.map((l) => [l, ""])),
	);

	const handleSubmit = useCallback(() => {
		if (!key.trim()) return;
		onAdd(key.trim(), values);
		onClose();
	}, [key, values, onAdd, onClose]);

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
			<div className="dialog">
				<h3>Add key to {namespace}</h3>
				<div className="dialog-field">
					<label htmlFor="add-key-name">Key</label>
					<input
						id="add-key-name"
						type="text"
						placeholder="e.g. buttons.submit"
						value={key}
						onChange={(e) => setKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSubmit();
						}}
					/>
				</div>
				{locales.map((locale) => (
					<div className="dialog-field" key={locale}>
						<label htmlFor={`add-key-${locale}`}>{locale.toUpperCase()}</label>
						<input
							id={`add-key-${locale}`}
							type="text"
							placeholder={`Translation for ${locale}`}
							value={values[locale] ?? ""}
							onChange={(e) => setValues((v) => ({ ...v, [locale]: e.target.value }))}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSubmit();
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
						className="toolbar-btn primary"
						onClick={handleSubmit}
						disabled={!key.trim()}
					>
						Add Key
					</button>
				</div>
			</div>
		</div>
	);
}
