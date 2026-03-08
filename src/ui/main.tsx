import { Electroview } from "electrobun/view";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { RosettaRPC } from "../shared/types";
import App from "./App";
import {
	setConnectorMessageHandler,
	setConnectorRpcRequest,
} from "./hooks/useConnectorStatus";
import {
	setSettingsMessageHandler,
	setSettingsRpcRequest,
} from "./hooks/useSettings";
import { setMessageHandler, setRpcRequest } from "./hooks/useStore";
import "./styles/global.css";

// --- Wire Electrobun RPC ---
let storeMessageHandler: ((data: any) => void) | null = null;
let settingsMessageHandler: ((data: any) => void) | null = null;
let connectorStatusHandler: ((data: any) => void) | null = null;

const rpc = Electroview.defineRPC<RosettaRPC>({
	maxRequestTime: 30000,
	handlers: {
		requests: {
			installCli: async () => {
				const requestProxy = (rpc as any).request as any;
				return requestProxy.installCli({});
			},
		},
		messages: {
			storeUpdated: (payload) => {
				storeMessageHandler?.(payload);
			},
			fileChanged: (_payload) => {},
			settingsUpdated: (payload) => {
				settingsMessageHandler?.(payload);
			},
			connectorStatusChanged: (payload) => {
				connectorStatusHandler?.(payload);
			},
			themeChanged: (_payload) => {},
		},
	},
});

const view = new Electroview({ rpc });

// Bridge RPC requests
const rpcBridge = async (method: string, params: unknown) => {
	const requestProxy = view.rpc!.request as any;
	return requestProxy[method](params);
};

// Expose RPC bridge globally for UI components
(window as any).rpcBridge = rpcBridge;

setRpcRequest(rpcBridge);
setSettingsRpcRequest(rpcBridge);
setConnectorRpcRequest(rpcBridge);

// Bridge incoming messages
setMessageHandler((handler) => {
	storeMessageHandler = handler;
});
setSettingsMessageHandler((handler) => {
	settingsMessageHandler = handler;
});
setConnectorMessageHandler((handler) => {
	connectorStatusHandler = handler;
});

// Disable browser context menu (reload / inspect element) in production
if (!location.href.startsWith("http://localhost")) {
	document.addEventListener("contextmenu", (e) => e.preventDefault());
}

// --- Render ---
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
