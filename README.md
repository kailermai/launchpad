# Launchpad

A safe, local-first Windows launcher: a clean visual shelf for the games and
applications **you** choose to add. It replaces desktop-shortcut clutter and
nothing more — it never scans your PC, never touches your files, and never
goes online.

## What it does

- Add `.exe` files, `.lnk` shortcuts, `steam://` and `https://` links — manually or by dragging them into the window
- Steam desktop shortcuts (`.url` files) can be dropped too: the `steam://rungameid/…` inside becomes the entry, with the game's icon
- Name and icon are prefilled from the dropped file; you can edit before saving
- Cover art of your choice (a copy is kept in the launcher's own folder)
- Platforms and categories (fully customisable), favorites, search and filters
- Recently launched (tracked only when you press Play here)
- Random picker with saved presets ("Chill", "Multiplayer", …) and three styles: Quick shuffle, Slot machine, Roulette wheel
- JSON backup export / restore (merge or replace)
- Library Health: find entries whose files no longer exist; missing entries are also badged in the library (read-only check on load, can be turned off)
- Remove from Library is undoable for a few seconds (the launcher's own image copies are kept until the undo window closes)
- Multi-select in the Library (Ctrl-click / Shift-click / Space, "Select all") with bulk favourite / platform / category / remove
- Covers: choose a file, paste an image with Ctrl+V, or drop one onto the window while an entry or the Add form is open
- Optional "minimise after launch"; window size/position/maximised state are remembered
- Appearance: three purple palettes (Violet Night, Plum & Gold, Synthwave), grid density, reduce motion — Settings → Appearance
- Keyboard: `Ctrl K` search · `Ctrl N` add · `Ctrl R` random picker · `Esc` close · arrow keys move between cards · `Enter` open · `Ctrl Enter` play · `F` favourite · right-click a card for its menu

## What it deliberately cannot do

| Rule | Where it is enforced |
|---|---|
| Launching is the exact equivalent of double-clicking: `.exe` via `spawn` with no shell and no arguments, `.lnk` via `shell.openPath`, links via `shell.openExternal`. No command string is ever built. | `src/main/launch.ts` |
| The UI can only ask to launch an **ID**; the path is read from the launcher's own database. | `src/main/ipc.ts`, `src/main/launch.ts` |
| Only `.exe`, `.lnk`, `steam://` and `https://` are accepted — checked on save, on backup import and again on launch. | `src/main/validate.ts` |
| The launcher only ever writes inside `%APPDATA%\PersonalLauncher\` (database, copied covers, extracted icons, restore snapshots). Nothing outside it is created, modified or deleted. "Remove from Library" deletes a database row. | `src/main/paths.ts`, `src/main/files.ts` |
| The window is a locked-down webview: context isolation, sandbox, no Node, strict CSP, navigation and pop-ups blocked, images served only from the assets folder via `cover://`. | `src/main/index.ts`, `src/renderer/index.html` |

There is no code for scanning drives, deleting/moving/renaming files, running
shell commands, touching the registry, or making network requests — so none of
it can run.

## Development

```
npm install        # project-local dependencies only
npm run dev        # hot-reloading dev window
npm run typecheck  # main + renderer
npm run smoke      # backend self-test against a throwaway data folder
npm run build      # production bundles into out/
npm run package    # Windows installer + portable exe into release/ (needs electron-builder's NSIS download on first run)
```

Dev-only flags (ignored in packaged builds):

```
electron . --data-dir=<folder>         use another data folder
electron . --route=random --screenshot=shot.png
electron . --route="library?theme=plum" --screenshot=shot.png   (theme override; add=1 opens the Add dialog)
electron . --render-icon=build/icon.png
```

## Layout

```
src/shared/     types + IPC channel names shared by both sides
src/main/       Electron main process: store, validation, launching, files, backup, IPC
src/preload/    the narrow contextBridge API (window.launcher)
src/renderer/   React UI (styles/tokens.css holds the three palettes)
```

Data lives in `%APPDATA%\Launchpad\` (an existing `%APPDATA%\PersonalLauncher\` folder from older builds is renamed in place on first start):

```
launcher.db        SQLite database (written atomically)
assets/            copied covers and extracted icons, UUID-named (unreferenced ones older than an hour are swept at startup)
snapshots/         automatic copies of launcher.db taken before a "Replace" restore
window-state.json  last window size / position
```
