const args = process.argv.slice(2);
const cliCommand = args[0];
const isCliMode = cliCommand && ["missing", "stats", "complete", "help"].includes(cliCommand);

if (isCliMode) {
	const { handleCliMode } = await import("./cli-mode");
	await handleCliMode();
	process.exit(0);
}

import { homedir } from "node:os";
import { join } from "node:path";
import type { RosettaRPC } from "@shared/types";
import {
	NodeFsAdapter,
	ReviewManager,
	SettingsManager,
	TranslationFileStore,
} from "@terraquantech/rosetta-core";
import { ApplicationMenu, BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import { ConnectorServer } from "./connector";
import { buildApplicationMenu } from "./menu";
import { buildRpcHandlers } from "./rpc-handlers";
import { startWatcher } from "./watcher";

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

ApplicationMenu.setApplicationMenu(buildApplicationMenu());

const DEV_SERVER_PORT = 5174;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const fs = new NodeFsAdapter();
const settingsPath = join(homedir(), ".config", "rosetta", "settings.json");
const settings = new SettingsManager(settingsPath, fs);
await settings.load();

let currentLocalesDir =
	!isCliMode && process.argv[2] ? process.argv[2] : settings.get().defaultLocalesDir || "";
let store = new TranslationFileStore(currentLocalesDir, fs);
const reviews = new ReviewManager(fs);
let watcher: ReturnType<typeof startWatcher> | null = null;

const connector = new ConnectorServer(settings.get().connectorPort);
if (settings.get().connectorEnabled) {
	connector.start();
}

connector.onStatusChange((connected, clientCount) => {
	mainWindow?.webview.rpc?.send.connectorStatusChanged({
		connected,
		clientCount,
		apps: connector.connectedApps,
	});
});

async function loadLocalesDir(dir: string) {
	currentLocalesDir = dir;
	store = new TranslationFileStore(dir, fs);
	await store.load();
	await reviews.load(dir);
	console.log(`Loaded translations from: ${dir}`);

	if (watcher) {
		await watcher.close();
	}

	watcher = startWatcher(dir, store, {
		onFileChanged(_namespace) {
			mainWindow?.webview.rpc?.send.storeUpdated(
				sanitizeForIpc({
					...store.getStore(),
					reviews: reviews.get(),
					localesDir: currentLocalesDir,
				}),
			);
		},
		onReloadNeeded() {
			mainWindow?.webview.rpc?.send.storeUpdated(
				sanitizeForIpc({
					...store.getStore(),
					reviews: reviews.get(),
					localesDir: currentLocalesDir,
				}),
			);
		},
	});

	mainWindow?.webview.rpc?.send.storeUpdated(
		sanitizeForIpc({
			...store.getStore(),
			reviews: reviews.get(),
			localesDir: currentLocalesDir,
		}),
	);
	mainWindow?.setTitle(`Rosetta — ${dir}`);
}

if (currentLocalesDir) {
	try {
		await loadLocalesDir(currentLocalesDir);
	} catch (err) {
		console.error(`Failed to load locales from "${currentLocalesDir}":`, err);
		// Invalid path — clear it so the app shows the folder picker
		currentLocalesDir = "";
		store = new TranslationFileStore("", fs);
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

const url = await getMainViewUrl();
const isMac = (await import("node:os")).platform() === "darwin";

const rpc = BrowserView.defineRPC<RosettaRPC>({
	maxRequestTime: 30000,
	handlers: {
		requests: buildRpcHandlers({
			getStore: () => store,
			reviews,
			connector,
			settings,
			getMainWindow: () => mainWindow,
			getCurrentLocalesDir: () => currentLocalesDir,
			loadLocalesDir,
			isMac,
		}),
		messages: {},
	},
});

const mainWindow = new BrowserWindow({
	title: currentLocalesDir ? `Rosetta — ${currentLocalesDir}` : "Rosetta",
	url,
	titleBarStyle: isMac ? "hiddenInset" : "default",
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100,
	},
	rpc,
});

// On Windows with "default" titlebar, force webview re-layout on resize
// to work around a compositor positioning bug.
if (!isMac) {
	mainWindow.on("resize", () => {
		mainWindow?.webview.rpc?.send.forceRelayout({});
	});
}

ApplicationMenu.on("application-menu-clicked", async (event: any) => {
	const action = event.data?.action;
	if (action === "openFolder") {
		try {
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
		} catch (err) {
			console.error("Failed to open folder dialog:", err);
		}
	}
});

console.log("Rosetta started!");
