# rosetta-connect

Live-reload translations from [Rosetta](https://github.com/TerraQuantTech/Rosetta) into your running app. When you edit a translation in Rosetta, it appears in your app instantly — no restart needed.

## Install

```bash
npm install rosetta-connect
# or
bun add rosetta-connect
```

Peer dependency: `i18next >= 21.0.0`

## Quick Start

```ts
import i18next from "i18next";
import { connectRosetta } from "rosetta-connect";

// Connect only in development
if (process.env.NODE_ENV === "development") {
	const disconnect = connectRosetta(i18next);
	// Call disconnect() on cleanup
}
```

## How It Works

Rosetta runs a WebSocket server (default port `4871`). This library connects to it and listens for two types of messages:

- **`translation:update`** — a single key changed. Applied via `addResourceBundle()` with deep merge, then triggers a React re-render via `languageChanged` event.
- **`translation:reload`** — a namespace was restructured (key added/deleted/renamed). Triggers `reloadResources()` to re-fetch from your backend/files.

## Usage with Electron

### Renderer process (recommended)

```ts
// preload.ts or renderer entry
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { connectRosetta } from "rosetta-connect";

await i18next.use(initReactI18next).init({
	// your config...
});

if (process.env.NODE_ENV === "development") {
	connectRosetta(i18next, { port: 4871 });
}
```

### Built Electron app

The connector works the same way in packaged builds — just ensure:

1. Rosetta is running with the connector enabled (Settings > Live Preview Connector)
2. Your app connects on the same port
3. You gate the connection behind a dev/debug flag so it doesn't run in production

```ts
// For built apps, you might use a feature flag
if (window.__ROSETTA_DEV__) {
	connectRosetta(i18next);
}
```

## Usage with Vite / webpack dev server

Works in any browser environment that has WebSocket support:

```ts
import i18next from "i18next";
import { connectRosetta } from "rosetta-connect";

// In your app entry
if (import.meta.env.DEV) {
	connectRosetta(i18next);
}
```

## Options

```ts
connectRosetta(i18next, {
	// Rosetta connector port (default: 4871)
	port: 4871,

	// How often to retry connection (default: 3000ms)
	reconnectInterval: 3000,

	// Log events to console (default: true in dev)
	verbose: true,

	// App name shown in Rosetta's status bar
	appName: "My App",

	// How to apply single-key updates:
	// "bundle" (default) — addResourceBundle with deep merge
	// "resource" — addResource (more granular)
	updateStrategy: "bundle",
});
```

## Platform Support

| Platform | Environment            | Status                                |
| -------- | ---------------------- | ------------------------------------- |
| macOS    | Electron renderer      | Supported                             |
| macOS    | Electron main process  | Supported                             |
| Windows  | Electron renderer      | Supported                             |
| Windows  | Electron main process  | Supported                             |
| Linux    | Electron renderer      | Supported                             |
| Linux    | Electron main process  | Supported                             |
| Any      | Browser (Vite/webpack) | Supported                             |
| Any      | Node.js (SSR, scripts) | Supported (Node 22+ or `ws` polyfill) |

The connector uses the standard `WebSocket` API, which is available in all modern browsers, Electron (both main and renderer), and Node.js 22+. For older Node.js versions, you'll need a WebSocket polyfill like `ws`.

## How React Re-renders Work

When Rosetta updates a translation:

1. The new value is injected into i18next's resource store
2. A `languageChanged` event is emitted on the i18next instance
3. `react-i18next`'s `useTranslation` hook listens for this event and triggers a re-render
4. Your components display the updated text

This works with `useTranslation()`, `<Trans>`, `withTranslation()`, and any other react-i18next binding.

## Cleanup

`connectRosetta()` returns a disconnect function:

```ts
const disconnect = connectRosetta(i18next);

// Later, to clean up:
disconnect();
```

In React, use it in a useEffect:

```ts
useEffect(() => {
	if (process.env.NODE_ENV !== "development") return;
	return connectRosetta(i18next);
}, []);
```

## Troubleshooting

**App doesn't connect:**

- Check that Rosetta is running and the connector is enabled (Settings > Live Preview Connector)
- Verify the port matches (default: 4871)
- Check the browser console for `[rosetta-connect]` log messages

**Translations update but UI doesn't refresh:**

- Ensure you're using `react-i18next` with `useTranslation()` or `<Trans>` components
- Static strings from `i18next.t()` called outside React won't auto-update

**`reloadResources` doesn't work:**

- This requires your i18next backend to support reloading (e.g., `i18next-http-backend` or `i18next-fs-backend`)
- If you bundle translations at build time, only single-key `translation:update` messages will work (which covers most editing scenarios)
