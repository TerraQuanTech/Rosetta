import type { SaveMode } from "@shared/types";

interface StatusBarProps {
	totalKeys: number;
	missingCount: number;
	connectorConnected: boolean;
	activeNamespace: string | null;
	saveMode: SaveMode;
	pendingCount: number;
	onShowMissing?: () => void;
}

export function StatusBar({
	totalKeys,
	missingCount,
	connectorConnected,
	activeNamespace,
	saveMode,
	pendingCount,
	onShowMissing,
}: StatusBarProps) {
	return (
		<div className="statusbar">
			<div className="statusbar-item">{activeNamespace ?? "No namespace selected"}</div>

			<div className="statusbar-item">{totalKeys} keys</div>

			{missingCount > 0 && (
				<button type="button" className="statusbar-item statusbar-btn" onClick={onShowMissing}>
					<span className="status-dot red" />
					{missingCount} missing
				</button>
			)}

			{missingCount === 0 && totalKeys > 0 && (
				<div className="statusbar-item">
					<span className="status-dot green" />
					Complete
				</div>
			)}

			<div style={{ flex: 1 }} />

			{saveMode === "manual" && (
				<div className="statusbar-item">
					{pendingCount > 0 ? (
						<>
							<span className="status-dot yellow" />
							{pendingCount} unsaved
						</>
					) : (
						<>
							<span className="status-dot green" />
							Saved
						</>
					)}
				</div>
			)}

			{saveMode === "auto" && (
				<div className="statusbar-item">
					<span className="status-dot green" />
					Auto-save
				</div>
			)}

			<div className="statusbar-item">
				<span className={`status-dot ${connectorConnected ? "green" : "yellow"}`} />
				{connectorConnected ? "Live preview" : "No app connected"}
			</div>
		</div>
	);
}
