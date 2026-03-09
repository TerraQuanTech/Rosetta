import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
	RosettaSettings,
} from "@shared/types";
import { Utils } from "electrobun/bun";
import type { ConnectorServer } from "./connector";
import type { ReviewManager } from "./reviews";
import type { SettingsManager } from "./settings";
import type { TranslationFileStore } from "./store";

export interface RpcHandlersDeps {
	getStore: () => TranslationFileStore;
	reviews: ReviewManager;
	connector: ConnectorServer;
	settings: SettingsManager;
	getMainWindow: () => any;
	getCurrentLocalesDir: () => string;
	loadLocalesDir: (dir: string) => Promise<void>;
	isMac: boolean;
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
		getStore: () => ({
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
				getMainWindow()?.webview.rpc?.send.storeUpdated({
					...getStore().getStore(),
					reviews: reviews.get(),
					localesDir: getCurrentLocalesDir(),
				});
			}
			return { ok };
		},

		deleteNamespace: async (params: NamespaceDelete) => {
			const ok = await getStore().deleteNamespace(params.namespace);
			if (ok) {
				getMainWindow()?.webview.rpc?.send.storeUpdated({
					...getStore().getStore(),
					reviews: reviews.get(),
					localesDir: getCurrentLocalesDir(),
				});
			}
			return { ok };
		},

		addLocale: async (params: { locale: string; copyFrom?: string }) => {
			const ok = await getStore().addLocale(params.locale, params.copyFrom);
			if (ok) {
				getMainWindow()?.webview.rpc?.send.storeUpdated({
					...getStore().getStore(),
					reviews: reviews.get(),
					localesDir: getCurrentLocalesDir(),
				});
			}
			return { ok };
		},

		removeLocale: async (params: { locale: string }) => {
			const ok = await getStore().removeLocale(params.locale);
			if (ok) {
				getMainWindow()?.webview.rpc?.send.storeUpdated({
					...getStore().getStore(),
					reviews: reviews.get(),
					localesDir: getCurrentLocalesDir(),
				});
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
