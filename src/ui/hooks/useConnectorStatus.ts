import { useCallback, useEffect, useState } from "react";
import { useRpcTransport } from "../rpc-transport";

export interface ConnectorStatus {
	connected: boolean;
	clientCount: number;
	apps: string[];
}

export function useConnectorStatus(): ConnectorStatus {
	const transport = useRpcTransport();

	const [status, setStatus] = useState<ConnectorStatus>({
		connected: false,
		clientCount: 0,
		apps: [],
	});

	const fetchStatus = useCallback(async () => {
		try {
			const result = await transport.request("getConnectorStatus", {});
			setStatus({
				connected: result.connected,
				clientCount: result.connected ? 1 : 0,
				apps: [],
			});
		} catch {}
	}, [transport]);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	useEffect(() => {
		return transport.onMessage("connectorStatusChanged", (s) => setStatus(s));
	}, [transport]);

	return status;
}
