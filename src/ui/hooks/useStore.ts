import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
	SaveMode,
	TranslationStore,
} from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRpcTransport } from "../rpc-transport";

export function useTranslationStore() {
	const transport = useRpcTransport();

	const [store, setStore] = useState<TranslationStore | null>(null);
	const [loading, setLoading] = useState(true);
	/** Pending changes in manual save mode: "ns\0key\0locale" -> KeyUpdate */
	const [pendingChanges, setPendingChanges] = useState<Map<string, KeyUpdate>>(new Map());
	const saveModeRef = useRef<SaveMode>("auto");

	const refresh = useCallback(async () => {
		try {
			const data = await transport.request("getStore", {});
			setStore(data);
		} catch (err) {
			console.error("Failed to load store:", err);
		} finally {
			setLoading(false);
		}
	}, [transport]);

	useEffect(() => {
		return transport.onMessage("storeUpdated", (newStore) => setStore(newStore));
	}, [transport]);

	const updateKey = useCallback(
		async (update: KeyUpdate) => {
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
				await transport.request("updateKey", update);
			}
		},
		[transport],
	);

	const saveAll = useCallback(async () => {
		const changes = Array.from(pendingChanges.values());
		if (changes.length === 0) return;

		for (const update of changes) {
			await transport.request("updateKey", update);
		}
		setPendingChanges(new Map());
	}, [pendingChanges, transport]);

	const discardChanges = useCallback(async () => {
		setPendingChanges(new Map());
		await refresh();
	}, [refresh]);

	const setSaveMode = useCallback((mode: SaveMode) => {
		saveModeRef.current = mode;
	}, []);

	const toggleReview = useCallback(
		async (toggle: ReviewToggle) => {
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

			await transport.request("toggleReview", toggle);
		},
		[transport],
	);

	const createKey = useCallback(
		async (create: KeyCreate) => {
			await transport.request("createKey", create);
			await refresh();
		},
		[refresh, transport],
	);

	const deleteKey = useCallback(
		async (del: KeyDelete) => {
			await transport.request("deleteKey", del);
			await refresh();
		},
		[refresh, transport],
	);

	const renameKey = useCallback(
		async (rename: KeyRename) => {
			await transport.request("renameKey", rename);
			await refresh();
		},
		[refresh, transport],
	);

	const createNamespace = useCallback(
		async (ns: NamespaceCreate) => {
			await transport.request("createNamespace", ns);
		},
		[transport],
	);

	const deleteNamespace = useCallback(
		async (ns: NamespaceDelete) => {
			await transport.request("deleteNamespace", ns);
		},
		[transport],
	);

	const addLocale = useCallback(
		async (locale: string, copyFrom?: string) => {
			await transport.request("addLocale", { locale, copyFrom });
		},
		[transport],
	);

	const removeLocale = useCallback(
		async (locale: string) => {
			await transport.request("removeLocale", { locale });
		},
		[transport],
	);

	const openFolder = useCallback(async () => {
		await transport.request("openLocalesDir", {});
	}, [transport]);

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
