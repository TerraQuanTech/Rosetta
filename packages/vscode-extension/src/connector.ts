import { ConnectorBase } from "@terraquantech/rosetta-core";
import type { ConnectorClientInfo } from "@terraquantech/rosetta-core";
import { type WebSocket, WebSocketServer } from "ws";

export class NodeConnectorServer extends ConnectorBase {
	private server: WebSocketServer | null = null;
	private wsToClient = new Map<WebSocket, ConnectorClientInfo>();

	start(): void {
		this.server = new WebSocketServer({ port: this._port });

		this.server.on("connection", (ws) => {
			const client = this.addClient({ send: (data) => ws.send(data) });
			this.wsToClient.set(ws, client);

			ws.on("message", (raw) => {
				this.processMessage(client, String(raw));
			});

			ws.on("close", () => {
				this.removeClient(client);
				this.wsToClient.delete(ws);
			});
		});

		console.log(`[connector] Listening on ws://localhost:${this._port}/ws`);
	}

	stop(): void {
		if (this.server) {
			for (const ws of this.wsToClient.keys()) {
				ws.close();
			}
			this.server.close();
			this.server = null;
		}
		this.wsToClient.clear();
		this.clearClients();
	}
}
