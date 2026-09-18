# Security

Launchpad is built around a small, explicit set of guarantees. If you find a
way to break any of them, that is a security bug — please report it.

## What the app promises

1. **Launching is the exact equivalent of double-clicking.** `.exe` files are started with `child_process.spawn` (no shell, no arguments), `.lnk` shortcuts with `shell.openPath`, and links with `shell.openExternal`. No command string is ever assembled.
2. **The UI can only launch by ID.** The path comes from the launcher's own database; the renderer never supplies a path to run.
3. **Only `.exe`, `.lnk`, `steam://` and `https://` are accepted**, and the allowlist is applied when an entry is saved, when a backup is imported and again at launch time.
4. **Nothing outside `%APPDATA%\Launchpad\` is ever created, modified or deleted.** "Remove from Library" deletes a database row. The only file deletions the app performs are of image copies it created itself, inside its own `assets\` folder.
5. **The window is a locked-down webview**: context isolation, sandbox, no Node integration, strict CSP, navigation and pop-ups blocked, images served only from the assets folder through a custom `cover://` protocol.
6. **No network.** The app makes no requests, has no updater and sends no telemetry.

The code that enforces these lives in `src/main/` — see the README for the file map — and `npm run smoke` exercises the boundaries (rejected file types and URI schemes, path traversal in asset names, malicious backup entries, etc.).

## Reporting

Please use GitHub's private vulnerability reporting on this repository ("Security" tab → "Report a vulnerability"), or open an issue if the problem is not sensitive. Include the version (Settings → General) and steps to reproduce.

## Scope notes

- Launchpad runs as your user and starts programs *you* added. It cannot protect you from what those programs do.
- Release binaries are not code-signed, so Windows SmartScreen shows a warning on first run. Every release ships a `SHA256SUMS.txt` so you can verify the download against what the CI built.
