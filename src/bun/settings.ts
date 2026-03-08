import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { RosettaSettings } from "../shared/types";

const SETTINGS_PATH = join(homedir(), ".config", "rosetta", "settings.json");

const DEFAULT_SETTINGS: RosettaSettings = {
	defaultLocalesDir: null,
	visibleLocales: null,
	connectorPort: 4871,
	connectorEnabled: true,
	theme: "auto",
};

export class SettingsManager {
	private settings: RosettaSettings = { ...DEFAULT_SETTINGS };

	async load(): Promise<RosettaSettings> {
		try {
			const content = await readFile(SETTINGS_PATH, "utf-8");
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
			await mkdir(dirname(SETTINGS_PATH), { recursive: true });
			await writeFile(SETTINGS_PATH, `${JSON.stringify(this.settings, null, "\t")}\n`, "utf-8");
		} catch (err) {
			console.error("Failed to save settings:", err);
		}
		return this.settings;
	}
}
