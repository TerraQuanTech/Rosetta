import type { ApplicationMenu } from "electrobun/bun";

export function buildApplicationMenu(): Parameters<typeof ApplicationMenu.setApplicationMenu>[0] {
	const menuItems: Parameters<typeof ApplicationMenu.setApplicationMenu>[0] = [];

	// The "app name" menu is macOS-only (About, Hide, Quit live here on Mac)
	if (process.platform === "darwin") {
		menuItems.push({
			label: "Rosetta",
			submenu: [
				{ role: "about" },
				{ type: "divider" },
				{ role: "hide", accelerator: "cmd+h" },
				{ role: "hideOthers", accelerator: "cmd+alt+h" },
				{ role: "showAll" },
				{ type: "divider" },
				{ role: "quit", accelerator: "cmd+q" },
			],
		});
	}

	menuItems.push(
		{
			label: "File",
			submenu: [
				{
					label: "Open Locales Folder...",
					action: "openFolder",
					accelerator: "cmd+o",
				},
				{ type: "divider" },
				{ role: "close", accelerator: "cmd+w" },
			],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo", accelerator: "cmd+z" },
				{ role: "redo", accelerator: "cmd+shift+z" },
				{ type: "divider" },
				{ role: "cut", accelerator: "cmd+x" },
				{ role: "copy", accelerator: "cmd+c" },
				{ role: "paste", accelerator: "cmd+v" },
				{ role: "pasteAndMatchStyle", accelerator: "cmd+shift+v" },
				{ role: "selectAll", accelerator: "cmd+a" },
			],
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize", accelerator: "cmd+m" },
				{ role: "zoom" },
				{ type: "divider" },
				{ role: "toggleFullScreen", accelerator: "cmd+ctrl+f" },
				{ type: "divider" },
				{ role: "bringAllToFront" },
			],
		},
	);

	return menuItems;
}
