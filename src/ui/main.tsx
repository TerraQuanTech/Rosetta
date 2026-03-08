import { Electroview } from "electrobun/view";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { RosettaRPC } from "../shared/types";
import App from "./App";
import { setSettingsMessageHandler, setSettingsRpcRequest } from "./hooks/useSettings";
import { setMessageHandler, setRpcRequest } from "./hooks/useStore";
import "./styles/global.css";

// --- Wire Electrobun RPC ---
let storeMessageHandler: ((data: any) => void) | null = null;
let settingsMessageHandler: ((data: any) => void) | null = null;

const rpc = Electroview.defineRPC<RosettaRPC>({
	maxRequestTime: 30000,
	handlers: {
		requests: {},
		messages: {
			storeUpdated: (payload) => {
				storeMessageHandler?.(payload);
			},
			fileChanged: (_payload) => {},
			settingsUpdated: (payload) => {
				settingsMessageHandler?.(payload);
			},
		},
	},
});

const view = new Electroview({ rpc });

// Bridge RPC requests
const rpcBridge = async (method: string, params: unknown) => {
	const requestProxy = view.rpc!.request as any;
	return requestProxy[method](params);
};

setRpcRequest(rpcBridge);
setSettingsRpcRequest(rpcBridge);

// Bridge incoming messages
setMessageHandler((handler) => {
	storeMessageHandler = handler;
});
setSettingsMessageHandler((handler) => {
	settingsMessageHandler = handler;
});

// --- Render ---
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
