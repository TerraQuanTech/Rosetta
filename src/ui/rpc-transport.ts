import type { RosettaSettings, RpcRequestFn, Theme, TranslationStore } from "@shared/types";
import { createContext, useContext } from "react";

/** Map of backend push-message names to their payload types. */
export interface MessagePayloads {
	storeUpdated: TranslationStore;
	settingsUpdated: RosettaSettings;
	connectorStatusChanged: { connected: boolean; clientCount: number; apps: string[] };
	connectorFocusKey: { namespace: string; key: string };
	fileChanged: { namespace: string; locale: string };
	themeChanged: { theme: Theme };
	forceRelayout: Record<string, never>;
}

export type MessageType = keyof MessagePayloads;

export interface RpcTransport {
	/** Send a typed RPC request and await the response. */
	request: RpcRequestFn;

	/** Subscribe to a typed push message from the backend. Returns an unsubscribe function. */
	onMessage<T extends MessageType>(
		type: T,
		handler: (data: MessagePayloads[T]) => void,
	): () => void;

	/** Platform capabilities — features that may not exist in all hosts. */
	capabilities: {
		windowTitle: boolean;
		installCli: boolean;
		nativeFileDialog: boolean;
	};
}

export const RpcTransportContext = createContext<RpcTransport | null>(null);

export function useRpcTransport(): RpcTransport {
	const transport = useContext(RpcTransportContext);
	if (!transport) throw new Error("RpcTransportContext not provided");
	return transport;
}
