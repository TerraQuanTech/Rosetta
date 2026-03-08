/**
 * Connector WebSocket server.
 *
 * When an Electron app includes `rosetta-connect`, it connects here.
 * On every translation update Rosetta pushes the change to all connected
 * Electron apps so they can hot-reload i18next in real time.
 */

import type { KeyUpdate } from "../shared/types";

const CONNECTOR_PORT = 4871;

interface ConnectorClient {
	ws: unknown; // WebSocket-like (Bun's native WebSocket)
	appName?: string;
}

export class ConnectorServer {
	private clients: Set<ConnectorClient> = new Set();
	private server: ReturnType<typeof Bun.serve> | null = null;

	get port(): number {
		return CONNECTOR_PORT;
	}

	get connected(): boolean {
		return this.clients.size > 0;
	}

	start(): void {
		this.server = Bun.serve({
			port: CONNECTOR_PORT,
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
					// Could receive heartbeats or app metadata
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

		console.log(`[connector] Listening on ws://localhost:${CONNECTOR_PORT}/ws`);
	}

	/** Push a key update to all connected apps */
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

	/** Push a full reload signal (e.g. after key delete/rename) */
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
