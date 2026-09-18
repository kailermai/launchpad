import { app, dialog, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DroppedFileMeta } from '../shared/types'
import { expandEnv, extractLargestIcon } from './icons'
import { getPaths, resolveInsideAssets } from './paths'
import { launchTypeForFile, validateLaunchTarget } from './validate'

/**
 * Everything here is read-only with respect to the user's files. The only
 * writes are copies of user-chosen images (and extracted icons) into the
 * launcher's own assets folder.
 */

const MAX_COVER_BYTES = 25 * 1024 * 1024

// ---- names -----------------------------------------------------------------

/** Conservative display name from a file stem: "MinecraftLauncher" -> "Minecraft Launcher". */
export function cleanDisplayName(stem: string): string {
  let s = stem.replace(/[_]+/g, ' ')
  s = s.replace(/[-]+/g, ' ')
  // Split camelCase boundaries only (lower/digit followed by upper).
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  // Drop trailing architecture markers.
  s = s.replace(/\s+(x64|x86|win64|win32|64bit|32bit)$/i, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length === 0) return stem
  // Title-case only when the whole thing was lowercase, otherwise keep the author's casing.
  if (s === s.toLowerCase()) {
    s = s.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return s
}

// ---- dropped / chosen application files -------------------------------------

/**
 * Reads metadata from ONE explicitly chosen file. Refuses anything that is not
 * a regular .exe or .lnk file. Never looks at the containing folder.
 */
export async function readDroppedFileMetadata(filePath: unknown): Promise<DroppedFileMeta | null> {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) return null
  if (!path.isAbsolute(filePath)) return null
  const launchType = launchTypeForFile(filePath)
  if (!launchType) return null

  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(filePath)
  } catch {
    return null
  }
  if (!stat.isFile()) return null

  const fileName = path.basename(filePath)
  const stem = fileName.slice(0, -path.extname(fileName).length)
  let shortcutTarget: string | null = null
  let launchTarget = filePath
  let iconPath: string | null = null

  if (launchType === 'shortcut') {
    try {
      // Read-only parse of the .lnk; Electron never writes to it.
      shortcutTarget = shell.readShortcutLink(filePath).target || null
    } catch {
      shortcutTarget = null
    }
  } else if (launchType === 'uri') {
    // .url is a tiny INI file: the URL inside becomes the entry, and only if its scheme is allowed.
    const link = await readInternetShortcut(filePath, stat.size)
    if (!link?.url || !validateLaunchTarget('uri', link.url).ok) return null
    launchTarget = link.url
    iconPath = await extractIcon(filePath)
  }

  return {
    path: filePath,
    fileName,
    launchType,
    launchTarget,
    suggestedName: cleanDisplayName(stem),
    shortcutTarget,
    iconPath
  }
}

const MAX_URL_FILE_BYTES = 64 * 1024

interface InternetShortcut {
  url: string | null
  iconFile: string | null
  iconIndex: number
}

/** Reads the [InternetShortcut] section of a .url file (URL=, IconFile=, IconIndex=). Read-only. */
async function readInternetShortcut(filePath: string, size: number): Promise<InternetShortcut | null> {
  if (size > MAX_URL_FILE_BYTES) return null
  const text = await fs.promises.readFile(filePath, 'utf8')
  const out: InternetShortcut = { url: null, iconFile: null, iconIndex: 0 }
  let inShortcutSection = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      inShortcutSection = line.toLowerCase() === '[internetshortcut]'
      continue
    }
    if (!inShortcutSection) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim().toLowerCase()
    const value = line.slice(eq + 1).trim()
    if (key === 'url' && !out.url) out.url = value || null
    else if (key === 'iconfile') out.iconFile = value || null
    else if (key === 'iconindex') out.iconIndex = Number.parseInt(value, 10) || 0
  }
  return out
}

export async function chooseApplicationFile(win: BrowserWindow): Promise<DroppedFileMeta | null> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose an application or shortcut',
    properties: ['openFile'],
    filters: [
      { name: 'Applications and shortcuts', extensions: ['exe', 'lnk', 'url'] },
      { name: 'Applications', extensions: ['exe'] },
      { name: 'Shortcuts', extensions: ['lnk'] },
      { name: 'Internet shortcuts (Steam)', extensions: ['url'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return readDroppedFileMetadata(result.filePaths[0])
}

// ---- cover images ------------------------------------------------------------

type ImageKind = 'png' | 'jpg' | 'webp'

async function sniffImage(filePath: string): Promise<ImageKind | null> {
  const handle = await fs.promises.open(filePath, 'r')
  try {
    const buf = Buffer.alloc(12)
    const { bytesRead } = await handle.read(buf, 0, 12, 0)
    if (bytesRead < 12) return null
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
    return null
  } finally {
    await handle.close()
  }
}

/** Copies a user-chosen image into the assets folder. The original is never touched. */
export async function importCoverFromPath(src: string): Promise<string | null> {
  const stat = await fs.promises.stat(src)
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_COVER_BYTES) return null
  const kind = await sniffImage(src)
  if (!kind) return null
  const fileName = `${randomUUID()}.${kind}`
  const dest = resolveInsideAssets(fileName)
  if (!dest) return null
  await fs.promises.copyFile(src, dest, fs.constants.COPYFILE_EXCL)
  return fileName
}

export async function chooseCoverImage(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose a cover image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return importCoverFromPath(result.filePaths[0])
}

// ---- icons -------------------------------------------------------------------

/**
 * Finds the best icon for a file the user added and stores it as a PNG asset.
 * Tries the file's own icon resources first (up to 256px); if that yields
 * nothing, falls back to the small icon Windows shows in Explorer.
 */
export async function extractIcon(target: string): Promise<string | null> {
  try {
    let png = (await largestIconFor(target))?.png ?? null
    if (!png) {
      const image = await app.getFileIcon(target, { size: 'large' })
      if (image.isEmpty()) return null
      png = image.toPNG()
    }
    const fileName = `${randomUUID()}.png`
    const dest = resolveInsideAssets(fileName)
    if (!dest) return null
    await fs.promises.writeFile(dest, png, { flag: 'wx' })
    return fileName
  } catch {
    return null
  }
}

/** Resolves where a file's icon actually lives (.lnk and .url point elsewhere) and extracts it. */
async function largestIconFor(target: string): Promise<{ png: Buffer; width: number } | null> {
  const ext = path.extname(target).toLowerCase()
  if (ext === '.exe' || ext === '.dll' || ext === '.ico') return extractLargestIcon(target)

  if (ext === '.lnk') {
    let link: { target: string; icon?: string; iconIndex?: number } | null = null
    try {
      link = shell.readShortcutLink(target)
    } catch {
      return null
    }
    const candidates: [string, number][] = []
    if (link.icon) candidates.push([expandEnv(link.icon), link.iconIndex ?? 0])
    if (link.target) candidates.push([expandEnv(link.target), 0])
    for (const [file, index] of candidates) {
      const found = await extractLargestIcon(file, index)
      if (found) return found
    }
    return null
  }

  if (ext === '.url') {
    const stat = await fs.promises.stat(target)
    const info = await readInternetShortcut(target, stat.size)
    if (!info?.iconFile) return null
    return extractLargestIcon(expandEnv(info.iconFile), info.iconIndex)
  }
  return null
}

// ---- cleanup -----------------------------------------------------------------

/**
 * The one delete the launcher performs: an asset file it created itself,
 * inside its own assets folder, that nothing references any more.
 */
export async function removeOwnedAsset(fileName: string | null, stillReferenced: (name: string) => boolean): Promise<void> {
  if (!fileName) return
  const resolved = resolveInsideAssets(fileName)
  if (!resolved) return
  if (stillReferenced(fileName)) return
  try {
    await fs.promises.unlink(resolved)
  } catch {
    // Already gone or locked; nothing to do.
  }
}

export function assetExists(fileName: string | null): boolean {
  const resolved = resolveInsideAssets(fileName)
  return resolved !== null && fs.existsSync(resolved)
}

export async function openDataFolder(): Promise<void> {
  await shell.openPath(getPaths().dataDir)
}
