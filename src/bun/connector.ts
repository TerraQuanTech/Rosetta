import { ConnectorBase } from "@terraquantech/rosetta-core";
import type { ConnectorClientInfo } from "@terraquantech/rosetta-core";
import type { ServerWebSocket } from "bun";

export class ConnectorServer extends ConnectorBase {
	private server: ReturnType<typeof Bun.serve> | null = null;
	private wsToClient = new Map<ServerWebSocket<unknown>, ConnectorClientInfo>();

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
				if (url.pathname === "/health") {
					return Response.json({ status: "ok", version: "0.1.0" });
				}
				return new Response("Rosetta Connector", { status: 200 });
			},
			websocket: {
				open: (ws) => {
					const client = this.addClient({ send: (data) => ws.send(data) });
					this.wsToClient.set(ws, client);
				},
				message: (ws, message) => {
					const client = this.wsToClient.get(ws);
					if (client) {
						this.processMessage(client, String(message));
					}
				},
				close: (ws) => {
					const client = this.wsToClient.get(ws);
					if (client) {
						this.removeClient(client);
						this.wsToClient.delete(ws);
					}
				},
			},
		});

		console.log(`[connector] Listening on ws://localhost:${this._port}/ws`);
	}

	stop(): void {
		this.server?.stop();
		this.wsToClient.clear();
		this.clearClients();
	}
}
