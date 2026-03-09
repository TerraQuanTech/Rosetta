export function UnsavedDialog({
	pendingCount,
	onSave,
	onDiscard,
	onCancel,
}: {
	pendingCount: number;
	onSave: () => void;
	onDiscard: () => void;
	onCancel: () => void;
}) {
	return (
		<div
			className="dialog-overlay"
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onCancel();
			}}
		>
			<div className="dialog">
				<h3>Unsaved changes</h3>
				<p style={{ color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
					You have {pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}. What would
					you like to do?
				</p>
				<div className="dialog-actions">
					<button type="button" className="toolbar-btn" onClick={onDiscard}>
						Discard
					</button>
					<button type="button" className="toolbar-btn" onClick={onCancel}>
						Cancel
					</button>
					<button type="button" className="toolbar-btn primary" onClick={onSave}>
						Save All
					</button>
				</div>
			</div>
		</div>
	);
}
