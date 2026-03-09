import type {
	BunRequests,
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
	RpcRequestFn,
	SaveMode,
	TranslationStore,
} from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

let rpcRequest: RpcRequestFn | null = null;

export function setRpcRequest(fn: RpcRequestFn) {
	rpcRequest = fn;
}

function callRpc<M extends keyof BunRequests>(
	method: M,
	params: BunRequests[M]["params"],
): Promise<BunRequests[M]["response"]> {
	if (!rpcRequest) throw new Error("RPC not initialized");
	return rpcRequest(method, params);
}

type StoreUpdateCallback = (store: TranslationStore) => void;
const storeUpdateListeners = new Set<StoreUpdateCallback>();

export function setMessageHandler(register: (handler: StoreUpdateCallback) => void) {
	register((store) => {
		for (const listener of storeUpdateListeners) {
			listener(store);
		}
	});
}

export function useTranslationStore() {
	const [store, setStore] = useState<TranslationStore | null>(null);
	const [loading, setLoading] = useState(true);
	/** Pending changes in manual save mode: "ns\0key\0locale" -> KeyUpdate */
	const [pendingChanges, setPendingChanges] = useState<Map<string, KeyUpdate>>(new Map());
	const saveModeRef = useRef<SaveMode>("auto");

	const refresh = useCallback(async () => {
		try {
			const data = await callRpc("getStore", {});
			setStore(data);
		} catch (err) {
			console.error("Failed to load store:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const handler: StoreUpdateCallback = (newStore) => setStore(newStore);
		storeUpdateListeners.add(handler);
		return () => {
			storeUpdateListeners.delete(handler);
		};
	}, []);

	const updateKey = useCallback(async (update: KeyUpdate) => {
		setStore((prev) => {
			if (!prev) return prev;
			const next = {
				...prev,
				translations: { ...prev.translations },
				reviews: { ...prev.reviews },
			};
			const ns = { ...next.translations[update.namespace] };
			ns[update.key] = { ...ns[update.key], [update.locale]: update.value };
			next.translations[update.namespace] = ns;
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

		if (saveModeRef.current === "manual") {
			const changeKey = `${update.namespace}\0${update.key}\0${update.locale}`;
			setPendingChanges((prev) => {
				const next = new Map(prev);
				next.set(changeKey, update);
				return next;
			});
		} else {
			await callRpc("updateKey", update);
		}
	}, []);

	const saveAll = useCallback(async () => {
		const changes = Array.from(pendingChanges.values());
		if (changes.length === 0) return;

		for (const update of changes) {
			await callRpc("updateKey", update);
		}
		setPendingChanges(new Map());
	}, [pendingChanges]);

	const discardChanges = useCallback(async () => {
		setPendingChanges(new Map());
		await refresh();
	}, [refresh]);

	const setSaveMode = useCallback((mode: SaveMode) => {
		saveModeRef.current = mode;
	}, []);

	const toggleReview = useCallback(async (toggle: ReviewToggle) => {
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

	const createNamespace = useCallback(async (ns: NamespaceCreate) => {
		await callRpc("createNamespace", ns);
	}, []);

	const deleteNamespace = useCallback(async (ns: NamespaceDelete) => {
		await callRpc("deleteNamespace", ns);
	}, []);

	const addLocale = useCallback(async (locale: string, copyFrom?: string) => {
		await callRpc("addLocale", { locale, copyFrom });
	}, []);

	const removeLocale = useCallback(async (locale: string) => {
		await callRpc("removeLocale", { locale });
	}, []);

	const openFolder = useCallback(async () => {
		await callRpc("openLocalesDir", {});
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
		addLocale,
		removeLocale,
		toggleReview,
		openFolder,
		pendingChanges,
		saveAll,
		discardChanges,
		setSaveMode,
	};
}
