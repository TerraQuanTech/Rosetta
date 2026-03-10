import { join } from "node:path";
import {
	NodeFsAdapter,
	ReviewManager,
	SettingsManager,
	TranslationFileStore,
} from "@terraquantech/rosetta-core";
import type {
	KeyCreate,
	KeyDelete,
	KeyRename,
	KeyUpdate,
	NamespaceCreate,
	NamespaceDelete,
	ReviewToggle,
	RosettaSettings,
	TranslationStore,
} from "@terraquantech/rosetta-core";
import * as vscode from "vscode";
import { NodeConnectorServer } from "./connector";

interface RpcRequest {
	type: "request";
	id: number;
	method: string;
	params: Record<string, unknown>;
}

export class RosettaPanel implements vscode.Disposable {
	static current: RosettaPanel | undefined;
	private static readonly viewType = "rosetta.editor";

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionUri: vscode.Uri;
	private disposables: vscode.Disposable[] = [];

	private fs = new NodeFsAdapter();
	private store: TranslationFileStore;
	private reviews: ReviewManager;
	private settings: SettingsManager;
	private connector: NodeConnectorServer;
	private watcher: vscode.FileSystemWatcher | undefined;
	private currentLocalesDir = "";
	private workspaceState: vscode.Memento;

	private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
		this.panel = panel;
		this.extensionUri = context.extensionUri;
		this.workspaceState = context.workspaceState;

		const config = vscode.workspace.getConfiguration("rosetta");
		const connectorPort = config.get<number>("connectorPort", 4871);

		const settingsPath = join(context.globalStorageUri.fsPath, "settings.json");
		this.store = new TranslationFileStore("", this.fs);
		this.reviews = new ReviewManager(this.fs);
		this.settings = new SettingsManager(settingsPath, this.fs);
		this.connector = new NodeConnectorServer(connectorPort);

		this.panel.webview.html = this.getHtml();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(msg) => this.handleMessage(msg),
			null,
			this.disposables,
		);

		this.initialize(context);
	}

	static createOrShow(context: vscode.ExtensionContext): void {
		if (RosettaPanel.current) {
			RosettaPanel.current.panel.reveal(vscode.ViewColumn.One);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			RosettaPanel.viewType,
			"Rosetta",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")],
			},
		);

		RosettaPanel.current = new RosettaPanel(panel, context);
	}

	private async initialize(context: vscode.ExtensionContext) {
		await this.fs.mkdir(context.globalStorageUri.fsPath);
		await this.settings.load();

		// Default to manual save mode in VS Code
		if (this.settings.get().saveMode === "auto") {
			await this.settings.update({ saveMode: "manual" });
		}

		const config = vscode.workspace.getConfiguration("rosetta");
		const configuredDir = config.get<string>("localesDir", "");
		const connectorEnabled = config.get<boolean>("connectorEnabled", true);

		// Priority: VS Code setting > last-used path from workspace state
		const lastDir = this.workspaceState.get<string>("lastLocalesDir", "");
		const dirToLoad = configuredDir || lastDir;

		if (dirToLoad) {
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const isRelative = !dirToLoad.startsWith("/");
			const resolvedDir = isRelative && workspaceRoot ? join(workspaceRoot, dirToLoad) : dirToLoad;
			try {
				await this.loadLocalesDir(resolvedDir);
			} catch (err) {
				console.error(`Failed to load locales from "${resolvedDir}":`, err);
			}
		}

		if (connectorEnabled) {
			this.connector.start();
		}

		this.connector.onStatusChange((connected, clientCount) => {
			this.postMessage("connectorStatusChanged", {
				connected,
				clientCount,
				apps: this.connector.connectedApps,
			});
		});
	}

	private async loadLocalesDir(dir: string): Promise<void> {
		this.currentLocalesDir = dir;
		await this.workspaceState.update("lastLocalesDir", dir);
		this.store = new TranslationFileStore(dir, this.fs);
		await this.store.load();
		await this.reviews.load(dir);

		this.watcher?.dispose();
		this.watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(vscode.Uri.file(dir), "**/*.json"),
		);

		const handleChange = async () => {
			await this.store.load();
			this.sendStoreUpdate();
		};

		this.watcher.onDidChange(handleChange);
		this.watcher.onDidCreate(handleChange);
		this.watcher.onDidDelete(handleChange);
		this.disposables.push(this.watcher);

		this.sendStoreUpdate();
	}

	private sendStoreUpdate(): void {
		this.postMessage("storeUpdated", {
			...this.store.getStore(),
			reviews: this.reviews.get(),
			localesDir: this.currentLocalesDir,
		});
	}

	private postMessage(name: string, data: unknown): void {
		this.panel.webview.postMessage({ type: "message", name, data });
	}

	private async handleMessage(msg: RpcRequest): Promise<void> {
		if (msg.type !== "request") return;

		try {
			const result = await this.handleRpcRequest(msg.method, msg.params);
			this.panel.webview.postMessage({
				type: "response",
				id: msg.id,
				result,
			});
		} catch (err) {
			this.panel.webview.postMessage({
				type: "response",
				id: msg.id,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	private async handleRpcRequest(
		method: string,
		params: Record<string, unknown>,
	): Promise<unknown> {
		switch (method) {
			case "getStore":
				return {
					...this.store.getStore(),
					reviews: this.reviews.get(),
					localesDir: this.currentLocalesDir,
				} satisfies TranslationStore;

			case "updateKey": {
				const p = params as unknown as KeyUpdate;
				const ok = await this.store.updateKey(p);
				if (ok) {
					this.connector.broadcastUpdate(p);
					await this.reviews.clearReview(p.namespace, p.key, p.locale);
				}
				return { ok };
			}

			case "createKey": {
				const p = params as unknown as KeyCreate;
				const ok = await this.store.createKey(p);
				if (ok) {
					for (const locale of Object.keys(p.values)) {
						this.connector.broadcastReload(p.namespace, locale);
					}
				}
				return { ok };
			}

			case "deleteKey": {
				const p = params as unknown as KeyDelete;
				const ok = await this.store.deleteKey(p);
				if (ok) {
					for (const locale of this.store.getStore().locales) {
						this.connector.broadcastReload(p.namespace, locale);
					}
				}
				return { ok };
			}

			case "renameKey": {
				const p = params as unknown as KeyRename;
				const ok = await this.store.renameKey(p);
				if (ok) {
					for (const locale of this.store.getStore().locales) {
						this.connector.broadcastReload(p.namespace, locale);
					}
				}
				return { ok };
			}

			case "createNamespace": {
				const p = params as unknown as NamespaceCreate;
				const ok = await this.store.createNamespace(p.namespace);
				if (ok) this.sendStoreUpdate();
				return { ok };
			}

			case "deleteNamespace": {
				const p = params as unknown as NamespaceDelete;
				const ok = await this.store.deleteNamespace(p.namespace);
				if (ok) this.sendStoreUpdate();
				return { ok };
			}

			case "addLocale": {
				const { locale, copyFrom } = params as { locale: string; copyFrom?: string };
				const ok = await this.store.addLocale(locale, copyFrom);
				if (ok) this.sendStoreUpdate();
				return { ok };
			}

			case "removeLocale": {
				const { locale } = params as { locale: string };
				const ok = await this.store.removeLocale(locale);
				if (ok) this.sendStoreUpdate();
				return { ok };
			}

			case "openLocalesDir": {
				const uris = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					defaultUri: this.currentLocalesDir
						? vscode.Uri.file(this.currentLocalesDir)
						: vscode.workspace.workspaceFolders?.[0]?.uri,
					openLabel: "Select Locales Directory",
				});
				const selected = uris?.[0]?.fsPath;
				if (selected) {
					await this.loadLocalesDir(selected);
				}
				return { path: selected ?? null };
			}

			case "getConnectorStatus":
				return {
					connected: this.connector.connected,
					port: this.connector.port,
				};

			case "getSettings":
				return this.settings.get();

			case "updateSettings": {
				const partial = params as Partial<RosettaSettings>;
				const updated = await this.settings.update(partial);

				if (partial.connectorEnabled !== undefined || partial.connectorPort !== undefined) {
					this.connector.stop();
					if (updated.connectorEnabled) {
						this.connector.updatePort(updated.connectorPort);
						this.connector.start();
					}
				}

				this.postMessage("settingsUpdated", updated);
				return { ok: true };
			}

			case "toggleReview": {
				const p = params as unknown as ReviewToggle;
				const ok = await this.reviews.toggle(p);
				return { ok };
			}

			case "windowReady":
				return { ok: true };

			case "setWindowTitle":
				return { ok: true };

			case "installCli":
				return { success: false, message: "CLI install is not available in VS Code" };

			default:
				throw new Error(`Unknown RPC method: ${method}`);
		}
	}

	private getHtml(): string {
		const webview = this.panel.webview;
		const distUri = vscode.Uri.joinPath(this.extensionUri, "dist", "webview");
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, "webview.js"));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, "webview.css"));
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
	<link rel="stylesheet" href="${styleUri}">
	<title>Rosetta</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	dispose(): void {
		RosettaPanel.current = undefined;
		this.connector.stop();
		this.watcher?.dispose();
		this.panel.dispose();
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables = [];
	}
}

function getNonce(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 32; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}
