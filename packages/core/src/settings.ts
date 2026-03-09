import { dirname } from "node:path";
import type { FileSystemAdapter } from "./fs-adapter";
import type { RosettaSettings } from "./types";

export const DEFAULT_SETTINGS: RosettaSettings = {
	defaultLocalesDir: null,
	visibleLocales: null,
	connectorPort: 4871,
	connectorEnabled: true,
	theme: "system",
	saveMode: "auto",
};

export class SettingsManager {
	private settings: RosettaSettings = { ...DEFAULT_SETTINGS };
	private settingsPath: string;
	private fs: FileSystemAdapter;

	constructor(settingsPath: string, fs: FileSystemAdapter) {
		this.settingsPath = settingsPath;
		this.fs = fs;
	}

	async load(): Promise<RosettaSettings> {
		try {
			const content = await this.fs.readFile(this.settingsPath);
			const parsed = JSON.parse(content);
			this.settings = { ...DEFAULT_SETTINGS, ...parsed };
		} catch {
			this.settings = { ...DEFAULT_SETTINGS };
		}
		return this.settings;
	}

	get(): RosettaSettings {
		return this.settings;
	}

	async update(partial: Partial<RosettaSettings>): Promise<RosettaSettings> {
		this.settings = { ...this.settings, ...partial };
		try {
			await this.fs.mkdir(dirname(this.settingsPath));
			await this.fs.writeFile(
				this.settingsPath,
				`${JSON.stringify(this.settings, null, "\t")}\n`,
			);
		} catch (err) {
			console.error("Failed to save settings:", err);
		}
		return this.settings;
	}
}
