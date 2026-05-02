import type { IncomingMessage, OutgoingMessage } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface ConnectorOptions {
	port: number;
	onMessage: (msg: IncomingMessage) => void;
	onStatusChange: (status: ConnectionStatus) => void;
	reconnectInterval?: number;
}

export class RosettaConnector {
	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private stopped = false;
	private options: Required<ConnectorOptions>;

	constructor(options: ConnectorOptions) {
		this.options = {
			reconnectInterval: 3000,
			...options,
		};
	}

	connect(): void {
		this.stopped = false;
		this.options.onStatusChange("connecting");

		const url = `ws://localhost:${this.options.port}/ws`;

		try {
			this.ws = new WebSocket(url);

			this.ws.onopen = () => {
				this.options.onStatusChange("connected");
				this.send({ type: "hello", appName: "PowerPoint" });
			};

			this.ws.onmessage = (event) => {
				try {
					const msg: IncomingMessage = JSON.parse(
						typeof event.data === "string" ? event.data : String(event.data),
					);
					this.options.onMessage(msg);
				} catch {
					// ignore malformed messages
				}
			};

			this.ws.onclose = () => {
				this.options.onStatusChange("disconnected");
				this.scheduleReconnect();
			};

			this.ws.onerror = () => {
				// onclose fires after this
			};
		} catch {
			this.scheduleReconnect();
		}
	}

	disconnect(): void {
		this.stopped = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.ws?.close();
		this.ws = null;
		this.options.onStatusChange("disconnected");
	}

	send(msg: OutgoingMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg));
		}
	}

	get isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	updatePort(port: number): void {
		this.options.port = port;
	}

	private scheduleReconnect(): void {
		if (this.stopped) return;
		this.reconnectTimer = setTimeout(() => this.connect(), this.options.reconnectInterval);
	}
}
