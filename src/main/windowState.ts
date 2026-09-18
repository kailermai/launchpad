import { screen, type BrowserWindow } from 'electron'
import fs from 'node:fs'

/**
 * Remembers the window's size, position and maximised state between runs.
 * Stored as a small JSON file inside the launcher's own data folder.
 */

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const MIN_WIDTH = 960
export const MIN_HEIGHT = 600
const DEFAULT: WindowState = { width: 1280, height: 820, maximized: false }

/** Validates a saved state against the current displays; anything off-screen or odd falls back to defaults. */
export function sanitizeWindowState(raw: unknown, displays: Rect[]): WindowState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT }
  const r = raw as Record<string, unknown>
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined)
  const width = Math.min(8192, Math.max(MIN_WIDTH, num(r.width) ?? DEFAULT.width))
  const height = Math.min(8192, Math.max(MIN_HEIGHT, num(r.height) ?? DEFAULT.height))
  const state: WindowState = { width, height, maximized: r.maximized === true }
  const x = num(r.x)
  const y = num(r.y)
  if (x !== undefined && y !== undefined) {
    // Keep the position only if a decent part of the window would be visible on some display.
    const visible = displays.some((d) => {
      const ox = Math.min(x + width, d.x + d.width) - Math.max(x, d.x)
      const oy = Math.min(y + height, d.y + d.height) - Math.max(y, d.y)
      return ox >= 200 && oy >= 120
    })
    if (visible) {
      state.x = x
      state.y = y
    }
  }
  return state
}

export function loadWindowState(file: string): WindowState {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
    return sanitizeWindowState(raw, screen.getAllDisplays().map((d) => d.workArea))
  } catch {
    return { ...DEFAULT }
  }
}

export function trackWindowState(win: BrowserWindow, file: string): void {
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (win.isDestroyed()) return
    const bounds = win.getNormalBounds()
    const state: WindowState = { ...bounds, maximized: win.isMaximized() }
    try {
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(state))
      fs.renameSync(tmp, file)
    } catch {
      // not fatal
    }
  }
  const debounced = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 400)
  }
  win.on('resize', debounced)
  win.on('move', debounced)
  win.on('maximize', debounced)
  win.on('unmaximize', debounced)
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    save()
  })
}
