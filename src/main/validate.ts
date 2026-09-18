import path from 'node:path'
import type { ApplicationInput, LaunchType } from '../shared/types'

/** Safety Rule 3: the complete list of things the launcher is willing to open. */
export const ALLOWED_EXTENSIONS: Record<'executable' | 'shortcut', string> = {
  executable: '.exe',
  shortcut: '.lnk'
}
export const ALLOWED_URI_SCHEMES = ['steam', 'https'] as const

export const LAUNCH_TYPES: LaunchType[] = ['executable', 'shortcut', 'uri']

export type Validation = { ok: true; normalized: string } | { ok: false; message: string }

export function isLaunchType(value: unknown): value is LaunchType {
  return typeof value === 'string' && (LAUNCH_TYPES as string[]).includes(value)
}

/** Which launch type a user-picked file maps to, or null if we do not support it. */
export function launchTypeForFile(filePath: string): 'executable' | 'shortcut' | null {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ALLOWED_EXTENSIONS.executable) return 'executable'
  if (ext === ALLOWED_EXTENSIONS.shortcut) return 'shortcut'
  return null
}

function isSanePath(p: string): boolean {
  if (p.length === 0 || p.length > 4096) return false
  if (p.includes('\0')) return false
  if (!path.win32.isAbsolute(p)) return false
  // UNC or drive-letter absolute paths only; nothing relative sneaks through.
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\')
}

/**
 * Validates a launch target for the given type and returns a normalized form used
 * for duplicate detection. This runs on save, on import and again on launch.
 */
export function validateLaunchTarget(launchType: unknown, target: unknown): Validation {
  if (!isLaunchType(launchType)) return { ok: false, message: 'Unknown launch type.' }
  if (typeof target !== 'string') return { ok: false, message: 'Launch target must be text.' }
  const trimmed = target.trim()
  if (trimmed.length === 0) return { ok: false, message: 'Launch target is required.' }

  if (launchType === 'uri') {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return { ok: false, message: 'Not a valid link.' }
    }
    const scheme = url.protocol.replace(/:$/, '').toLowerCase()
    if (!(ALLOWED_URI_SCHEMES as readonly string[]).includes(scheme)) {
      return {
        ok: false,
        message: `Only ${ALLOWED_URI_SCHEMES.map((s) => s + '://').join(' and ')} links are supported.`
      }
    }
    if (trimmed.length > 2048) return { ok: false, message: 'Link is too long.' }
    return { ok: true, normalized: trimmed }
  }

  if (!isSanePath(trimmed)) return { ok: false, message: 'Launch target must be a full path (for example C:\\Games\\Game.exe).' }
  const expected = ALLOWED_EXTENSIONS[launchType]
  if (path.extname(trimmed).toLowerCase() !== expected) {
    return { ok: false, message: `A ${launchType} must end in ${expected}.` }
  }
  const normalized = path.win32.normalize(trimmed).replace(/[\\/]+$/, '').toLowerCase()
  return { ok: true, normalized }
}

export function validateName(name: unknown): { ok: true; name: string } | { ok: false; message: string } {
  if (typeof name !== 'string') return { ok: false, message: 'Name must be text.' }
  const trimmed = name.replace(/\s+/g, ' ').trim()
  if (trimmed.length === 0) return { ok: false, message: 'Name is required.' }
  if (trimmed.length > 200) return { ok: false, message: 'Name is too long (200 characters max).' }
  return { ok: true, name: trimmed }
}

export function validateLabel(name: unknown): string {
  const v = validateName(name)
  if (!v.ok) throw new Error(v.message)
  if (v.name.length > 60) throw new Error('Name is too long (60 characters max).')
  return v.name
}

function optionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 64) throw new Error('Invalid id.')
  return value
}

/** Picks only the fields we know from an object that came over IPC. */
export function sanitizeApplicationInput(raw: unknown): ApplicationInput {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid application data.')
  const r = raw as Record<string, unknown>
  if (!isLaunchType(r.launchType)) throw new Error('Unknown launch type.')
  if (typeof r.name !== 'string' || typeof r.launchTarget !== 'string') throw new Error('Invalid application data.')
  const coverPath = r.coverPath === undefined || r.coverPath === null ? null : String(r.coverPath)
  return {
    name: r.name,
    launchType: r.launchType,
    launchTarget: r.launchTarget,
    coverPath,
    platformId: optionalId(r.platformId),
    categoryId: optionalId(r.categoryId),
    favorite: Boolean(r.favorite)
  }
}

export function assertId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) throw new Error('Invalid id.')
  return value
}

export function assertIdList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid id list.')
  return value.map(assertId)
}
