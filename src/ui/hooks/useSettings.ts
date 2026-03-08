import { useCallback, useEffect, useState } from "react";
import type { RosettaSettings } from "../../shared/types";

// Reuse the same RPC bridge from useStore
let rpcRequest: ((method: string, params: unknown) => Promise<unknown>) | null = null;

export function setSettingsRpcRequest(fn: (method: string, params: unknown) => Promise<unknown>) {
	rpcRequest = fn;
}

async function callRpc<T>(method: string, params: unknown = {}): Promise<T> {
	if (rpcRequest) return rpcRequest(method, params) as Promise<T>;
	throw new Error("RPC not initialized");
}

type SettingsUpdateCallback = (settings: RosettaSettings) => void;
const settingsListeners = new Set<SettingsUpdateCallback>();

export function setSettingsMessageHandler(register: (handler: SettingsUpdateCallback) => void) {
	register((s) => {
		for (const listener of settingsListeners) {
			listener(s);
		}
	});
}

export function useSettings() {
	const [settings, setSettings] = useState<RosettaSettings | null>(null);

	const refresh = useCallback(async () => {
		try {
			const data = await callRpc<RosettaSettings>("getSettings");
			setSettings(data);
		} catch (err) {
			console.error("Failed to load settings:", err);
		}
	}, []);

	useEffect(() => {
		const handler: SettingsUpdateCallback = (s) => setSettings(s);
		settingsListeners.add(handler);
		return () => {
			settingsListeners.delete(handler);
		};
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const updateSettings = useCallback(async (partial: Partial<RosettaSettings>) => {
		// Optimistic
		setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
		await callRpc("updateSettings", partial);
	}, []);

	return { settings, updateSettings };
}
