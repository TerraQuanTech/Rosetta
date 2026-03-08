import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setNestedValue } from "../packages/rosetta-connect/src";
import { ConnectorServer } from "../src/bun/connector";

const TEST_PORT = 14872;

describe("setNestedValue", () => {
	test("sets a simple key", () => {
		const obj: Record<string, unknown> = {};
		setNestedValue(obj, "hello", "world");
		expect(obj).toEqual({ hello: "world" });
	});

	test("sets a nested dot-notation key", () => {
		const obj: Record<string, unknown> = {};
		setNestedValue(obj, "a.b.c", "value");
		expect(obj).toEqual({ a: { b: { c: "value" } } });
	});

	test("preserves existing siblings", () => {
		const obj: Record<string, unknown> = { a: { x: 1 } };
		setNestedValue(obj, "a.y", "2");
		expect(obj).toEqual({ a: { x: 1, y: "2" } });
	});

	test("overwrites non-object intermediates", () => {
		const obj: Record<string, unknown> = { a: "string" };
		setNestedValue(obj, "a.b", "value");
		expect(obj).toEqual({ a: { b: "value" } });
	});

	test("handles single-level key", () => {
		const obj: Record<string, unknown> = { existing: true };
		setNestedValue(obj, "new", "val");
		expect(obj).toEqual({ existing: true, new: "val" });
	});

	test("handles deeply nested keys", () => {
		const obj: Record<string, unknown> = {};
		setNestedValue(obj, "a.b.c.d.e.f", "deep");
		expect((obj as any).a.b.c.d.e.f).toBe("deep");
	});
});

describe("rosetta-connect integration", () => {
	let server: ConnectorServer;

	beforeEach(() => {
		server = new ConnectorServer(TEST_PORT);
		server.start();
	});

	afterEach(() => {
		server.stop();
	});

	test("client connects and receives hello", async () => {
		const appNames: string[] = [];
		const originalNotify = (server as any).notifyStatus.bind(server);

		// Connect a raw WebSocket simulating the client behavior
		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		ws.send(JSON.stringify({ type: "hello", appName: "TestElectronApp" }));
		await Bun.sleep(50);

		expect(server.connectedApps).toContain("TestElectronApp");

		ws.close();
		await Bun.sleep(50);
	});

	test("client receives translation updates", async () => {
		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		const messages: any[] = [];
		ws.onmessage = (event) => {
			messages.push(JSON.parse(event.data as string));
		};

		await Bun.sleep(50);

		server.broadcastUpdate({
			namespace: "common",
			key: "greeting.hello",
			locale: "en",
			value: "Hi there!",
		});

		await Bun.sleep(50);

		expect(messages).toHaveLength(1);
		expect(messages[0].type).toBe("translation:update");
		expect(messages[0].key).toBe("greeting.hello");
		expect(messages[0].value).toBe("Hi there!");

		ws.close();
		await Bun.sleep(50);
	});

	test("client receives reload messages", async () => {
		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		const messages: any[] = [];
		ws.onmessage = (event) => {
			messages.push(JSON.parse(event.data as string));
		};

		await Bun.sleep(50);

		server.broadcastReload("pages/home", "ru");

		await Bun.sleep(50);

		expect(messages).toHaveLength(1);
		expect(messages[0].type).toBe("translation:reload");
		expect(messages[0].namespace).toBe("pages/home");
		expect(messages[0].locale).toBe("ru");

		ws.close();
		await Bun.sleep(50);
	});

	test("protocol round-trip: update and verify structure", async () => {
		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		// Send hello
		ws.send(JSON.stringify({ type: "hello", appName: "RoundTripTest" }));

		const messages: any[] = [];
		ws.onmessage = (event) => {
			messages.push(JSON.parse(event.data as string));
		};

		await Bun.sleep(50);

		// Simulate Rosetta editing multiple keys
		server.broadcastUpdate({ namespace: "ns1", key: "a.b", locale: "en", value: "val1" });
		server.broadcastUpdate({ namespace: "ns1", key: "a.c", locale: "en", value: "val2" });
		server.broadcastReload("ns2", "fr");

		await Bun.sleep(100);

		expect(messages).toHaveLength(3);
		expect(messages[0].type).toBe("translation:update");
		expect(messages[1].type).toBe("translation:update");
		expect(messages[2].type).toBe("translation:reload");

		// Verify we can reconstruct a bundle from the updates
		const bundle: Record<string, unknown> = {};
		for (const msg of messages.filter((m) => m.type === "translation:update")) {
			setNestedValue(bundle, msg.key, msg.value);
		}
		expect(bundle).toEqual({ a: { b: "val1", c: "val2" } });

		ws.close();
		await Bun.sleep(50);
	});
});
