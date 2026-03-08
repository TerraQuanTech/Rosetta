import type { i18n } from "i18next";

interface ConnectOptions {
	/** Rosetta connector port. Default: 4871 */
	port?: number;
	/** Reconnect interval in ms. Default: 3000 */
	reconnectInterval?: number;
	/** Log connection events. Default: true */
	verbose?: boolean;
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
 * Connect your i18next instance to a running Rosetta editor.
 *
 * When Rosetta edits a translation, it's hot-reloaded in your app
 * without restart. Only use in development.
 *
 * ```ts
 * import { connectRosetta } from "rosetta-connect";
 * if (process.env.NODE_ENV === "development") {
 *   connectRosetta(i18next, { port: 4871 });
 * }
 * ```
 */
export function connectRosetta(i18next: i18n, options: ConnectOptions = {}): () => void {
	const { port = 4871, reconnectInterval = 3000, verbose = true } = options;

	const url = `ws://localhost:${port}/ws`;
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	const log = verbose
		? (...args: unknown[]) => console.log("[rosetta-connect]", ...args)
		: () => {};

	function connect() {
		if (stopped) return;

		try {
			ws = new WebSocket(url);

			ws.onopen = () => {
				log("Connected to Rosetta");
				ws?.send(
					JSON.stringify({
						type: "hello",
						appName: document.title || "Electron App",
					}),
				);
			};

			ws.onmessage = (event) => {
				try {
					const msg: RosettaMessage = JSON.parse(event.data);
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
				// Hot-reload a single key
				const bundle = i18next.getResourceBundle(msg.locale, msg.namespace) || {};
				setNestedValue(bundle, msg.key, msg.value);
				i18next.addResourceBundle(msg.namespace, msg.locale, bundle, true, true);
				// Also add with the namespace as the ns parameter (i18next API varies)
				i18next.addResourceBundle(msg.locale, msg.namespace, bundle, true, true);
				log(`Updated ${msg.namespace}:${msg.key} [${msg.locale}]`);
				break;
			}

			case "translation:reload": {
				// Full namespace reload — the app should re-fetch from its source
				// For file-based i18next, trigger a reload
				i18next.reloadResources(msg.locale, msg.namespace);
				log(`Reloaded ${msg.namespace} [${msg.locale}]`);
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

	// Start
	connect();

	// Return cleanup function
	return disconnect;
}

/** Set a nested value using a dot-notation key */
function setNestedValue(obj: Record<string, unknown>, dotKey: string, value: string): void {
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
