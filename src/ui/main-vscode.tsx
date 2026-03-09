import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RpcTransportContext } from "./rpc-transport";
import "./styles/global.css";
import { createVsCodeTransport } from "./transports/vscode";

const transport = createVsCodeTransport();

// Sync VS Code theme with our theme system.
// VS Code sets body classes: vscode-dark, vscode-light, vscode-high-contrast.
function syncTheme() {
	const isDark =
		document.body.classList.contains("vscode-dark") ||
		document.body.classList.contains("vscode-high-contrast");
	document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
	document.body.classList.toggle("dark", isDark);
	document.body.classList.toggle("light", !isDark);
}

syncTheme();
const observer = new MutationObserver(syncTheme);
observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RpcTransportContext.Provider value={transport}>
			<App />
		</RpcTransportContext.Provider>
	</StrictMode>,
);
