import type { SaveResult } from '../shared/types'
import type { NewApplication, Store } from './db'
import { assetExists, extractIcon, removeOwnedAsset } from './files'
import { sanitizeApplicationInput, validateLaunchTarget, validateName } from './validate'

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

/** "Remove from Library": deletes the database row and the launcher's own copies of its images. Nothing else. */
export async function removeApplication(store: Store, id: string): Promise<void> {
  const removed = store.deleteApplication(id)
  if (!removed) return
  const referenced = referencedElsewhere(store, null)
  await removeOwnedAsset(removed.coverPath, referenced)
  await removeOwnedAsset(removed.iconPath, referenced)
}
