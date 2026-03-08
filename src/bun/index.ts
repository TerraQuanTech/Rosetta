// Main entry point - checks CLI mode before loading UI
const args = process.argv.slice(2);
const cliCommand = args[0];

// CLI mode is enabled if: has a recognized command, has a help flag, or has a subcommand flag
const isCliMode =
	(cliCommand &&
		["missing", "stats", "complete", "help", "list-locales", "list-keys", "add-locale"].includes(
			cliCommand,
		)) ||
	args.includes("--help") ||
	args.includes("-h") ||
	args.some((arg) => arg.startsWith("-"));

if (isCliMode) {
	// CLI mode
	const { handleCliMode } = await import("./cli-mode.ts");
	await handleCliMode();
	process.exit(0);
}

// UI mode
await import("./index-ui.ts");
