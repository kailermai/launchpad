import fs from 'node:fs'
import path from 'node:path'
import type { Application, BulkPatch, SaveResult } from '../shared/types'
import type { NewApplication, Store } from './db'
import { assetExists, extractIcon, removeOwnedAsset } from './files'
import { ASSET_FILENAME_RE, getPaths, resolveInsideAssets } from './paths'
import { assertIdList, sanitizeApplicationInput, validateLaunchTarget, validateName } from './validate'

/** Add / edit / remove of library entries, including the launcher-owned asset bookkeeping. */

function referencedElsewhere(store: Store, exceptId: string | null) {
  return (fileName: string): boolean =>
    store.listApplications().some((a) => a.id !== exceptId && (a.coverPath === fileName || a.iconPath === fileName))
}

type Prepared = { ok: true; value: NewApplication } | { ok: false; result: SaveResult }

function prepare(store: Store, raw: unknown, currentId: string | null): Prepared {
  let input
  try {
    input = sanitizeApplicationInput(raw)
  } catch (e) {
    return { ok: false, result: { ok: false, reason: 'invalid', message: e instanceof Error ? e.message : 'Invalid data.' } }
  }
  const name = validateName(input.name)
  if (!name.ok) return { ok: false, result: { ok: false, reason: 'invalid', message: name.message } }
  const target = validateLaunchTarget(input.launchType, input.launchTarget)
  if (!target.ok) return { ok: false, result: { ok: false, reason: 'invalid', message: target.message } }

  const duplicate = store.findByNormalizedTarget(target.normalized)
  if (duplicate && duplicate.id !== currentId) {
    return { ok: false, result: { ok: false, reason: 'duplicate', existing: { id: duplicate.id, name: duplicate.name } } }
  }

  return {
    ok: true,
    value: {
      name: name.name,
      launchType: input.launchType,
      launchTarget: input.launchTarget.trim(),
      normalized: target.normalized,
      coverPath: assetExists(input.coverPath ?? null) ? input.coverPath! : null,
      iconPath: assetExists(input.iconPath ?? null) ? input.iconPath! : null,
      platformId: input.platformId ?? null,
      categoryId: input.categoryId ?? null,
      favorite: Boolean(input.favorite)
    }
  }
}

export async function addApplication(store: Store, raw: unknown): Promise<SaveResult> {
  const prepared = prepare(store, raw, null)
  if (!prepared.ok) return prepared.result
  // Links have no file to read an icon from; a dropped .url may already have supplied one.
  const iconPath =
    prepared.value.launchType === 'uri' ? prepared.value.iconPath : await extractIcon(prepared.value.launchTarget)
  const application = store.insertApplication({ ...prepared.value, iconPath })
  return { ok: true, application }
}

export async function updateApplication(store: Store, id: string, raw: unknown): Promise<SaveResult> {
  const existing = store.getApplication(id)
  if (!existing) return { ok: false, reason: 'invalid', message: 'This entry no longer exists.' }
  const prepared = prepare(store, raw, id)
  if (!prepared.ok) return prepared.result

  let iconPath = existing.iconPath
  const previous = validateLaunchTarget(existing.launchType, existing.launchTarget)
  const targetChanged = !previous.ok || previous.normalized !== prepared.value.normalized
  if (targetChanged) {
    iconPath =
      prepared.value.launchType === 'uri' ? prepared.value.iconPath : await extractIcon(prepared.value.launchTarget)
  }

  const application = store.updateApplication(id, { ...prepared.value, iconPath })

  // Tidy up assets this entry no longer uses (only inside our own folder).
  const referenced = referencedElsewhere(store, id)
  if (existing.coverPath && existing.coverPath !== application.coverPath) await removeOwnedAsset(existing.coverPath, referenced)
  if (existing.iconPath && existing.iconPath !== application.iconPath) await removeOwnedAsset(existing.iconPath, referenced)
  return { ok: true, application }
}

/** Re-extracts icons for every file-based entry (used after the icon extractor improves). Returns how many changed. */
export async function refreshIcons(store: Store): Promise<number> {
  let updated = 0
  for (const app of store.listApplications()) {
    if (app.launchType === 'uri') continue
    const iconPath = await extractIcon(app.launchTarget)
    if (!iconPath) continue
    const v = validateLaunchTarget(app.launchType, app.launchTarget)
    if (!v.ok) continue
    store.updateApplication(app.id, {
      name: app.name,
      launchType: app.launchType,
      launchTarget: app.launchTarget,
      normalized: v.normalized,
      coverPath: app.coverPath,
      iconPath,
      platformId: app.platformId,
      categoryId: app.categoryId,
      favorite: app.favorite
    })
    await removeOwnedAsset(app.iconPath, referencedElsewhere(store, app.id))
    updated++
  }
  return updated
}

/** Applies a label / favourite change to many entries at once. Returns how many were updated. */
export function bulkUpdateApplications(store: Store, rawIds: unknown, rawPatch: unknown): number {
  const ids = assertIdList(rawIds)
  if (!rawPatch || typeof rawPatch !== 'object') throw new Error('Invalid patch.')
  const r = rawPatch as Record<string, unknown>
  const patch: BulkPatch = {}
  if (r.favorite !== undefined) patch.favorite = Boolean(r.favorite)
  const optId = (v: unknown): string | null => (v === null || v === '' ? null : String(v).slice(0, 64))
  if (r.platformId !== undefined) patch.platformId = optId(r.platformId)
  if (r.categoryId !== undefined) patch.categoryId = optId(r.categoryId)
  if (Object.keys(patch).length === 0) return 0
  return store.bulkUpdate(ids, patch)
}

// ---- remove with undo ----------------------------------------------------------

/**
 * "Remove from Library" deletes the database row straight away, but the
 * launcher's own copies of the entry's images stay on disk for a short while
 * so the removal can be undone exactly. Nothing outside the launcher's folder
 * is ever involved.
 */
const UNDO_WINDOW_MS = 20_000

interface Trashed {
  app: Application
  presetIds: string[]
  timer: NodeJS.Timeout
}

const trash = new Map<string, Trashed>()

export async function removeApplications(store: Store, rawIds: unknown): Promise<number> {
  const ids = assertIdList(rawIds)
  let removed = 0
  for (const id of ids) {
    const presetIds = store.presetsContaining(id)
    const app = store.deleteApplication(id)
    if (!app) continue
    removed++
    const previous = trash.get(id)
    if (previous) clearTimeout(previous.timer)
    const timer = setTimeout(() => void discardTrashed(store, id), UNDO_WINDOW_MS)
    timer.unref()
    trash.set(id, { app, presetIds, timer })
  }
  return removed
}

async function discardTrashed(store: Store, id: string): Promise<void> {
  const item = trash.get(id)
  if (!item) return
  trash.delete(id)
  const referenced = referencedElsewhere(store, null)
  await removeOwnedAsset(item.app.coverPath, referenced)
  await removeOwnedAsset(item.app.iconPath, referenced)
}

/** Finalises every pending removal now (used at shutdown and by the self-test). */
export async function flushTrash(store: Store): Promise<void> {
  for (const id of [...trash.keys()]) {
    clearTimeout(trash.get(id)!.timer)
    await discardTrashed(store, id)
  }
}

/** Puts recently removed entries back exactly as they were, preset membership included. */
export function restoreApplications(store: Store, rawIds: unknown): Application[] {
  const ids = assertIdList(rawIds)
  const restored: Application[] = []
  for (const id of ids) {
    const item = trash.get(id)
    if (!item) continue
    clearTimeout(item.timer)
    trash.delete(id)
    const { app } = item
    const v = validateLaunchTarget(app.launchType, app.launchTarget)
    if (!v.ok || store.findByNormalizedTarget(v.normalized)) continue // slot taken meanwhile
    const back = store.insertApplication({
      id: app.id,
      name: app.name,
      launchType: app.launchType,
      launchTarget: app.launchTarget,
      normalized: v.normalized,
      coverPath: assetExists(app.coverPath) ? app.coverPath : null,
      iconPath: assetExists(app.iconPath) ? app.iconPath : null,
      platformId: app.platformId,
      categoryId: app.categoryId,
      favorite: app.favorite,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      lastLaunchedAt: app.lastLaunchedAt,
      launchCount: app.launchCount
    })
    for (const presetId of item.presetIds) store.addPresetItem(presetId, back.id)
    restored.push(back)
  }
  return restored
}

// ---- housekeeping -------------------------------------------------------------------

/**
 * Deletes launcher-generated image files in the assets folder that no entry
 * references any more (e.g. an icon extracted for a drop that was cancelled,
 * or a removal whose undo window was cut short by quitting). Only files we
 * named ourselves, only inside our own folder, and only if older than an hour
 * so an in-progress add is never touched. Returns how many were removed.
 */
export async function sweepOrphanAssets(store: Store, minAgeMs = 60 * 60 * 1000): Promise<number> {
  const { assetsDir } = getPaths()
  const referenced = new Set<string>()
  for (const a of store.listApplications()) {
    if (a.coverPath) referenced.add(a.coverPath)
    if (a.iconPath) referenced.add(a.iconPath)
  }
  for (const t of trash.values()) {
    if (t.app.coverPath) referenced.add(t.app.coverPath)
    if (t.app.iconPath) referenced.add(t.app.iconPath)
  }
  let removed = 0
  let names: string[]
  try {
    names = await fs.promises.readdir(assetsDir)
  } catch {
    return 0
  }
  const cutoff = Date.now() - minAgeMs
  for (const name of names) {
    if (!ASSET_FILENAME_RE.test(name) || referenced.has(name)) continue
    const file = resolveInsideAssets(name)
    if (!file || path.dirname(file) !== path.resolve(assetsDir)) continue
    try {
      const stat = await fs.promises.stat(file)
      if (stat.mtimeMs > cutoff) continue
      await fs.promises.unlink(file)
      removed++
    } catch {
      // skip anything odd
    }
  }
  return removed
}
