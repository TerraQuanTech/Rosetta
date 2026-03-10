# Rosetta — Setup Guide

## The editor

### Opening a project

Launch Rosetta and click **Open Locales Folder** (or `Cmd/Ctrl+O`). Point it at the root directory that contains your locale subdirectories:

```
locales/          <-- open this
  en/
    common.json
    pages/
      home.json
  fr/
    common.json
```

Rosetta auto-detects locales (top-level directories) and namespaces (JSON files and subdirectories within each locale).

### Editing translations

- Click a key row to expand the rich editor with per-locale fields
- Double-click a key name to rename it inline
- Right-click a row for context menu actions (focus, rename)
- Empty cells with a red tint are missing translations; yellow tint means empty strings

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+F` | Focus search |
| `Cmd/Ctrl+K` | Search current namespace |
| `Cmd/Ctrl+L` | Search all namespaces |
| `Cmd/Ctrl+M` | Toggle missing filter |
| `Cmd/Ctrl+S` | Save (manual save mode) |
| `Cmd/Ctrl+.` | Toggle settings |
| `Escape` | Blur search / close dialogs |

### Save modes

- **Auto** (default): Every edit is written to disk immediately.
- **Manual**: Edits are buffered. Save explicitly with `Cmd/Ctrl+S` or the toolbar button. A `*` in the title bar indicates unsaved changes.

Switch between modes in Settings.

### Review tracking

Mark individual translations as reviewed by clicking the checkmark button on each cell. Filter by "Unreviewed" in the toolbar to see what still needs attention. Reviews are stored in a `.rosetta-reviews.json` file alongside your locales.

### Adding and removing locales

Use the locale picker (toolbar, right side) to show/hide locales in the editor. From there you can also add a new locale (optionally copying values from an existing one) or remove a locale entirely.

---

## Live preview connector

The connector lets your running app receive translation updates from Rosetta in real time over WebSocket.

### Install

```bash
npm install @terraquant/rosetta-connect
```

### Basic setup (i18next)

```ts
import i18next from "i18next";
import { connectRosetta } from "rosetta-connect";

// Only connect in development
if (process.env.NODE_ENV === "development") {
    const disconnect = connectRosetta(i18next);
    // Call disconnect() on cleanup
}
```

### React

```ts
import { useEffect } from "react";
import i18next from "i18next";
import { connectRosetta } from "rosetta-connect";

function App() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "development") return;
        return connectRosetta(i18next);
    }, []);

    // ...
}
```

### Vite

```ts
if (import.meta.env.DEV) {
    connectRosetta(i18next);
}
```

### Options

```ts
connectRosetta(i18next, {
    port: 4871,              // WebSocket port (default: 4871)
    reconnectInterval: 3000, // Retry delay in ms (default: 3000)
    verbose: true,           // Log to console (default: true)
    appName: "My App",       // Shown in Rosetta's status bar
    updateStrategy: "bundle" // "bundle" (default) or "resource"
});
```

### How it works

Rosetta runs a WebSocket server on the configured port (default `4871`). The connector opens a persistent connection and listens for:

- **`translation:update`** — single key changed. Applied via `addResourceBundle()` with deep merge, triggers re-render through i18next's `languageChanged` event.
- **`translation:reload`** — namespace restructured (key added/removed/renamed). Calls `reloadResources()` to re-fetch everything.

### Enable in Rosetta

Go to Settings and toggle **Live Preview Connector**. The port is configurable there. The status bar shows connection status and the names of connected apps.

---

## CLI

The CLI is bundled with the desktop app. Install it from Settings > Install CLI, or use it directly from a build.

### Commands

```bash
# Show missing translations grouped by namespace and locale
rosetta ./locales missing

# Coverage statistics per locale
rosetta ./locales stats

# Exit with code 1 if any translations are missing (for CI)
rosetta ./locales complete

# List all locales
rosetta ./locales list-locales

# List keys in a namespace
rosetta ./locales list-keys common
rosetta ./locales list-keys common --locale=en

# Add a new locale
rosetta ./locales add-locale fr --copy-from en
```

### CI example

```yaml
- name: Check translations
  run: rosetta ./src/locales complete
```

---

## Locale file format

Rosetta works with the standard i18next directory layout. Each locale is a top-level directory. JSON files within are namespaces. Subdirectories create nested namespaces.

```
locales/
  en/
    common.json              -> namespace: "common"
    components/
      plot.json              -> namespace: "components/plot"
  fr/
    common.json
    components/
      plot.json
```

JSON files can use nested objects — Rosetta flattens them with dot notation for editing and preserves the original structure when writing back:

```json
{
    "buttons": {
        "save": "Save",
        "cancel": "Cancel"
    }
}
```

Shows as `buttons.save` and `buttons.cancel` in the editor.
