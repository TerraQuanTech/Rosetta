import type { BunRequests, RosettaRPC, RpcRequestFn } from "@shared/types";
import { Electroview } from "electrobun/view";
import { forceRelayout } from "../hooks/useWindowsRelayoutHack";
import type { MessagePayloads, MessageType, RpcTransport } from "../rpc-transport";

type Listeners = {
	[K in MessageType]: Set<(data: MessagePayloads[K]) => void>;
};

function createListeners(): Listeners {
	return {
		storeUpdated: new Set(),
		settingsUpdated: new Set(),
		connectorStatusChanged: new Set(),
		fileChanged: new Set(),
		themeChanged: new Set(),
		forceRelayout: new Set(),
	};
}

export function createElectrobunTransport(): RpcTransport {
	const listeners = createListeners();

	function dispatch<T extends MessageType>(type: T, data: MessagePayloads[T]) {
		for (const handler of listeners[type]) {
			handler(data);
		}
	}

	const rpc = Electroview.defineRPC<RosettaRPC>({
		maxRequestTime: 30000,
		handlers: {
			requests: {},
			messages: {
				storeUpdated: (payload) => dispatch("storeUpdated", payload),
				fileChanged: (payload) => dispatch("fileChanged", payload),
				settingsUpdated: (payload) => dispatch("settingsUpdated", payload),
				connectorStatusChanged: (payload) => dispatch("connectorStatusChanged", payload),
				themeChanged: (payload) => dispatch("themeChanged", payload),
				forceRelayout: () => {
					forceRelayout();
					dispatch("forceRelayout", {});
				},
			},
		},
	});

	const view = new Electroview({ rpc });

	const request: RpcRequestFn = <M extends keyof BunRequests>(
		method: M,
		params: BunRequests[M]["params"],
	): Promise<BunRequests[M]["response"]> => {
		const req = view.rpc!.request;
		return (
			req[method] as (params: BunRequests[M]["params"]) => Promise<BunRequests[M]["response"]>
		)(params);
	};

	return {
		request,
		onMessage<T extends MessageType>(type: T, handler: (data: MessagePayloads[T]) => void) {
			const set = listeners[type] as Set<(data: MessagePayloads[T]) => void>;
			set.add(handler);
			return () => {
				set.delete(handler);
			};
		},
		capabilities: {
			windowTitle: true,
			installCli: true,
			nativeFileDialog: true,
		},
	};
}
