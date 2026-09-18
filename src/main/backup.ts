import { dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { BackupSummary, RestoreMode, RestoreResult } from '../shared/types'
import type { Store } from './db'
import { assetExists } from './files'
import { getPaths } from './paths'
import { isLaunchType, validateLaunchTarget, validateName } from './validate'

/**
 * Backups are launcher metadata only (JSON). They never contain, copy or touch
 * any game or application files.
 *
 * Restoring treats the backup file as untrusted input: every entry goes through
 * the same validators as the Add form, and "Replace" snapshots the current
 * database first so a bad import is always recoverable.
 */

const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 50 * 1024 * 1024

interface BackupFile {
  version: number
  exportedAt: string
  applications: unknown[]
  platforms: unknown[]
  categories: unknown[]
  pickerPresets: unknown[]
}

const pending = new Map<string, { data: BackupFile; expires: number }>()

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function optString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function isoOrNow(v: unknown): string {
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return v
  return new Date().toISOString()
}

// ---- export ------------------------------------------------------------------

export async function exportBackup(win: BrowserWindow, store: Store): Promise<{ ok: boolean; message: string }> {
  const date = new Date().toISOString().slice(0, 10)
  const result = await dialog.showSaveDialog(win, {
    title: 'Export library backup',
    defaultPath: `personal-launcher-backup-${date}.json`,
    filters: [{ name: 'Launcher backup', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false, message: 'Export cancelled.' }

  const data: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    applications: store.listApplications(),
    platforms: store.listLabels('platforms'),
    categories: store.listLabels('categories'),
    pickerPresets: store.listPresets()
  }
  await fs.promises.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8')
  return { ok: true, message: `Backup saved to ${path.basename(result.filePath)}.` }
}

// ---- inspect -----------------------------------------------------------------

export async function inspectBackup(win: BrowserWindow): Promise<BackupSummary | null> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose a backup to restore',
    properties: ['openFile'],
    filters: [{ name: 'Launcher backup', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return loadBackupFile(result.filePaths[0])
}

/** Parses and validates the shape of a backup file the user picked, and registers it for import. */
export async function loadBackupFile(file: string): Promise<BackupSummary> {
  const stat = await fs.promises.stat(file)
  if (!stat.isFile() || stat.size > MAX_BACKUP_BYTES) throw new Error('That file is too large to be a launcher backup.')

  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.promises.readFile(file, 'utf8'))
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isRecord(parsed) || parsed.version !== BACKUP_VERSION) {
    throw new Error('That file is not a Personal Launcher backup (or is from a newer version).')
  }
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const data: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: isoOrNow(parsed.exportedAt),
    applications: arr(parsed.applications),
    platforms: arr(parsed.platforms),
    categories: arr(parsed.categories),
    pickerPresets: arr(parsed.pickerPresets)
  }

  // Expire stale tokens, then register this one.
  const nowMs = Date.now()
  for (const [k, v] of pending) if (v.expires < nowMs) pending.delete(k)
  const token = randomUUID()
  pending.set(token, { data, expires: nowMs + 15 * 60 * 1000 })

  return {
    token,
    fileName: path.basename(file),
    version: data.version,
    applications: data.applications.length,
    platforms: data.platforms.length,
    categories: data.categories.length,
    presets: data.pickerPresets.length
  }
}

// ---- import ------------------------------------------------------------------

function snapshotDatabase(): void {
  const { dbFile, snapshotsDir } = getPaths()
  if (!fs.existsSync(dbFile)) return
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.copyFileSync(dbFile, path.join(snapshotsDir, `launcher-${stamp}.db`), fs.constants.COPYFILE_EXCL)
}

export async function importBackup(store: Store, token: unknown, mode: unknown): Promise<RestoreResult> {
  if (typeof token !== 'string' || !pending.has(token)) throw new Error('Please choose the backup file again.')
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Unknown restore mode.')
  const { data } = pending.get(token)!
  pending.delete(token)

  const imported = { applications: 0, platforms: 0, categories: 0, presets: 0 }
  let skipped = 0

  if (mode === 'replace') snapshotDatabase()

  store.transaction(() => {
    if ((mode as RestoreMode) === 'replace') store.clearAll()

    // Platforms / categories: match by name (case-insensitive), otherwise create.
    const labelMap = (table: 'platforms' | 'categories', items: unknown[]): Map<string, string> => {
      const map = new Map<string, string>()
      for (const item of items) {
        if (!isRecord(item)) {
          skipped++
          continue
        }
        const name = validateName(item.name)
        const oldId = optString(item.id)
        if (!name.ok || name.name.length > 60) {
          skipped++
          continue
        }
        let existing = store.findLabelByName(table, name.name)
        if (!existing) {
          existing = store.saveLabel(table, { name: name.name })
          if (table === 'platforms') imported.platforms++
          else imported.categories++
        }
        if (oldId) map.set(oldId, existing.id)
      }
      return map
    }
    const platformMap = labelMap('platforms', data.platforms)
    const categoryMap = labelMap('categories', data.categories)

    // Applications: validated exactly like the Add form; duplicates (by target) are skipped.
    const appMap = new Map<string, string>()
    for (const item of data.applications) {
      if (!isRecord(item) || !isLaunchType(item.launchType)) {
        skipped++
        continue
      }
      const name = validateName(item.name)
      const target = validateLaunchTarget(item.launchType, item.launchTarget)
      if (!name.ok || !target.ok) {
        skipped++
        continue
      }
      const oldId = optString(item.id)
      const existing = store.findByNormalizedTarget(target.normalized)
      if (existing) {
        if (oldId) appMap.set(oldId, existing.id)
        skipped++
        continue
      }
      const coverPath = optString(item.coverPath)
      const iconPath = optString(item.iconPath)
      const created = store.insertApplication({
        name: name.name,
        launchType: item.launchType,
        launchTarget: (item.launchTarget as string).trim(),
        normalized: target.normalized,
        coverPath: assetExists(coverPath) ? coverPath : null,
        iconPath: assetExists(iconPath) ? iconPath : null,
        platformId: optString(item.platformId) ? (platformMap.get(item.platformId as string) ?? null) : null,
        categoryId: optString(item.categoryId) ? (categoryMap.get(item.categoryId as string) ?? null) : null,
        favorite: Boolean(item.favorite),
        createdAt: isoOrNow(item.createdAt),
        updatedAt: isoOrNow(item.updatedAt),
        lastLaunchedAt: typeof item.lastLaunchedAt === 'string' ? isoOrNow(item.lastLaunchedAt) : null
      })
      if (oldId) appMap.set(oldId, created.id)
      imported.applications++
    }

    // Presets: by name; members are remapped to the ids they now have here.
    for (const item of data.pickerPresets) {
      if (!isRecord(item)) {
        skipped++
        continue
      }
      const name = validateName(item.name)
      if (!name.ok || name.name.length > 60 || store.findPresetByName(name.name)) {
        skipped++
        continue
      }
      const ids = Array.isArray(item.applicationIds) ? item.applicationIds : []
      const mapped = ids.map((id) => (typeof id === 'string' ? appMap.get(id) : undefined)).filter((id): id is string => !!id)
      store.savePreset({ name: name.name, applicationIds: mapped })
      imported.presets++
    }
  })

  const parts = [
    `${imported.applications} applications`,
    `${imported.platforms} platforms`,
    `${imported.categories} categories`,
    `${imported.presets} presets`
  ]
  const message = `Restored ${parts.join(', ')}.` + (skipped > 0 ? ` ${skipped} entries were skipped (already present or invalid).` : '')
  return { ok: true, message, imported, skipped }
}
