import { useCallback, useEffect, useState } from "react";
import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
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
		// Optimistic update — also clear review status when value changes
		setStore((prev) => {
			if (!prev) return prev;
			const next = { ...prev, translations: { ...prev.translations }, reviews: { ...prev.reviews } };
			const ns = { ...next.translations[update.namespace] };
			ns[update.key] = { ...ns[update.key], [update.locale]: update.value };
			next.translations[update.namespace] = ns;
			// Clear review for changed cell
			if (next.reviews[update.namespace]?.[update.key]?.[update.locale]) {
				const revNs = { ...next.reviews[update.namespace] };
				const revKey = { ...revNs[update.key] };
				delete revKey[update.locale];
				if (Object.keys(revKey).length === 0) {
					delete revNs[update.key];
				} else {
					revNs[update.key] = revKey;
				}
				if (Object.keys(revNs).length === 0) {
					delete next.reviews[update.namespace];
				} else {
					next.reviews[update.namespace] = revNs;
				}
			}
			return next;
		});

		await callRpc("updateKey", update);
	}, []);

	const toggleReview = useCallback(async (toggle: ReviewToggle) => {
		// Optimistic update
		setStore((prev) => {
			if (!prev) return prev;
			const next = { ...prev, reviews: { ...prev.reviews } };
			if (toggle.reviewed) {
				if (!next.reviews[toggle.namespace]) next.reviews[toggle.namespace] = {};
				next.reviews[toggle.namespace] = { ...next.reviews[toggle.namespace] };
				next.reviews[toggle.namespace][toggle.key] = {
					...next.reviews[toggle.namespace][toggle.key],
					[toggle.locale]: true,
				};
			} else {
				if (next.reviews[toggle.namespace]?.[toggle.key]) {
					const revNs = { ...next.reviews[toggle.namespace] };
					const revKey = { ...revNs[toggle.key] };
					delete revKey[toggle.locale];
					if (Object.keys(revKey).length === 0) {
						delete revNs[toggle.key];
					} else {
						revNs[toggle.key] = revKey;
					}
					if (Object.keys(revNs).length === 0) {
						delete next.reviews[toggle.namespace];
					} else {
						next.reviews[toggle.namespace] = revNs;
					}
				}
			}
			return next;
		});

		await callRpc("toggleReview", toggle);
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

	const createNamespace = useCallback(
		async (ns: NamespaceCreate) => {
			await callRpc("createNamespace", ns);
			// Store update pushed via storeUpdated message
		},
		[],
	);

	const deleteNamespace = useCallback(
		async (ns: NamespaceDelete) => {
			await callRpc("deleteNamespace", ns);
			// Store update pushed via storeUpdated message
		},
		[],
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
		createNamespace,
		deleteNamespace,
		toggleReview,
		openFolder,
	};
}
