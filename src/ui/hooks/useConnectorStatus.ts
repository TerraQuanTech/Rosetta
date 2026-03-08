import { useCallback, useEffect, useState } from "react";

export interface ConnectorStatus {
	connected: boolean;
	clientCount: number;
	apps: string[];
}

type StatusCallback = (status: ConnectorStatus) => void;
const statusListeners = new Set<StatusCallback>();

let rpcRequest: ((method: string, params: unknown) => Promise<unknown>) | null = null;

export function setConnectorRpcRequest(fn: (method: string, params: unknown) => Promise<unknown>) {
	rpcRequest = fn;
}

export function setConnectorMessageHandler(register: (handler: StatusCallback) => void) {
	register((status) => {
		for (const listener of statusListeners) {
			listener(status);
		}
	});
}

export function useConnectorStatus(): ConnectorStatus {
	const [status, setStatus] = useState<ConnectorStatus>({
		connected: false,
		clientCount: 0,
		apps: [],
	});

	// Fetch initial status
	const fetchStatus = useCallback(async () => {
		if (!rpcRequest) return;
		try {
			const result = (await rpcRequest("getConnectorStatus", {})) as {
				connected: boolean;
				port: number;
			};
			setStatus({
				connected: result.connected,
				clientCount: result.connected ? 1 : 0,
				apps: [],
			});
		} catch {
			// Ignore
		}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	// Listen for live updates
	useEffect(() => {
		const handler: StatusCallback = (s) => setStatus(s);
		statusListeners.add(handler);
		return () => {
			statusListeners.delete(handler);
		};
	}, []);

	return status;
}
