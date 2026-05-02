import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
	RosettaSettings,
	TranslationStoreProvider,
} from "@shared/types";
import { Utils } from "electrobun/bun";
import type { ConnectorServer } from "./connector";
import type { ReviewManager } from "./reviews";
import type { SettingsManager } from "./settings";

export interface RpcHandlersDeps {
	getStore: () => TranslationStoreProvider;
	reviews: ReviewManager;
	connector: ConnectorServer;
	settings: SettingsManager;
	getMainWindow: () => any;
	getCurrentLocalesDir: () => string;
	loadLocalesDir: (dir: string) => Promise<void>;
	isMac: boolean;
}

/**
 * Wrap non-ASCII data in an ASCII-safe envelope to avoid Electrobun IPC
 * encoding corruption on Windows. The UI side must unwrap via decodeIpcPayload().
 */
function sanitizeForIpc<T>(obj: T): T {
	if (process.platform !== "win32") return obj;
	const asciiJson = JSON.stringify(obj).replace(
		/[\u0080-\uffff]/g,
		(ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
	return { __encoded: asciiJson } as unknown as T;
}

export function buildRpcHandlers(deps: RpcHandlersDeps) {
	const {
		reviews,
		connector,
		settings,
		getStore,
		getMainWindow,
		getCurrentLocalesDir,
		loadLocalesDir,
		isMac,
	} = deps;

	return {
		getStore: () =>
			sanitizeForIpc({
				...getStore().getStore(),
				reviews: reviews.get(),
				localesDir: getCurrentLocalesDir(),
			}),

		updateKey: async (params: KeyUpdate) => {
			const ok = await getStore().updateKey(params);
			if (ok) {
				connector.broadcastUpdate(params);
				await reviews.clearReview(params.namespace, params.key, params.locale);
			}
			return { ok };
		},

		createKey: async (params: KeyCreate) => {
			const ok = await getStore().createKey(params);
			if (ok) {
				for (const locale of Object.keys(params.values)) {
					connector.broadcastReload(params.namespace, locale);
				}
			}
			return { ok };
		},

		deleteKey: async (params: KeyDelete) => {
			const ok = await getStore().deleteKey(params);
			if (ok) {
				for (const locale of getStore().getStore().locales) {
					connector.broadcastReload(params.namespace, locale);
				}
			}
			return { ok };
		},

		renameKey: async (params: KeyRename) => {
			const ok = await getStore().renameKey(params);
			if (ok) {
				for (const locale of getStore().getStore().locales) {
					connector.broadcastReload(params.namespace, locale);
				}
			}
			return { ok };
		},

		createNamespace: async (params: NamespaceCreate) => {
			const ok = await getStore().createNamespace(params.namespace);
			if (ok) {
				getMainWindow()?.webview.rpc?.send.storeUpdated(
					sanitizeForIpc({
						...getStore().getStore(),
						reviews: reviews.get(),
						localesDir: getCurrentLocalesDir(),
					}),
				);
			}
			return { ok };
		},

		deleteNamespace: async (params: NamespaceDelete) => {
			const ok = await getStore().deleteNamespace(params.namespace);
			if (ok) {
				getMainWindow()?.webview.rpc?.send.storeUpdated(
					sanitizeForIpc({
						...getStore().getStore(),
						reviews: reviews.get(),
						localesDir: getCurrentLocalesDir(),
					}),
				);
			}
			return { ok };
		},

		addLocale: async (params: { locale: string; copyFrom?: string }) => {
			const ok = await getStore().addLocale(params.locale, params.copyFrom);
			if (ok) {
				const store = getStore().getStore();
				getMainWindow()?.webview.rpc?.send.storeUpdated(
					sanitizeForIpc({
						...store,
						reviews: reviews.get(),
						localesDir: getCurrentLocalesDir(),
					}),
				);
				if (store.mode === "pptx") {
					connector.broadcastLocales(store.locales, store.locales[0]);
				}
			}
			return { ok };
		},

		removeLocale: async (params: { locale: string }) => {
			const ok = await getStore().removeLocale(params.locale);
			if (ok) {
				await reviews.removeLocale(params.locale);
				const store = getStore().getStore();
				getMainWindow()?.webview.rpc?.send.storeUpdated(
					sanitizeForIpc({
						...store,
						reviews: reviews.get(),
						localesDir: getCurrentLocalesDir(),
					}),
				);
				if (store.mode === "pptx") {
					connector.broadcastLocales(store.locales, store.locales[0]);
				}
			}
			return { ok };
		},

		openLocalesDir: async () => {
			const paths = await Utils.openFileDialog({
				startingFolder: getCurrentLocalesDir() || "~/",
				canChooseFiles: false,
				canChooseDirectory: true,
				allowsMultipleSelection: false,
			});

			const selected = paths[0];
			if (!selected || selected === "") return { path: null };

			await loadLocalesDir(selected);
			return { path: selected };
		},

		getConnectorStatus: () => ({
			connected: connector.connected,
			port: connector.port,
		}),

		getSettings: () => settings.get(),

		toggleReview: async (params: ReviewToggle) => {
			const ok = await reviews.toggle(params);
			return { ok };
		},

		updateSettings: async (params: Partial<RosettaSettings>) => {
			const updated = await settings.update(params);

			if (params.connectorEnabled !== undefined || params.connectorPort !== undefined) {
				connector.stop();
				if (updated.connectorEnabled) {
					connector.updatePort(updated.connectorPort);
					connector.start();
				}
			}

			getMainWindow()?.webview.rpc?.send.settingsUpdated(updated);
			return { ok: true };
		},

		setWindowTitle: (params: { title: string }) => {
			getMainWindow()?.setTitle(params.title);
			return { ok: true };
		},

		windowReady: () => {
			// HACK: On Windows, jitter the window size to force the compositor
			// to settle. Called by the UI after React's first paint.
			if (!isMac) {
				const mainWindow = getMainWindow();
				const { width, height } = mainWindow.getSize();
				mainWindow.setSize(width + 1, height);
				mainWindow.setSize(width, height);
			}
			return { ok: true };
		},

		installPptxAddin: async () => {
			try {
				const { homedir, platform } = await import("node:os");
				const { join } = await import("node:path");
				const { mkdirSync, writeFileSync, existsSync, readdirSync } = await import("node:fs");

				const home = homedir();
				const os = platform();
				let wefDir: string;

				if (os === "darwin") {
					wefDir = join(home, "Library", "Containers", "com.microsoft.Powerpoint", "Data", "Documents", "wef");
				} else if (os === "win32") {
					const officeBase = join(home, "AppData", "Local", "Microsoft", "Office");
					let version = "16.0";
					if (existsSync(officeBase)) {
						const dirs = readdirSync(officeBase)
							.filter((d) => /^\d+\.\d+$/.test(d))
							.sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a));
						if (dirs.length > 0) {
							version = dirs[0];
						}
					}
					wefDir = join(officeBase, version, "Wef");
				} else {
					return { success: false, message: "PowerPoint add-in sideloading is only supported on macOS and Windows." };
				}

				mkdirSync(wefDir, { recursive: true });
				const manifest = connector.getManifestXml();
				writeFileSync(join(wefDir, "rosetta-translate.xml"), manifest, "utf-8");

				return {
					success: true,
					message: "Add-in installed. Restart PowerPoint, then go to Insert > Add-ins > My Add-ins to activate it.",
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { success: false, message: `Failed to install add-in: ${msg}` };
			}
		},

		openPptxFile: async () => {
			// PPTX opening is handled via the add-in's pptx:sync message, not file dialog
			// This is a placeholder for future offline PPTX file opening
			return { path: null };
		},

		exportPptx: async (_params: { locales: string[]; outputDir: string }) => {
			// Export will be implemented in Phase 3 with the PPTX exporter
			return { ok: false, files: [] };
		},

		installCli: async () => {
			try {
				const { execSync } = await import("node:child_process");
				const { platform } = await import("node:os");
				const { dirname, join } = await import("node:path");

				// Get the executable path and work backwards to find scripts
				// process.execPath: /path/to/App.app/Contents/MacOS/bun
				// We need: /path/to/App.app/Contents/Resources/app/scripts
				const macosDir = dirname(process.execPath); // .../Contents/MacOS
				const contentsDir = dirname(macosDir); // .../Contents
				const scriptDir = join(contentsDir, "Resources", "app", "scripts");

				if (platform() === "win32") {
					execSync(
						`powershell -Command "Start-Process cmd.exe -ArgumentList '/c', 'call \\"${scriptDir}\\install-cli.bat\\"' -Verb RunAs -Wait"`,
						{
							stdio: "pipe",
						},
					);
				} else {
					execSync(`bash "${scriptDir}/install-cli.sh"`, { stdio: "pipe" });
				}

				return {
					success: true,
					message: "CLI installed successfully. You can now use 'rosetta' in your terminal.",
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				const errorMsg =
					typeof err === "object" && err !== null && "stderr" in err
						? err.stderr?.toString() || msg
						: msg;
				return { success: false, message: `Failed to install CLI: ${errorMsg}` };
			}
		},
	};
}
