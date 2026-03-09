import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RpcTransportContext } from "./rpc-transport";
import "./styles/global.css";
import { createElectrobunTransport } from "./transports/electrobun";

const transport = createElectrobunTransport();

if (!location.href.startsWith("http://localhost")) {
	document.addEventListener("contextmenu", (e) => e.preventDefault());
}

// macOS hiddenInset titlebar needs padding for traffic light buttons
if (navigator.platform.startsWith("Mac")) {
	document.documentElement.style.setProperty("--titlebar-inset", "38px");
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RpcTransportContext.Provider value={transport}>
			<App />
		</RpcTransportContext.Provider>
	</StrictMode>,
);
