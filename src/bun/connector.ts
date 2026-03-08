import type { KeyUpdate } from "../shared/types";

interface ConnectorClient {
	ws: unknown;
	appName?: string;
}

type StatusListener = (connected: boolean, clients: number) => void;

export class ConnectorServer {
	private clients: Set<ConnectorClient> = new Set();
	private server: ReturnType<typeof Bun.serve> | null = null;
	private _port: number;
	private statusListeners: Set<StatusListener> = new Set();

	constructor(port = 4871) {
		this._port = port;
	}

	get port(): number {
		return this._port;
	}

	get connected(): boolean {
		return this.clients.size > 0;
	}

	get clientCount(): number {
		return this.clients.size;
	}

	/** Get info about connected clients */
	get connectedApps(): string[] {
		return [...this.clients].map((c) => c.appName || "Unknown").filter(Boolean);
	}

	updatePort(port: number): void {
		this._port = port;
	}

	/** Subscribe to connection status changes */
	onStatusChange(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	private notifyStatus(): void {
		const connected = this.connected;
		const count = this.clientCount;
		for (const listener of this.statusListeners) {
			listener(connected, count);
		}
	}

	start(): void {
		this.server = Bun.serve({
			port: this._port,
			fetch(req, server) {
				const url = new URL(req.url);
				if (url.pathname === "/ws") {
					const upgraded = server.upgrade(req, { data: null });
					if (!upgraded) {
						return new Response("WebSocket upgrade failed", { status: 400 });
					}
					return undefined;
				}
				// Health check endpoint
				if (url.pathname === "/health") {
					return Response.json({ status: "ok", version: "0.1.0" });
				}
				return new Response("Rosetta Connector", { status: 200 });
			},
			websocket: {
				open: (ws) => {
					const client: ConnectorClient = { ws };
					this.clients.add(client);
					console.log(`[connector] App connected (${this.clients.size} total)`);
					this.notifyStatus();
				},
				message: (ws, message) => {
					try {
						const data = JSON.parse(String(message));
						if (data.type === "hello") {
							// Find the client and set the appName
							for (const client of this.clients) {
								if (client.ws === ws) {
									client.appName = data.appName;
									break;
								}
							}
							console.log(`[connector] App identified: ${data.appName}`);
							this.notifyStatus();
						}
					} catch {
						// Ignore
					}
				},
				close: (ws) => {
					for (const client of this.clients) {
						if (client.ws === ws) {
							this.clients.delete(client);
							break;
						}
					}
					console.log(`[connector] App disconnected (${this.clients.size} total)`);
					this.notifyStatus();
				},
			},
		});

		console.log(`[connector] Listening on ws://localhost:${this._port}/ws`);
	}

	broadcastUpdate(update: KeyUpdate): void {
		const message = JSON.stringify({
			type: "translation:update",
			namespace: update.namespace,
			key: update.key,
			locale: update.locale,
			value: update.value,
		});

		for (const client of this.clients) {
			try {
				(client.ws as any).send(message);
			} catch {
				// Client probably disconnected
			}
		}
	}

	broadcastReload(namespace: string, locale: string): void {
		const message = JSON.stringify({
			type: "translation:reload",
			namespace,
			locale,
		});

		for (const client of this.clients) {
			try {
				(client.ws as any).send(message);
			} catch {
				// Client probably disconnected
			}
		}
	}

	stop(): void {
		this.server?.stop();
		this.clients.clear();
		this.notifyStatus();
	}
}
