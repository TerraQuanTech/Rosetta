import type { RosettaSettings } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { useRpcTransport } from "../rpc-transport";

export function useSettings() {
	const transport = useRpcTransport();

	const [settings, setSettings] = useState<RosettaSettings | null>(null);

	const refresh = useCallback(async () => {
		try {
			const data = await transport.request("getSettings", {});
			setSettings(data);
		} catch (err) {
			console.error("Failed to load settings:", err);
		}
	}, [transport]);

	useEffect(() => {
		return transport.onMessage("settingsUpdated", (s) => setSettings(s));
	}, [transport]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const updateSettings = useCallback(
		async (partial: Partial<RosettaSettings>) => {
			setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
			await transport.request("updateSettings", partial);
		},
		[transport],
	);

	return { settings, updateSettings };
}
