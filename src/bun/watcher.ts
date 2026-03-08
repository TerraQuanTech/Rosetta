import { watch } from "chokidar";
import type { TranslationFileStore } from "./store";

export interface WatcherEvents {
	onFileChanged: (namespace: string) => void;
	onReloadNeeded: () => void;
}

export function startWatcher(
	localesDir: string,
	store: TranslationFileStore,
	events: WatcherEvents,
) {
	const watcher = watch(localesDir, {
		ignoreInitial: true,
		awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
	});

	watcher.on("change", async (filePath) => {
		if (typeof filePath !== "string") return;
		if (!filePath.endsWith(".json")) return;

		// Skip if we just wrote this file
		if (store.isWriteLocked(filePath)) {
			store.clearWriteLock(filePath);
			return;
		}

		console.log(`[watcher] File changed: ${filePath}`);
		const namespace = await store.reloadFile(filePath);
		if (namespace) {
			events.onFileChanged(namespace);
		}
	});

	watcher.on("add", async (filePath) => {
		if (typeof filePath !== "string") return;
		if (!filePath.endsWith(".json")) return;
		if (store.isWriteLocked(filePath)) return;

		console.log(`[watcher] File added: ${filePath}`);
		await store.load();
		events.onReloadNeeded();
	});

	watcher.on("unlink", async (filePath) => {
		if (typeof filePath !== "string") return;
		if (!filePath.endsWith(".json")) return;

		console.log(`[watcher] File removed: ${filePath}`);
		await store.load();
		events.onReloadNeeded();
	});

	return watcher;
}
