import { nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Read-only icon extraction. Opens the file the user pointed at, walks the
 * PE resource table (for .exe/.dll) or the ICONDIR (for .ico), picks the
 * largest icon image and returns it as a PNG buffer. Never writes to the
 * source file; never follows anything the user did not add.
 */

const MAX_FILE_BYTES = 512 * 1024 * 1024 // never read anything larger than this into memory
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const RT_ICON = 3
const RT_GROUP_ICON = 14

interface IconEntry {
  width: number
  height: number
  bitCount: number
  /** For .ico files: absolute offset + size. For PE: resource id. */
  offset?: number
  size?: number
  resourceId?: number
}

interface IconImage {
  width: number
  height: number
  png: Buffer
}

// ---- public -----------------------------------------------------------------

/** Best icon in an .exe/.dll (optionally choosing a group by index) or .ico. Null if none usable. */
export async function extractLargestIcon(file: string, iconIndex = 0): Promise<IconImage | null> {
  let data: Buffer
  try {
    const stat = await fs.promises.stat(file)
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null
    data = await fs.promises.readFile(file)
  } catch {
    return null
  }
  try {
    const ext = path.extname(file).toLowerCase()
    if (ext === '.ico') return decodeIcoFile(data)
    if (data.length > 2 && data[0] === 0x4d && data[1] === 0x5a) return decodePeIcon(data, iconIndex)
    return null
  } catch {
    return null
  }
}

/** Expands %SystemRoot%-style variables in icon paths from shortcuts. */
export function expandEnv(p: string): string {
  return p.replace(/%([^%]+)%/g, (m, name: string) => process.env[name] ?? process.env[name.toUpperCase()] ?? m)
}

// ---- .ico files ---------------------------------------------------------------

function decodeIcoFile(data: Buffer): IconImage | null {
  if (data.length < 6 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) return null
  const count = data.readUInt16LE(4)
  const entries: IconEntry[] = []
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16
    if (o + 16 > data.length) break
    entries.push({
      width: data[o] || 256,
      height: data[o + 1] || 256,
      bitCount: data.readUInt16LE(o + 6),
      size: data.readUInt32LE(o + 8),
      offset: data.readUInt32LE(o + 12)
    })
  }
  const best = pickBest(entries)
  if (!best || best.offset === undefined || best.size === undefined) return null
  if (best.offset + best.size > data.length) return null
  return decodeIconImage(data.subarray(best.offset, best.offset + best.size))
}

// ---- PE resources ----------------------------------------------------------------

interface Section {
  virtualAddress: number
  virtualSize: number
  rawPointer: number
  rawSize: number
}

interface ResourceReader {
  data: Buffer
  base: number // file offset of the resource directory
  baseRva: number
  sections: Section[]
}

function rvaToOffset(sections: Section[], rva: number): number | null {
  for (const s of sections) {
    if (rva >= s.virtualAddress && rva < s.virtualAddress + Math.max(s.virtualSize, s.rawSize)) {
      return s.rawPointer + (rva - s.virtualAddress)
    }
  }
  return null
}

function decodePeIcon(data: Buffer, iconIndex: number): IconImage | null {
  const peOffset = data.readUInt32LE(0x3c)
  if (peOffset + 24 > data.length || data.readUInt32LE(peOffset) !== 0x00004550) return null
  const numberOfSections = data.readUInt16LE(peOffset + 6)
  const optionalSize = data.readUInt16LE(peOffset + 20)
  const optional = peOffset + 24
  const magic = data.readUInt16LE(optional)
  const dirOffset = magic === 0x20b ? optional + 112 : magic === 0x10b ? optional + 96 : null
  if (dirOffset === null) return null
  const resourceRva = data.readUInt32LE(dirOffset + 2 * 8)
  if (resourceRva === 0) return null

  const sections: Section[] = []
  let sectionOffset = optional + optionalSize
  for (let i = 0; i < numberOfSections; i++, sectionOffset += 40) {
    if (sectionOffset + 40 > data.length) break
    sections.push({
      virtualSize: data.readUInt32LE(sectionOffset + 8),
      virtualAddress: data.readUInt32LE(sectionOffset + 12),
      rawSize: data.readUInt32LE(sectionOffset + 16),
      rawPointer: data.readUInt32LE(sectionOffset + 20)
    })
  }
  const base = rvaToOffset(sections, resourceRva)
  if (base === null) return null
  const reader: ResourceReader = { data, base, baseRva: resourceRva, sections }

  const groups = listResources(reader, RT_GROUP_ICON)
  if (groups.length === 0) return null
  const group =
    iconIndex < 0 ? groups.find((g) => g.id === -iconIndex) : groups[Math.min(Math.max(iconIndex, 0), groups.length - 1)]
  if (!group) return null

  const groupData = readResource(reader, group.dirOffset)
  if (!groupData || groupData.length < 6) return null
  const count = groupData.readUInt16LE(4)
  const entries: IconEntry[] = []
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 14
    if (o + 14 > groupData.length) break
    entries.push({
      width: groupData[o] || 256,
      height: groupData[o + 1] || 256,
      bitCount: groupData.readUInt16LE(o + 6),
      resourceId: groupData.readUInt16LE(o + 12)
    })
  }
  const best = pickBest(entries)
  if (!best || best.resourceId === undefined) return null
  const icon = listResources(reader, RT_ICON).find((r) => r.id === best.resourceId)
  if (!icon) return null
  const iconData = readResource(reader, icon.dirOffset)
  return iconData ? decodeIconImage(iconData) : null
}

interface ResourceRef {
  id: number
  /** Offset (relative to resource base) of the language-level directory for this resource. */
  dirOffset: number
}

function listResources(r: ResourceReader, type: number): ResourceRef[] {
  const typeEntry = directoryEntries(r, 0).find((e) => e.id === type && e.isDir)
  if (!typeEntry) return []
  return directoryEntries(r, typeEntry.offset)
    .filter((e) => e.isDir)
    .map((e) => ({ id: e.id, dirOffset: e.offset }))
}

function directoryEntries(r: ResourceReader, rel: number): { id: number; offset: number; isDir: boolean }[] {
  const o = r.base + rel
  if (o + 16 > r.data.length) return []
  const named = r.data.readUInt16LE(o + 12)
  const ids = r.data.readUInt16LE(o + 14)
  const total = Math.min(named + ids, 4096)
  const out: { id: number; offset: number; isDir: boolean }[] = []
  for (let i = 0; i < total; i++) {
    const e = o + 16 + i * 8
    if (e + 8 > r.data.length) break
    const id = r.data.readUInt32LE(e)
    const raw = r.data.readUInt32LE(e + 4)
    out.push({ id: id & 0x7fffffff, offset: raw & 0x7fffffff, isDir: (raw & 0x80000000) !== 0 })
  }
  return out
}

/** Follows the language directory to the first data entry and returns its bytes. */
function readResource(r: ResourceReader, langDirRel: number): Buffer | null {
  const first = directoryEntries(r, langDirRel).find((e) => !e.isDir)
  if (!first) return null
  const dataEntry = r.base + first.offset
  if (dataEntry + 16 > r.data.length) return null
  const rva = r.data.readUInt32LE(dataEntry)
  const size = r.data.readUInt32LE(dataEntry + 4)
  const off = rvaToOffset(r.sections, rva)
  if (off === null || off + size > r.data.length || size > 16 * 1024 * 1024) return null
  return r.data.subarray(off, off + size)
}

// ---- image decoding ---------------------------------------------------------------

function pickBest(entries: IconEntry[]): IconEntry | null {
  let best: IconEntry | null = null
  for (const e of entries) {
    if (!best || e.width > best.width || (e.width === best.width && e.bitCount > best.bitCount)) best = e
  }
  return best
}

/** An icon image is either an embedded PNG (typically the 256px one) or a DIB with XOR + AND masks. */
function decodeIconImage(img: Buffer): IconImage | null {
  if (img.length >= 8 && img.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const width = img.readUInt32BE(16)
    const height = img.readUInt32BE(20)
    return { width, height, png: Buffer.from(img) }
  }
  if (img.length < 40) return null
  const headerSize = img.readUInt32LE(0)
  const width = img.readInt32LE(4)
  const fullHeight = img.readInt32LE(8)
  const bitCount = img.readUInt16LE(14)
  const compression = img.readUInt32LE(16)
  const clrUsed = img.readUInt32LE(32)
  const height = Math.abs(fullHeight) / 2
  if (width <= 0 || width > 1024 || height <= 0 || height > 1024 || !Number.isInteger(height)) return null
  if (compression !== 0 && compression !== 3) return null

  let pos = headerSize
  const paletteCount = bitCount <= 8 ? clrUsed || 1 << bitCount : 0
  const palette: number[][] = []
  for (let i = 0; i < paletteCount; i++, pos += 4) {
    if (pos + 4 > img.length) return null
    palette.push([img[pos], img[pos + 1], img[pos + 2]]) // B, G, R
  }

  const xorStride = Math.ceil((width * bitCount) / 32) * 4
  const andStride = Math.ceil(width / 32) * 4
  const xorStart = pos
  const andStart = xorStart + xorStride * height
  if (xorStart + xorStride * height > img.length) return null
  const hasAnd = andStart + andStride * height <= img.length

  const out = Buffer.alloc(width * height * 4)
  let anyAlpha = false
  for (let y = 0; y < height; y++) {
    const srcRow = xorStart + (height - 1 - y) * xorStride // bottom-up
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4
      let b = 0
      let g = 0
      let r = 0
      let a = 255
      if (bitCount === 32) {
        const s = srcRow + x * 4
        b = img[s]
        g = img[s + 1]
        r = img[s + 2]
        a = img[s + 3]
        if (a !== 0) anyAlpha = true
      } else if (bitCount === 24) {
        const s = srcRow + x * 3
        b = img[s]
        g = img[s + 1]
        r = img[s + 2]
      } else if (bitCount === 8 || bitCount === 4 || bitCount === 1) {
        const bitPos = x * bitCount
        const byte = img[srcRow + (bitPos >> 3)]
        const shift = 8 - bitCount - (bitPos & 7)
        const index = (byte >> shift) & ((1 << bitCount) - 1)
        const c = palette[index] ?? [0, 0, 0]
        b = c[0]
        g = c[1]
        r = c[2]
      } else {
        return null
      }
      out[dst] = b
      out[dst + 1] = g
      out[dst + 2] = r
      out[dst + 3] = a
    }
  }

  // The AND mask carries transparency for non-32bpp icons (and for 32bpp icons with an all-zero alpha channel).
  if (hasAnd && (bitCount !== 32 || !anyAlpha)) {
    for (let y = 0; y < height; y++) {
      const srcRow = andStart + (height - 1 - y) * andStride
      for (let x = 0; x < width; x++) {
        const masked = (img[srcRow + (x >> 3)] >> (7 - (x & 7))) & 1
        out[(y * width + x) * 4 + 3] = masked ? 0 : 255
      }
    }
  }

  const image = nativeImage.createFromBitmap(out, { width, height })
  if (image.isEmpty()) return null
  return { width, height, png: image.toPNG() }
}
