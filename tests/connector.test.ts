import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ConnectorServer } from "../src/bun/connector";

let server: ConnectorServer;
const TEST_PORT = 14871;

beforeEach(() => {
	server = new ConnectorServer(TEST_PORT);
});

afterEach(() => {
	server.stop();
});

describe("ConnectorServer", () => {
	test("starts and accepts WebSocket connections", async () => {
		server.start();
		expect(server.connected).toBe(false);
		expect(server.clientCount).toBe(0);

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		// Give the server a moment to register the client
		await Bun.sleep(50);
		expect(server.connected).toBe(true);
		expect(server.clientCount).toBe(1);

		ws.close();
		await Bun.sleep(50);
		expect(server.connected).toBe(false);
	});

	test("health check endpoint", async () => {
		server.start();
		const res = await fetch(`http://localhost:${TEST_PORT}/health`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("ok");
	});

	test("root endpoint returns identifier", async () => {
		server.start();
		const res = await fetch(`http://localhost:${TEST_PORT}/`);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe("Rosetta Connector");
	});

	test("tracks app name from hello message", async () => {
		server.start();

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		ws.send(JSON.stringify({ type: "hello", appName: "TestApp" }));
		await Bun.sleep(50);

		expect(server.connectedApps).toEqual(["TestApp"]);

		ws.close();
		await Bun.sleep(50);
	});

	test("broadcasts translation updates to connected clients", async () => {
		server.start();

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		const received: any[] = [];
		ws.onmessage = (event) => {
			received.push(JSON.parse(event.data as string));
		};

		await Bun.sleep(50);

		server.broadcastUpdate({
			namespace: "common",
			key: "hello",
			locale: "en",
			value: "Hello!",
		});

		await Bun.sleep(50);

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({
			type: "translation:update",
			namespace: "common",
			key: "hello",
			locale: "en",
			value: "Hello!",
		});

		ws.close();
		await Bun.sleep(50);
	});

	test("broadcasts reload messages", async () => {
		server.start();

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		const received: any[] = [];
		ws.onmessage = (event) => {
			received.push(JSON.parse(event.data as string));
		};

		await Bun.sleep(50);

		server.broadcastReload("common", "en");

		await Bun.sleep(50);

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({
			type: "translation:reload",
			namespace: "common",
			locale: "en",
		});

		ws.close();
		await Bun.sleep(50);
	});

	test("notifies status listeners on connect/disconnect", async () => {
		server.start();

		const events: { connected: boolean; count: number }[] = [];
		server.onStatusChange((connected, count) => {
			events.push({ connected, count });
		});

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});
		await Bun.sleep(50);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ connected: true, count: 1 });

		ws.close();
		await Bun.sleep(50);

		expect(events).toHaveLength(2);
		expect(events[1]).toEqual({ connected: false, count: 0 });
	});

	test("handles multiple clients", async () => {
		server.start();

		const ws1 = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws1.onopen = () => resolve();
		});
		await Bun.sleep(50);
		expect(server.clientCount).toBe(1);

		const ws2 = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws2.onopen = () => resolve();
		});
		await Bun.sleep(50);
		expect(server.clientCount).toBe(2);

		// Both should receive broadcasts
		const received1: any[] = [];
		const received2: any[] = [];
		ws1.onmessage = (event) => received1.push(JSON.parse(event.data as string));
		ws2.onmessage = (event) => received2.push(JSON.parse(event.data as string));

		server.broadcastUpdate({
			namespace: "test",
			key: "foo",
			locale: "en",
			value: "bar",
		});

		await Bun.sleep(50);
		expect(received1).toHaveLength(1);
		expect(received2).toHaveLength(1);

		ws1.close();
		await Bun.sleep(50);
		expect(server.clientCount).toBe(1);

		ws2.close();
		await Bun.sleep(50);
		expect(server.clientCount).toBe(0);
	});

	test("unsubscribe from status listener", async () => {
		server.start();

		const events: boolean[] = [];
		const unsubscribe = server.onStatusChange((connected) => {
			events.push(connected);
		});

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});
		await Bun.sleep(50);
		expect(events).toHaveLength(1);

		// Unsubscribe
		unsubscribe();

		ws.close();
		await Bun.sleep(50);

		// Should not get the disconnect event
		expect(events).toHaveLength(1);
	});

	test("stop clears all clients and notifies", async () => {
		server.start();

		const events: { connected: boolean; count: number }[] = [];
		server.onStatusChange((connected, count) => {
			events.push({ connected, count });
		});

		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});
		await Bun.sleep(50);

		server.stop();

		// Should notify disconnection
		expect(events.at(-1)).toEqual({ connected: false, count: 0 });
		expect(server.clientCount).toBe(0);
	});

	test("updatePort changes the port", () => {
		expect(server.port).toBe(TEST_PORT);
		server.updatePort(9999);
		expect(server.port).toBe(9999);
	});
});
