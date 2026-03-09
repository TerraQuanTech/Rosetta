import type { RosettaRPC } from "../shared/types";

type BunRequests = RosettaRPC["bun"]["requests"];

type RpcBridge = <M extends keyof BunRequests>(
	method: M,
	params: BunRequests[M]["params"],
) => Promise<BunRequests[M]["response"]>;

declare global {
	interface Window {
		rpcBridge?: RpcBridge;
	}
}
