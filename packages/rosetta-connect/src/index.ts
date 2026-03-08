import type { i18n } from "i18next";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

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
	/** Called when connection status changes */
	onStatusChange?: (status: ConnectionStatus) => void;
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
 * @example
 * ```ts
 * import i18next from "i18next";
 * import { connectRosetta } from "rosetta-connect";
 *
 * connectRosetta(i18next);
 * ```
 *
 * @returns A cleanup function that closes the connection
 */
export function connectRosetta(
	i18next: i18n,
	options: ConnectOptions = {},
): () => void {
	const {
		port = 4871,
		reconnectInterval = 3000,
		verbose = false,
		appName,
		updateStrategy = "bundle",
		onStatusChange,
	} = options;

	// Ensure react-i18next re-renders when resources are added.
	// By default (v14+) bindI18nStore is '' so store events are ignored.
	const ri = (i18next as any).options?.react;
	if (ri && (!ri.bindI18nStore || !ri.bindI18nStore.includes("added"))) {
		ri.bindI18nStore = ri.bindI18nStore
			? `${ri.bindI18nStore} added`
			: "added";
	}

	const url = `ws://localhost:${port}/ws`;
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	const log = verbose
		? (...args: unknown[]) => console.debug("[rosetta-connect]", ...args)
		: () => {};

	function emitStatus(status: ConnectionStatus) {
		onStatusChange?.(status);
	}

	function getAppName(): string {
		if (appName) return appName;
		if (typeof document !== "undefined" && document.title)
			return document.title;
		return "App";
	}

	function connect() {
		if (stopped) return;
		emitStatus("connecting");

		try {
			ws = new WebSocket(url);

			ws.onopen = () => {
				emitStatus("connected");
				log("Connected to Rosetta at", url);
				ws?.send(
					JSON.stringify({ type: "hello", appName: getAppName() }),
				);
			};

			ws.onmessage = (event) => {
				try {
					const msg: RosettaMessage = JSON.parse(
						typeof event.data === "string"
							? event.data
							: String(event.data),
					);
					handleMessage(msg);
				} catch {
					// Ignore malformed messages
				}
			};

			ws.onclose = () => {
				log("Disconnected from Rosetta");
				emitStatus("disconnected");
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
				i18next
					.reloadResources([msg.locale], [msg.namespace])
					.then(() => {
						// Notify react-i18next to re-render.
						// Emitting 'added' on the store + 'languageChanged' on i18next
						// covers both legacy and modern react-i18next versions.
						(i18next as any).store?.emit(
							"added",
							msg.locale,
							msg.namespace,
						);
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
		emitStatus("disconnected");
		log("Disconnected");
	}

	connect();

	return disconnect;
}

/**
 * Apply a single translation update to i18next.
 * After applying, emits a languageChanged event to trigger React re-renders.
 */
function applyUpdate(
	i18next: i18n,
	msg: TranslationUpdate,
	strategy: "bundle" | "resource",
) {
	if (msg.value === "") {
		// Empty value = remove key so i18next falls back to fallback language
		const existing = i18next.getResourceBundle(msg.locale, msg.namespace);
		if (existing) {
			removeNestedValue(existing, msg.key);
			i18next.addResourceBundle(
				msg.locale,
				msg.namespace,
				existing,
				false,
				false,
			);
		}
	} else if (strategy === "resource") {
		i18next.addResource(msg.locale, msg.namespace, msg.key, msg.value);
	} else {
		const bundle: Record<string, unknown> = {};
		setNestedValue(bundle, msg.key, msg.value);
		i18next.addResourceBundle(
			msg.locale,
			msg.namespace,
			bundle,
			true,
			true,
		);
	}

	// Notify react-i18next to re-render.
	// Emitting 'added' on the store + 'languageChanged' on i18next
	// covers both legacy and modern react-i18next versions.
	(i18next as any).store?.emit("added", msg.locale, msg.namespace);
	i18next.emit("languageChanged", i18next.language);
}

/** Set a nested value using a dot-notation key */
export function setNestedValue(
	obj: Record<string, unknown>,
	dotKey: string,
	value: string,
): void {
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

/** Remove a nested value using a dot-notation key */
function removeNestedValue(obj: Record<string, unknown>, dotKey: string): void {
	const parts = dotKey.split(".");
	let current = obj;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (typeof current[part] !== "object" || current[part] === null) {
			return; // Path doesn't exist, nothing to remove
		}
		current = current[part] as Record<string, unknown>;
	}

	delete current[parts[parts.length - 1]];
}

export default connectRosetta;
