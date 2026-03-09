import type { BunRequests, RosettaSettings, RpcRequestFn } from "@shared/types";
import { useCallback, useEffect, useState } from "react";

let rpcRequest: RpcRequestFn | null = null;

export function setSettingsRpcRequest(fn: RpcRequestFn) {
	rpcRequest = fn;
}

function callRpc<M extends keyof BunRequests>(
	method: M,
	params: BunRequests[M]["params"],
): Promise<BunRequests[M]["response"]> {
	if (!rpcRequest) throw new Error("RPC not initialized");
	return rpcRequest(method, params);
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
			const data = await callRpc("getSettings", {});
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
		setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
		await callRpc("updateSettings", partial);
	}, []);

	return { settings, updateSettings };
}
