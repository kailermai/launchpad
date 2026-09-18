import type { LauncherApi } from '@shared/types'

/** The only way the UI talks to the rest of the machine: the preload bridge. */
export const api: LauncherApi = window.launcher

/** Covers and icons are served by the main process from the launcher's own assets folder. */
export function assetUrl(fileName: string | null | undefined): string | null {
  return fileName ? `cover://local/${encodeURIComponent(fileName)}` : null
}
