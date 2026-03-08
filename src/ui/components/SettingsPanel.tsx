import { useCallback, useState } from "react";
import type { RosettaSettings } from "../../shared/types";

interface SettingsPanelProps {
	settings: RosettaSettings;
	onUpdate: (partial: Partial<RosettaSettings>) => void;
	onBrowseFolder: () => void;
	currentDir: string | null;
	onInstallCli?: () => Promise<{ success: boolean; message: string }>;
}

export function SettingsPanel({
	settings,
	onUpdate,
	onBrowseFolder,
	currentDir,
	onInstallCli,
}: SettingsPanelProps) {
	const [cliInstalling, setCliInstalling] = useState(false);
	const [cliMessage, setCliMessage] = useState<string | null>(null);

	const setTheme = useCallback(
		(theme: RosettaSettings["theme"]) => onUpdate({ theme }),
		[onUpdate],
	);

	const handleInstallCli = useCallback(async () => {
		if (!onInstallCli) return;
		setCliInstalling(true);
		try {
			const result = await onInstallCli();
			setCliMessage(result.message);
			setTimeout(() => setCliMessage(null), 4000);
		} finally {
			setCliInstalling(false);
		}
	}, [onInstallCli]);

	return (
		<div className="settings-panel">
			<h2>Settings</h2>

			<div className="settings-section">
				<h3>General</h3>

				<div className="settings-field">
					<div>
						<div className="settings-field-label">Default locales directory</div>
						<div className="settings-field-desc">
							{settings.defaultLocalesDir || "Not set — will show file picker on launch"}
						</div>
					</div>
					<div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
						<button type="button" className="toolbar-btn" onClick={onBrowseFolder}>
							Browse
						</button>
						{currentDir && (
							<button
								type="button"
								className="toolbar-btn"
								onClick={() => onUpdate({ defaultLocalesDir: currentDir })}
							>
								Use current
							</button>
						)}
						{settings.defaultLocalesDir && (
							<button
								type="button"
								className="toolbar-btn"
								onClick={() => onUpdate({ defaultLocalesDir: null })}
							>
								Clear
							</button>
						)}
					</div>
				</div>
			</div>

			<div className="settings-section">
				<h3>Appearance</h3>

				<div className="settings-field">
					<div className="settings-field-label">Theme</div>
					<div className="segmented-control">
						<button
							type="button"
							className={settings.theme === "system" ? "active" : ""}
							onClick={() => setTheme("system")}
						>
							System
						</button>
						<button
							type="button"
							className={settings.theme === "light" ? "active" : ""}
							onClick={() => setTheme("light")}
						>
							Light
						</button>
						<button
							type="button"
							className={settings.theme === "dark" ? "active" : ""}
							onClick={() => setTheme("dark")}
						>
							Dark
						</button>
					</div>
				</div>
			</div>

			<div className="settings-section">
				<h3>Editor</h3>

				<div className="settings-field">
					<div>
						<div className="settings-field-label">Save mode</div>
						<div className="settings-field-desc">
							{settings.saveMode === "auto"
								? "Changes are written to disk immediately"
								: "Changes are buffered until you save manually"}
						</div>
					</div>
					<div className="segmented-control">
						<button
							type="button"
							className={settings.saveMode === "auto" ? "active" : ""}
							onClick={() => onUpdate({ saveMode: "auto" })}
						>
							Auto
						</button>
						<button
							type="button"
							className={settings.saveMode === "manual" ? "active" : ""}
							onClick={() => onUpdate({ saveMode: "manual" })}
						>
							Manual
						</button>
					</div>
				</div>
			</div>

			<div className="settings-section">
				<h3>Command Line</h3>

				<div className="settings-field">
					<div>
						<div className="settings-field-label">Install CLI</div>
						<div className="settings-field-desc">
							Create a <code>rosetta</code> command-line tool for stats, missing, and complete
						</div>
					</div>
					<div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-start" }}>
						<button
							type="button"
							className="toolbar-btn"
							onClick={handleInstallCli}
							disabled={cliInstalling}
						>
							{cliInstalling ? "Installing..." : "Install CLI"}
						</button>
						{cliMessage && (
							<div
								style={{
									fontSize: 12,
									color: cliMessage.includes("success") ? "#28a745" : "#dc3545",
									marginTop: 4,
								}}
							>
								{cliMessage}
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="settings-section">
				<h3>Live Preview Connector</h3>

				<div className="settings-field">
					<div>
						<div className="settings-field-label">Enabled</div>
						<div className="settings-field-desc">
							Start a WebSocket server for live preview in Electron apps
						</div>
					</div>
					<div
						className={`toggle-switch ${settings.connectorEnabled ? "on" : ""}`}
						onClick={() => onUpdate({ connectorEnabled: !settings.connectorEnabled })}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onUpdate({ connectorEnabled: !settings.connectorEnabled });
							}
						}}
						role="switch"
						aria-checked={settings.connectorEnabled}
						tabIndex={0}
					/>
				</div>

				{settings.connectorEnabled && (
					<div className="settings-field">
						<div className="settings-field-label">Port</div>
						<input
							type="number"
							value={settings.connectorPort}
							min={1024}
							max={65535}
							onChange={(e) => {
								const port = Number.parseInt(e.target.value, 10);
								if (port >= 1024 && port <= 65535) {
									onUpdate({ connectorPort: port });
								}
							}}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
