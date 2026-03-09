import type { BunRequests, RpcRequestFn } from "@shared/types";
import type { MessagePayloads, MessageType, RpcTransport } from "../rpc-transport";

interface VsCodeApi {
	postMessage(message: Record<string, unknown>): void;
	getState(): Record<string, unknown> | undefined;
	setState(state: Record<string, unknown>): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

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

export function createVsCodeTransport(): RpcTransport {
	const vscode = acquireVsCodeApi();
	const listeners = createListeners();
	let nextId = 0;
	const pending = new Map<
		number,
		{
			resolve: (value: BunRequests[keyof BunRequests]["response"]) => void;
			reject: (error: Error) => void;
		}
	>();

	window.addEventListener("message", (event: MessageEvent) => {
		const msg = event.data;
		if (!msg || typeof msg !== "object") return;

		if (msg.type === "response") {
			const entry = pending.get(msg.id as number);
			if (entry) {
				pending.delete(msg.id as number);
				if (msg.error) {
					entry.reject(new Error(msg.error as string));
				} else {
					entry.resolve(msg.result as BunRequests[keyof BunRequests]["response"]);
				}
			}
		} else if (msg.type === "message") {
			const name = msg.name as MessageType;
			const set = listeners[name];
			if (set) {
				for (const handler of set) {
					(handler as (data: MessagePayloads[MessageType]) => void)(
						msg.data as MessagePayloads[MessageType],
					);
				}
			}
		}
	});

	const request: RpcRequestFn = <M extends keyof BunRequests>(
		method: M,
		params: BunRequests[M]["params"],
	): Promise<BunRequests[M]["response"]> => {
		return new Promise((resolve, reject) => {
			const id = ++nextId;
			pending.set(id, {
				resolve: resolve as (value: BunRequests[keyof BunRequests]["response"]) => void,
				reject,
			});
			vscode.postMessage({ type: "request", id, method, params });
		});
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
			windowTitle: false,
			installCli: false,
			nativeFileDialog: true,
		},
	};
}
