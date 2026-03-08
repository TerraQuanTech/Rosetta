import type { i18n } from "i18next";

export interface ConnectOptions {
	/** Rosetta connector port. Default: 4871 */
	port?: number;
	/** Reconnect interval in ms. Default: 3000 */
	reconnectInterval?: number;
	/** Log connection events. Default: true in development, false otherwise */
	verbose?: boolean;
	/** App name sent to Rosetta on connect. Default: auto-detected */
	appName?: string;
	/**
	 * How to apply single-key updates.
	 * - "bundle" (default): uses addResourceBundle — works with all i18next setups
	 * - "resource": uses addResource — slightly more granular
	 */
	updateStrategy?: "bundle" | "resource";
}

interface TranslationUpdate {
	type: "translation:update";
	namespace: string;
	key: string;
	locale: string;
	value: string;
}

interface TranslationReload {
	type: "translation:reload";
	namespace: string;
	locale: string;
}

type RosettaMessage = TranslationUpdate | TranslationReload;

/**
 * Connect your i18next instance to a running Rosetta editor for live
 * translation preview. Changes made in Rosetta are hot-reloaded instantly.
 *
 * Works in:
 * - Electron renderer process (built or dev)
 * - Browser (Vite/webpack dev server)
 * - Node.js / Electron main process (requires `ws` package or Node 22+ built-in WebSocket)
 *
 * @example
 * ```ts
 * import i18next from "i18next";
 * import { connectRosetta } from "rosetta-connect";
 *
 * // Only in development
 * if (process.env.NODE_ENV === "development") {
 *   const disconnect = connectRosetta(i18next, { port: 4871 });
 *   // Call disconnect() to clean up
 * }
 * ```
 *
 * @returns A cleanup function that closes the connection
 */
export function connectRosetta(i18next: i18n, options: ConnectOptions = {}): () => void {
	const {
		port = 4871,
		reconnectInterval = 3000,
		verbose = typeof process !== "undefined" ? process.env.NODE_ENV === "development" : true,
		appName,
		updateStrategy = "bundle",
	} = options;

	const url = `ws://localhost:${port}/ws`;
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	const log = verbose
		? (...args: unknown[]) => console.log("[rosetta-connect]", ...args)
		: () => {};

	function getAppName(): string {
		if (appName) return appName;
		// Browser / Electron renderer
		if (typeof document !== "undefined" && document.title) return document.title;
		// Node.js / Electron main
		if (typeof process !== "undefined" && process.argv[1]) {
			const path = process.argv[1];
			return path.split(/[/\\]/).pop() || "App";
		}
		return "App";
	}

	function connect() {
		if (stopped) return;

		try {
			ws = new WebSocket(url);

			ws.onopen = () => {
				log("Connected to Rosetta at", url);
				ws?.send(JSON.stringify({ type: "hello", appName: getAppName() }));
			};

			ws.onmessage = (event) => {
				try {
					const msg: RosettaMessage = JSON.parse(
						typeof event.data === "string" ? event.data : String(event.data),
					);
					handleMessage(msg);
				} catch {
					// Ignore malformed messages
				}
			};

			ws.onclose = () => {
				log("Disconnected from Rosetta");
				scheduleReconnect();
			};

			ws.onerror = () => {
				// onclose will fire after this
			};
		} catch {
			scheduleReconnect();
		}
	}

	function handleMessage(msg: RosettaMessage) {
		switch (msg.type) {
			case "translation:update": {
				applyUpdate(i18next, msg, updateStrategy);
				log(`Updated ${msg.namespace}:${msg.key} [${msg.locale}]`);
				break;
			}

			case "translation:reload": {
				i18next.reloadResources([msg.locale], [msg.namespace]).then(() => {
					// Emit event so React components re-render
					i18next.emit("languageChanged", i18next.language);
					log(`Reloaded ${msg.namespace} [${msg.locale}]`);
				});
				break;
			}
		}
	}

	function scheduleReconnect() {
		if (stopped) return;
		reconnectTimer = setTimeout(connect, reconnectInterval);
	}

	function disconnect() {
		stopped = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		ws?.close();
		ws = null;
		log("Disconnected");
	}

	// Start connection
	connect();

	return disconnect;
}

/**
 * Apply a single translation update to i18next.
 * After applying, emits a languageChanged event to trigger React re-renders.
 */
function applyUpdate(i18next: i18n, msg: TranslationUpdate, strategy: "bundle" | "resource") {
	if (strategy === "resource") {
		// addResource is more granular but doesn't trigger all plugins
		i18next.addResource(msg.locale, msg.namespace, msg.key, msg.value);
	} else {
		// addResourceBundle with deep merge + overwrite
		// i18next API: addResourceBundle(lng, ns, resources, deep, overwrite)
		const bundle: Record<string, unknown> = {};
		setNestedValue(bundle, msg.key, msg.value);
		i18next.addResourceBundle(msg.locale, msg.namespace, bundle, true, true);
	}

	// Trigger re-render in react-i18next and other UI bindings
	i18next.emit("languageChanged", i18next.language);
}

/** Set a nested value using a dot-notation key */
export function setNestedValue(obj: Record<string, unknown>, dotKey: string, value: string): void {
	const parts = dotKey.split(".");
	let current = obj;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (typeof current[part] !== "object" || current[part] === null) {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}

	current[parts[parts.length - 1]] = value;
}

export default connectRosetta;
