import type { KeyUpdate } from "./types";

export interface ConnectorTransport {
	send(data: string): void;
}

export interface ConnectorClientInfo {
	transport: ConnectorTransport;
	appName?: string;
}

type StatusListener = (connected: boolean, clients: number) => void;

export abstract class ConnectorBase {
	protected clients = new Set<ConnectorClientInfo>();
	private statusListeners = new Set<StatusListener>();
	protected _port: number;

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

	get connectedApps(): string[] {
		return [...this.clients].map((c) => c.appName || "Unknown").filter(Boolean);
	}

	updatePort(port: number): void {
		this._port = port;
	}

	onStatusChange(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	protected notifyStatus(): void {
		const connected = this.connected;
		const count = this.clientCount;
		for (const listener of this.statusListeners) {
			listener(connected, count);
		}
	}

	protected addClient(transport: ConnectorTransport): ConnectorClientInfo {
		const client: ConnectorClientInfo = { transport };
		this.clients.add(client);
		console.log(`[connector] App connected (${this.clients.size} total)`);
		this.notifyStatus();
		return client;
	}

	protected removeClient(client: ConnectorClientInfo): void {
		this.clients.delete(client);
		console.log(`[connector] App disconnected (${this.clients.size} total)`);
		this.notifyStatus();
	}

	protected processMessage(client: ConnectorClientInfo, raw: string): void {
		try {
			const data = JSON.parse(raw);
			if (data.type === "hello") {
				client.appName = data.appName;
				console.log(`[connector] App identified: ${data.appName}`);
				this.notifyStatus();
			}
		} catch {}
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
				client.transport.send(message);
			} catch {}
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
				client.transport.send(message);
			} catch {}
		}
	}

	protected clearClients(): void {
		this.clients.clear();
		this.notifyStatus();
	}

	abstract start(): void;
	abstract stop(): void;
}
