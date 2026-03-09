import type { RpcRequestFn } from "@shared/types";

declare global {
	interface Window {
		rpcBridge?: RpcRequestFn;
	}
}
