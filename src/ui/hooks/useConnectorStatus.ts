import type { RpcRequestFn } from "@shared/types";
import { useCallback, useEffect, useState } from "react";

export interface ConnectorStatus {
	connected: boolean;
	clientCount: number;
	apps: string[];
}

type StatusCallback = (status: ConnectorStatus) => void;
const statusListeners = new Set<StatusCallback>();

let rpcRequest: RpcRequestFn | null = null;

export function setConnectorRpcRequest(fn: RpcRequestFn) {
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

	const fetchStatus = useCallback(async () => {
		if (!rpcRequest) return;
		try {
			const result = await rpcRequest("getConnectorStatus", {});
			setStatus({
				connected: result.connected,
				clientCount: result.connected ? 1 : 0,
				apps: [],
			});
		} catch {}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	useEffect(() => {
		const handler: StatusCallback = (s) => setStatus(s);
		statusListeners.add(handler);
		return () => {
			statusListeners.delete(handler);
		};
	}, []);

	return status;
}
