// Main entry point - checks CLI mode before loading UI
// CLI format: rosetta <dir> <command> [args]
const args = process.argv.slice(2);
const cliCommands = [
	"missing",
	"stats",
	"complete",
	"help",
	"list-locales",
	"list-keys",
	"add-locale",
];

const isCliMode =
	args.includes("--help") ||
	args.includes("-h") ||
	args.includes("--version") ||
	args.includes("-V") ||
	args.some((arg) => cliCommands.includes(arg));

if (isCliMode) {
	const { handleCliMode } = await import("./cli-mode.ts");
	await handleCliMode();
	process.exit(0);
}

// UI mode
await import("./index-ui.ts");
