# Rosetta

A visual i18n translation editor for JSON locale files. Built with [Electrobun](https://electrobun.dev), it runs as a lightweight native desktop app (~15 MB) with a modern React-based UI.

Rosetta connects to your running Electron app via WebSocket and hot-reloads translations in real time as you edit them — no app restart needed.

## Features

- Browse and edit i18n JSON files in a spreadsheet-like table
- Namespace tree sidebar with folder grouping
- Search and filter (all / missing translations)
- Live preview: edits push to your running app instantly via `rosetta-connect`
- Dark and light theme (follows system preference)
- Supports nested JSON structures with dot-notation flattening

## Project structure

```
src/
  bun/          # Main process (Electrobun/Bun runtime)
    index.ts    # Window creation, RPC handlers
    store.ts    # In-memory translation store with disk sync
    watcher.ts  # File watcher (chokidar)
    connector.ts # WebSocket server for live preview
  ui/           # Webview (React + Vite)
    App.tsx     # Root component
    components/ # Sidebar, EditorTable, Toolbar, StatusBar, EditableCell
    hooks/      # useStore (RPC bridge)
    styles/     # CSS with custom properties
  shared/       # Types and utilities shared between bun and ui
packages/
  rosetta-connect/ # npm package for Electron app integration
tests/             # bun:test suite
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- [Electrobun](https://electrobun.dev) CLI

### Install

```bash
bun install
```

### Development

```bash
# Build UI and start the app
bun start

# Or with Vite HMR (two terminals):
bun run hmr        # Start Vite dev server
bun run dev        # Start Electrobun in dev mode

# Or combined:
bun run dev:hmr
```

Pass a locales directory as the first argument:

```bash
bun start -- /path/to/your/locales
```

### Scripts

```bash
bun test            # Run tests
bun run lint        # Check lint (Biome)
bun run lint:fix    # Auto-fix lint issues
bun run format      # Format code (Biome)
bun run typecheck   # TypeScript type checking
```

### Build

```bash
bun run build           # Production build (stable)
bun run build:canary    # Canary build
```

## Live preview with `rosetta-connect`

Install the connector in your Electron app:

```bash
npm install rosetta-connect
```

Then wire it up in development:

```ts
import i18next from "i18next";
import { connectRosetta } from "rosetta-connect";

if (process.env.NODE_ENV === "development") {
	const disconnect = connectRosetta(i18next, { port: 4871 });

	// Call disconnect() to stop
}
```

When Rosetta is running and your app is connected, any translation edit in Rosetta is immediately reflected in your app.

### Connector options

| Option              | Default | Description           |
| ------------------- | ------- | --------------------- |
| `port`              | `4871`  | WebSocket port        |
| `reconnectInterval` | `3000`  | Reconnect delay (ms)  |
| `verbose`           | `true`  | Log connection events |

## Locale directory structure

Rosetta expects the standard i18next file layout:

```
locales/
  en/
    common.json
    components/
      plot.json
  fr/
    common.json
    components/
      plot.json
```

Each top-level directory is a locale. JSON files (and subdirectories) become namespaces. Nested JSON keys are flattened with dot notation for the editor table.

## License

[MIT](LICENSE)
