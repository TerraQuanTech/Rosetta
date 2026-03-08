import { ApplicationMenu, BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { RosettaRPC } from "../shared/types";
import { ConnectorServer } from "./connector";
import { ReviewManager } from "./reviews";
import { SettingsManager } from "./settings";
import { TranslationFileStore } from "./store";
import { startWatcher } from "./watcher";

// --- Application Menu (set early before any async work) ---
ApplicationMenu.setApplicationMenu([
	{
		label: "Rosetta",
		submenu: [
			{ role: "about" },
			{ type: "divider" },
			{ role: "hide" },
			{ role: "hideOthers" },
			{ role: "showAll" },
			{ type: "divider" },
			{ role: "quit" },
		],
	},
	{
		label: "File",
		submenu: [
			{
				label: "Open Locales Folder...",
				action: "openFolder",
				accelerator: "cmd+o",
			},
		],
	},
	{
		label: "Edit",
		submenu: [
			{ role: "undo" },
			{ role: "redo" },
			{ type: "divider" },
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "selectAll" },
		],
	},
	{
		label: "Window",
		submenu: [
			{ role: "minimize" },
			{ role: "zoom" },
			{ role: "close" },
			{ type: "divider" },
			{ role: "toggleFullScreen" },
		],
	},
]);

// --- Configuration ---
const DEV_SERVER_PORT = 5174;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// --- Settings ---
const settings = new SettingsManager();
await settings.load();

let currentLocalesDir = process.argv[2] || settings.get().defaultLocalesDir || "";
let store = new TranslationFileStore(currentLocalesDir);
const reviews = new ReviewManager();
let watcher: ReturnType<typeof startWatcher> | null = null;

const connector = new ConnectorServer(settings.get().connectorPort);
if (settings.get().connectorEnabled) {
	connector.start();
}

// Forward connector status changes to UI
connector.onStatusChange((connected, clientCount) => {
	mainWindow?.webview.rpc?.send.connectorStatusChanged({
		connected,
		clientCount,
		apps: connector.connectedApps,
	});
});

async function loadLocalesDir(dir: string) {
	currentLocalesDir = dir;
	store = new TranslationFileStore(dir);
	await store.load();
	await reviews.load(dir);
	console.log(`Loaded translations from: ${dir}`);

	if (watcher) {
		await watcher.close();
	}

	watcher = startWatcher(dir, store, {
		onFileChanged(_namespace) {
			mainWindow?.webview.rpc?.send.storeUpdated({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir });
		},
		onReloadNeeded() {
			mainWindow?.webview.rpc?.send.storeUpdated({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir });
		},
	});

	mainWindow?.webview.rpc?.send.storeUpdated({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir });
}

if (currentLocalesDir) {
	try {
		await loadLocalesDir(currentLocalesDir);
	} catch (err) {
		console.error(`Failed to load locales from "${currentLocalesDir}":`, err);
		// Invalid path — clear it so the app shows the folder picker
		currentLocalesDir = "";
		store = new TranslationFileStore("");
		// Also clear the bad setting so it doesn't crash again on next launch
		await settings.update({ defaultLocalesDir: null });
	}
}

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log("Vite dev server not running. Using built assets.");
		}
	}
	return "views://mainview/index.html";
}

// --- RPC Setup ---
const rpc = BrowserView.defineRPC<RosettaRPC>({
	maxRequestTime: 30000,
	handlers: {
		requests: {
			getStore: () => ({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir }),

			updateKey: async (params) => {
				const ok = await store.updateKey(params);
				if (ok) {
					connector.broadcastUpdate(params);
					// Clear review when value changes
					await reviews.clearReview(params.namespace, params.key, params.locale);
				}
				return { ok };
			},

			createKey: async (params) => {
				const ok = await store.createKey(params);
				if (ok) {
					for (const locale of Object.keys(params.values)) {
						connector.broadcastReload(params.namespace, locale);
					}
				}
				return { ok };
			},

			deleteKey: async (params) => {
				const ok = await store.deleteKey(params);
				if (ok) {
					for (const locale of store.getStore().locales) {
						connector.broadcastReload(params.namespace, locale);
					}
				}
				return { ok };
			},

			renameKey: async (params) => {
				const ok = await store.renameKey(params);
				if (ok) {
					for (const locale of store.getStore().locales) {
						connector.broadcastReload(params.namespace, locale);
					}
				}
				return { ok };
			},

			createNamespace: async (params) => {
				const ok = await store.createNamespace(params.namespace);
				if (ok) {
					mainWindow?.webview.rpc?.send.storeUpdated({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir });
				}
				return { ok };
			},

			deleteNamespace: async (params) => {
				const ok = await store.deleteNamespace(params.namespace);
				if (ok) {
					mainWindow?.webview.rpc?.send.storeUpdated({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir });
				}
				return { ok };
			},

			addLocale: async (params) => {
				const ok = await store.addLocale(params.locale);
				if (ok) {
					mainWindow?.webview.rpc?.send.storeUpdated({ ...store.getStore(), reviews: reviews.get(), localesDir: currentLocalesDir });
				}
				return { ok };
			},

			openLocalesDir: async () => {
				const paths = await Utils.openFileDialog({
					startingFolder: currentLocalesDir || "~/",
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

			toggleReview: async (params) => {
				const ok = await reviews.toggle(params);
				return { ok };
			},

			updateSettings: async (params) => {
				const updated = await settings.update(params);

				// Handle connector changes
				if (params.connectorEnabled !== undefined || params.connectorPort !== undefined) {
					connector.stop();
					if (updated.connectorEnabled) {
						connector.updatePort(updated.connectorPort);
						connector.start();
					}
				}

				mainWindow?.webview.rpc?.send.settingsUpdated(updated);
				return { ok: true };
			},
		},
		messages: {},
	},
});

// --- Create window ---
const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Rosetta — i18n Editor",
	url,
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100,
	},
	rpc,
});

ApplicationMenu.on("application-menu-clicked", async (event: any) => {
	if (event.action === "openFolder") {
		const paths = await Utils.openFileDialog({
			startingFolder: currentLocalesDir || "~/",
			canChooseFiles: false,
			canChooseDirectory: true,
			allowsMultipleSelection: false,
		});
		const selected = paths[0];
		if (selected && selected !== "") {
			await loadLocalesDir(selected);
		}
	}
});

console.log("Rosetta started!");
