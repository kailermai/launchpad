// Shared between main, preload and renderer. Keep this the single source of truth
// for what crosses the process boundary.

export type LaunchType = 'executable' | 'shortcut' | 'uri'

export interface Application {
  id: string
  name: string
  launchType: LaunchType
  launchTarget: string
  /** Filename inside the launcher-owned assets folder, or null. */
  coverPath: string | null
  /** Filename of the auto-extracted icon inside the assets folder, or null. */
  iconPath: string | null
  platformId: string | null
  categoryId: string | null
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastLaunchedAt: string | null
  /** Launches started from this launcher. */
  launchCount: number
}

export type SortMode = 'name' | 'recent' | 'most' | 'added'

export interface MissingTarget {
  id: string
  name: string
  launchTarget: string
  message: string
}

export interface ApplicationInput {
  name: string
  launchType: LaunchType
  launchTarget: string
  coverPath?: string | null
  /** Icon asset already extracted at drop time (for .url links); must be a launcher asset. */
  iconPath?: string | null
  platformId?: string | null
  categoryId?: string | null
  favorite?: boolean
}

export interface Platform {
  id: string
  name: string
  sortOrder: number
}

export interface Category {
  id: string
  name: string
  sortOrder: number
}

export interface PickerPreset {
  id: string
  name: string
  applicationIds: string[]
  createdAt: string
  updatedAt: string
}

export interface PickerPresetInput {
  id?: string
  name: string
  applicationIds: string[]
}

/** What the main process learns from a file the user explicitly chose or dropped. */
export interface DroppedFileMeta {
  /** The file that was dropped or picked. */
  path: string
  fileName: string
  launchType: LaunchType
  /** What to store as the launch target: the file path for .exe/.lnk, the URL inside a .url file. */
  launchTarget: string
  suggestedName: string
  /** For .lnk shortcuts: the path the shortcut points at, if it could be read. */
  shortcutTarget: string | null
  /** For .url links: the icon Windows shows for the shortcut, already copied into assets. */
  iconPath: string | null
}

export interface TargetStatus {
  exists: boolean
  /** Human readable explanation when the target is missing. */
  message?: string
}

export type SaveResult =
  | { ok: true; application: Application }
  | { ok: false; reason: 'duplicate'; existing: { id: string; name: string } }
  | { ok: false; reason: 'invalid'; message: string }

export type LaunchResult =
  | { ok: true }
  | { ok: false; code: 'missing' | 'invalid' | 'os_error'; message: string }

export type RestoreMode = 'merge' | 'replace'

export interface BackupSummary {
  token: string
  fileName: string
  version: number
  applications: number
  platforms: number
  categories: number
  presets: number
}

export interface RestoreResult {
  ok: boolean
  message: string
  imported: { applications: number; platforms: number; categories: number; presets: number }
  skipped: number
}

export interface AppInfo {
  version: string
  dataDir: string
}

/** The complete native surface exposed to the UI. Nothing else exists. */
export interface LauncherApi {
  // applications
  listApplications(): Promise<Application[]>
  getApplication(id: string): Promise<Application | null>
  addApplication(input: ApplicationInput): Promise<SaveResult>
  updateApplication(id: string, input: ApplicationInput): Promise<SaveResult>
  removeApplication(id: string): Promise<void>
  setFavorite(id: string, favorite: boolean): Promise<void>
  launchApplication(id: string): Promise<LaunchResult>
  checkApplicationTarget(id: string): Promise<TargetStatus>
  /** Re-reads icons for all file-based entries. Returns the number updated. */
  refreshIcons(): Promise<number>
  /** Read-only check of every entry's launch target; returns the ones that are missing. */
  checkAllTargets(): Promise<MissingTarget[]>

  // files the user explicitly picks
  chooseApplicationFile(): Promise<DroppedFileMeta | null>
  readDroppedFileMetadata(path: string): Promise<DroppedFileMeta | null>
  chooseCoverImage(): Promise<string | null>
  /** Renderer-only helper: turns a dropped File into a path (no disk access). */
  getPathForFile(file: File): string

  // organisation
  listPlatforms(): Promise<Platform[]>
  savePlatform(input: { id?: string; name: string }): Promise<Platform>
  removePlatform(id: string): Promise<void>
  reorderPlatforms(ids: string[]): Promise<void>
  listCategories(): Promise<Category[]>
  saveCategory(input: { id?: string; name: string }): Promise<Category>
  removeCategory(id: string): Promise<void>
  reorderCategories(ids: string[]): Promise<void>

  // random picker presets
  listPresets(): Promise<PickerPreset[]>
  savePreset(input: PickerPresetInput): Promise<PickerPreset>
  deletePreset(id: string): Promise<void>

  // backup
  exportBackup(): Promise<{ ok: boolean; message: string }>
  inspectBackup(): Promise<BackupSummary | null>
  importBackup(token: string, mode: RestoreMode): Promise<RestoreResult>

  // misc
  getAppInfo(): Promise<AppInfo>
  openDataFolder(): Promise<void>
}
