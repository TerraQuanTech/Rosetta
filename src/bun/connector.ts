import type { KeyUpdate } from "../shared/types";

interface ConnectorClient {
	ws: unknown;
	appName?: string;
}

export class ConnectorServer {
	private clients: Set<ConnectorClient> = new Set();
	private server: ReturnType<typeof Bun.serve> | null = null;
	private _port: number;

	constructor(port = 4871) {
		this._port = port;
	}

	get port(): number {
		return this._port;
	}

	get connected(): boolean {
		return this.clients.size > 0;
	}

	updatePort(port: number): void {
		this._port = port;
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
				return new Response("Rosetta Connector", { status: 200 });
			},
			websocket: {
				open: (ws) => {
					const client: ConnectorClient = { ws };
					this.clients.add(client);
					console.log(`[connector] App connected (${this.clients.size} total)`);
				},
				message: (_ws, message) => {
					try {
						const data = JSON.parse(String(message));
						if (data.type === "hello") {
							console.log(`[connector] App identified: ${data.appName}`);
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
	}
}
