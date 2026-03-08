import { ApplicationMenu, BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { RosettaRPC } from "../shared/types";
import { ConnectorServer } from "./connector";
import { TranslationFileStore } from "./store";
import { startWatcher } from "./watcher";

// --- Configuration ---
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

let currentLocalesDir = process.argv[2] || "";
let store = new TranslationFileStore(currentLocalesDir);
let watcher: ReturnType<typeof startWatcher> | null = null;

const connector = new ConnectorServer();
connector.start();

async function loadLocalesDir(dir: string) {
	currentLocalesDir = dir;
	store = new TranslationFileStore(dir);
	await store.load();
	console.log(`Loaded translations from: ${dir}`);

	// Stop previous watcher
	if (watcher) {
		await watcher.close();
	}

	watcher = startWatcher(dir, store, {
		onFileChanged(_namespace) {
			mainWindow?.webview.rpc?.send.storeUpdated(store.getStore());
		},
		onReloadNeeded() {
			mainWindow?.webview.rpc?.send.storeUpdated(store.getStore());
		},
	});

	// Push the loaded store to the webview
	mainWindow?.webview.rpc?.send.storeUpdated(store.getStore());
}

// Load translations if a directory was provided via CLI
if (currentLocalesDir) {
	await loadLocalesDir(currentLocalesDir);
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
			getStore: () => {
				return store.getStore();
			},

			updateKey: async (params) => {
				const ok = await store.updateKey(params);
				if (ok) {
					connector.broadcastUpdate(params);
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

			openLocalesDir: async () => {
				const paths = await Utils.openFileDialog({
					startingFolder: currentLocalesDir || "~/",
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});

				const selected = paths[0];
				if (!selected || selected === "") {
					return { path: null };
				}

				await loadLocalesDir(selected);
				return { path: selected };
			},

			getConnectorStatus: () => {
				return {
					connected: connector.connected,
					port: connector.port,
				};
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

// --- Application Menu ---
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

// Handle menu actions
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
