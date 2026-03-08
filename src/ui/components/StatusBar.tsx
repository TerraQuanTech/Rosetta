interface StatusBarProps {
	totalKeys: number;
	missingCount: number;
	connectorConnected: boolean;
	activeNamespace: string | null;
}

export function StatusBar({
	totalKeys,
	missingCount,
	connectorConnected,
	activeNamespace,
}: StatusBarProps) {
	return (
		<div className="statusbar">
			<div className="statusbar-item">{activeNamespace ?? "No namespace selected"}</div>

			<div className="statusbar-item">{totalKeys} keys</div>

			{missingCount > 0 && (
				<div className="statusbar-item">
					<span className="status-dot red" />
					{missingCount} missing
				</div>
			)}

			{missingCount === 0 && totalKeys > 0 && (
				<div className="statusbar-item">
					<span className="status-dot green" />
					Complete
				</div>
			)}

			<div style={{ flex: 1 }} />

			<div className="statusbar-item">
				<span className={`status-dot ${connectorConnected ? "green" : "yellow"}`} />
				{connectorConnected ? "Live preview" : "No app connected"}
			</div>
		</div>
	);
}
