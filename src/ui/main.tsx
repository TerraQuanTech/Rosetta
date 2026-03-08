import { Electroview } from "electrobun/view";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { RosettaRPC } from "../shared/types";
import App from "./App";
import { setMessageHandler, setRpcRequest } from "./hooks/useStore";
import "./styles/global.css";

// --- Wire Electrobun RPC ---
const rpc = Electroview.defineRPC<RosettaRPC>({
	maxRequestTime: 30000,
	handlers: {
		requests: {},
		messages: {
			storeUpdated: (payload) => {
				messageHandler?.(payload);
			},
			fileChanged: (_payload) => {
				// Could be used for more granular updates in the future
			},
		},
	},
});

let messageHandler: ((store: any) => void) | null = null;

const view = new Electroview({ rpc });

// Bridge RPC requests from the UI hooks to Electrobun
setRpcRequest(async (method: string, params: unknown) => {
	const requestProxy = view.rpc!.request as any;
	return requestProxy[method](params);
});

// Bridge incoming messages
setMessageHandler((handler) => {
	messageHandler = handler;
});

// --- Render ---
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
