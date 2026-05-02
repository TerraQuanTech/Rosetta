import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ConnectorBase } from "@terraquantech/rosetta-core";
import type { ConnectorClientInfo } from "@terraquantech/rosetta-core";
import type { ServerWebSocket } from "bun";

const MIME_TYPES: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".png": "image/png",
	".json": "application/json",
	".xml": "application/xml",
};

function findAddinDir(): string | null {
	const candidates = [
		resolve(import.meta.dir, "..", "pptx-addin-dist"),
		resolve(import.meta.dir, "..", "..", "pptx-addin", "dist"),
		resolve(process.cwd(), "pptx-addin", "dist"),
	];
	for (const dir of candidates) {
		try {
			if (statSync(join(dir, "taskpane.html")).isFile()) return dir;
		} catch {}
	}
	return null;
}

function loadAddinFiles(): Map<string, { content: Buffer; mime: string }> {
	const files = new Map<string, { content: Buffer; mime: string }>();
	const dir = findAddinDir();
	if (!dir) {
		console.log("[connector] PPTX add-in files not found — /addin/ routes disabled");
		return files;
	}
	console.log(`[connector] Loaded PPTX add-in from ${dir}`);

	function walk(base: string, prefix: string) {
		for (const entry of readdirSync(base, { withFileTypes: true })) {
			const fullPath = join(base, entry.name);
			const urlPath = prefix + entry.name;
			if (entry.isDirectory()) {
				walk(fullPath, `${urlPath}/`);
			} else if (entry.name !== "manifest.xml") {
				const ext = entry.name.slice(entry.name.lastIndexOf("."));
				files.set(urlPath, {
					content: readFileSync(fullPath),
					mime: MIME_TYPES[ext] || "application/octet-stream",
				});
			}
		}
	}
	walk(dir, "");
	return files;
}

const addinFiles = loadAddinFiles();

function generateManifest(port: number): string {
	const base = `http://localhost:${port}/addin`;
	return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:type="TaskPaneApp">
  <Id>a1b2c3d4-e5f6-7890-abcd-ef1234567890</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>TerraQuanTech</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="Rosetta Translate" />
  <Description DefaultValue="Live translation preview for PowerPoint presentations." />
  <IconUrl DefaultValue="${base}/assets/icon-32.png" />
  <HighResolutionIconUrl DefaultValue="${base}/assets/icon-64.png" />
  <SupportUrl DefaultValue="https://github.com/TerraQuanTech/rosetta" />
  <Hosts>
    <Host Name="Presentation" />
  </Hosts>
  <DefaultSettings>
    <SourceLocation DefaultValue="${base}/taskpane.html" />
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
</OfficeApp>`;
}

export class ConnectorServer extends ConnectorBase {
	private server: ReturnType<typeof Bun.serve> | null = null;
	private wsToClient = new Map<ServerWebSocket<unknown>, ConnectorClientInfo>();

	getManifestXml(): string {
		return generateManifest(this._port);
	}

	start(): void {
		const self = this;
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
				if (url.pathname === "/addin/manifest.xml") {
					return new Response(self.getManifestXml(), {
						headers: { "Content-Type": "application/xml", "Access-Control-Allow-Origin": "*" },
					});
				}
				if (url.pathname.startsWith("/addin/")) {
					const filePath = url.pathname.slice("/addin/".length) || "taskpane.html";
					const file = addinFiles.get(filePath);
					if (file) {
						return new Response(new Uint8Array(file.content), {
							headers: { "Content-Type": file.mime, "Access-Control-Allow-Origin": "*" },
						});
					}
					return new Response("Not found", { status: 404 });
				}
				if (url.pathname === "/addin" || url.pathname === "/addin/") {
					const file = addinFiles.get("taskpane.html");
					if (file) {
						return new Response(new Uint8Array(file.content), {
							headers: { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" },
						});
					}
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
