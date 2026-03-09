import type {
	BunRequests,
	RosettaRPC,
	RosettaSettings,
	RpcRequestFn,
	TranslationStore,
} from "@shared/types";
import { Electroview } from "electrobun/view";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setConnectorMessageHandler, setConnectorRpcRequest } from "./hooks/useConnectorStatus";
import { setSettingsMessageHandler, setSettingsRpcRequest } from "./hooks/useSettings";
import { setMessageHandler, setRpcRequest } from "./hooks/useStore";
import { forceRelayout } from "./hooks/useWindowsRelayoutHack";
import "./styles/global.css";

type ConnectorStatus = RosettaRPC["webview"]["messages"]["connectorStatusChanged"];

let storeMessageHandler: ((data: TranslationStore) => void) | null = null;
let settingsMessageHandler: ((data: RosettaSettings) => void) | null = null;
let connectorStatusHandler: ((data: ConnectorStatus) => void) | null = null;

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
			connectorStatusChanged: (payload) => {
				connectorStatusHandler?.(payload);
			},
			themeChanged: (_payload) => {},
			forceRelayout,
		},
	},
});

const view = new Electroview({ rpc });

const rpcBridge: RpcRequestFn = <M extends keyof BunRequests>(
	method: M,
	params: BunRequests[M]["params"],
): Promise<BunRequests[M]["response"]> => {
	const request = view.rpc!.request;
	return (
		request[method] as (params: BunRequests[M]["params"]) => Promise<BunRequests[M]["response"]>
	)(params);
};

window.rpcBridge = rpcBridge;

setRpcRequest(rpcBridge);
setSettingsRpcRequest(rpcBridge);
setConnectorRpcRequest(rpcBridge);

setMessageHandler((handler) => {
	storeMessageHandler = handler;
});
setSettingsMessageHandler((handler) => {
	settingsMessageHandler = handler;
});
setConnectorMessageHandler((handler) => {
	connectorStatusHandler = handler;
});

if (!location.href.startsWith("http://localhost")) {
	document.addEventListener("contextmenu", (e) => e.preventDefault());
}

// macOS hiddenInset titlebar needs padding for traffic light buttons
if (navigator.platform.startsWith("Mac")) {
	document.documentElement.style.setProperty("--titlebar-inset", "38px");
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
