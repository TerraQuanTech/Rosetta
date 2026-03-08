import { useCallback, useEffect, useState } from "react";
import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	TranslationStore,
} from "../../shared/types";

// --- RPC bridge (wired in main.tsx) ---
let rpcRequest: ((method: string, params: unknown) => Promise<unknown>) | null = null;

export function setRpcRequest(fn: (method: string, params: unknown) => Promise<unknown>) {
	rpcRequest = fn;
}

async function callRpc<T>(method: string, params: unknown = {}): Promise<T> {
	if (rpcRequest) {
		return rpcRequest(method, params) as Promise<T>;
	}
	throw new Error("RPC not initialized");
}

// --- Message bridge (wired in main.tsx) ---
type StoreUpdateCallback = (store: TranslationStore) => void;
const storeUpdateListeners = new Set<StoreUpdateCallback>();

export function setMessageHandler(register: (handler: StoreUpdateCallback) => void) {
	register((store) => {
		for (const listener of storeUpdateListeners) {
			listener(store);
		}
	});
}

// --- Hook ---
export function useTranslationStore() {
	const [store, setStore] = useState<TranslationStore | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const data = await callRpc<TranslationStore>("getStore");
			setStore(data);
		} catch (err) {
			console.error("Failed to load store:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	// Listen for bun-side store updates
	useEffect(() => {
		const handler: StoreUpdateCallback = (newStore) => setStore(newStore);
		storeUpdateListeners.add(handler);
		return () => {
			storeUpdateListeners.delete(handler);
		};
	}, []);

	const updateKey = useCallback(async (update: KeyUpdate) => {
		// Optimistic update
		setStore((prev) => {
			if (!prev) return prev;
			const next = { ...prev, translations: { ...prev.translations } };
			const ns = { ...next.translations[update.namespace] };
			ns[update.key] = { ...ns[update.key], [update.locale]: update.value };
			next.translations[update.namespace] = ns;
			return next;
		});

		await callRpc("updateKey", update);
	}, []);

	const createKey = useCallback(
		async (create: KeyCreate) => {
			await callRpc("createKey", create);
			await refresh();
		},
		[refresh],
	);

	const deleteKey = useCallback(
		async (del: KeyDelete) => {
			await callRpc("deleteKey", del);
			await refresh();
		},
		[refresh],
	);

	const renameKey = useCallback(
		async (rename: KeyRename) => {
			await callRpc("renameKey", rename);
			await refresh();
		},
		[refresh],
	);

	const openFolder = useCallback(async () => {
		await callRpc<{ path: string | null }>("openLocalesDir");
		// The bun side will push the updated store via storeUpdated message
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return {
		store,
		loading,
		refresh,
		updateKey,
		createKey,
		deleteKey,
		renameKey,
		openFolder,
	};
}
