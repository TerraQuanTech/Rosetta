import * as vscode from "vscode";
import { RosettaPanel } from "./webview-provider";

export function activate(context: vscode.ExtensionContext) {
	const openCommand = vscode.commands.registerCommand("rosetta.open", () => {
		RosettaPanel.createOrShow(context);
	});

	context.subscriptions.push(openCommand);

	if (RosettaPanel.current) {
		context.subscriptions.push(RosettaPanel.current);
	}
}

export function deactivate() {
	RosettaPanel.current?.dispose();
}
