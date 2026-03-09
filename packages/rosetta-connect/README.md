# rosetta-connect

Live-reload translations from [Rosetta](https://github.com/TerraQuanTech/Rosetta) into your running app. Edit a translation in Rosetta, see it in your app instantly — no restart needed.

## Install

```bash
npm install @terraquantech/rosetta-connect
```

Peer dependency: `i18next >= 21`

## Usage

```ts
import i18next from "i18next";
import { connectRosetta } from "rosetta-connect";

if (process.env.NODE_ENV === "development") {
    const disconnect = connectRosetta(i18next);
}
```

Returns a cleanup function. In React:

```ts
useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    return connectRosetta(i18next);
}, []);
```

## Options

```ts
connectRosetta(i18next, {
    port: 4871,              // WebSocket port (default: 4871)
    reconnectInterval: 3000, // Retry delay in ms (default: 3000)
    verbose: true,           // Log to console (default: true)
    appName: "My App",       // Shown in Rosetta status bar
    updateStrategy: "bundle" // "bundle" (default) or "resource"
});
```

## How it works

Rosetta runs a WebSocket server (default port `4871`). This library connects and listens for:

- **`translation:update`** — single key changed. Applied via `addResourceBundle()` with deep merge, then triggers a React re-render via `languageChanged` event.
- **`translation:reload`** — namespace restructured (key added/deleted/renamed). Triggers `reloadResources()` to re-fetch from your backend.

Works in any environment with WebSocket support: browsers, Electron (main and renderer), Node.js 22+.

## Troubleshooting

**App doesn't connect:** Check that Rosetta is running with the connector enabled (Settings > Live Preview Connector) and the port matches.

**UI doesn't refresh:** Make sure you're using `react-i18next` with `useTranslation()` or `<Trans>`. Static `i18next.t()` calls outside React won't auto-update.

**`reloadResources` has no effect:** Your i18next backend needs to support reloading (e.g. `i18next-http-backend`). If translations are bundled at build time, only single-key updates will work live.
