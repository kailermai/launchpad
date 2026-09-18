import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/api'

/**
 * Theme / density / motion preferences. These are per-machine conveniences,
 * so they live in localStorage (which Electron keeps inside the launcher's
 * own data folder). Every storage access is guarded; defaults apply if it
 * is unavailable.
 */

export type ThemeId = 'violet' | 'plum' | 'synthwave'
export type Density = 'comfortable' | 'compact'
export type Motion = 'full' | 'reduced'

export interface ThemeInfo {
  id: ThemeId
  name: string
  description: string
  titlebar: string
  symbol: string
  tileHue: number
  /** Representative colours for the swatch dots: accent, play, star. */
  dots: [string, string, string]
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'violet',
    name: 'Violet Night',
    description: 'Deep indigo, violet accent, mint Play.',
    titlebar: '#120f1e',
    symbol: '#ece9f7',
    tileHue: 262,
    dots: ['#7c3aed', '#34d399', '#fbbf24']
  },
  {
    id: 'plum',
    name: 'Plum & Gold',
    description: 'Warm plum, bright purple, gold Play.',
    titlebar: '#180f1f',
    symbol: '#f3ecf7',
    tileHue: 285,
    dots: ['#9d4edd', '#f5c453', '#f5c453']
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Neon purple, cyan Play, pink favourites.',
    titlebar: '#120b22',
    symbol: '#f1ecff',
    tileHue: 275,
    dots: ['#a855f7', '#22d3ee', '#f472b6']
  }
]

const KEY = 'launcher.appearance'

interface Prefs {
  theme: ThemeId
  density: Density
  motion: Motion
}

const DEFAULTS: Prefs = { theme: 'violet', density: 'comfortable', motion: 'full' }

function isTheme(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEMES.some((t) => t.id === v)
}

function load(): Prefs {
  const prefs = { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>
      if (isTheme(parsed.theme)) prefs.theme = parsed.theme
      if (parsed.density === 'compact' || parsed.density === 'comfortable') prefs.density = parsed.density
      if (parsed.motion === 'reduced' || parsed.motion === 'full') prefs.motion = parsed.motion
    }
  } catch {
    // storage unavailable; keep defaults
  }
  // Dev screenshots can force a theme with #/route?theme=plum
  try {
    const query = window.location.hash.split('?')[1]
    const forced = query ? new URLSearchParams(query).get('theme') : null
    if (isTheme(forced)) prefs.theme = forced
  } catch {
    // ignore
  }
  return prefs
}

function save(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // storage unavailable; preference lasts for this session only
  }
}

interface AppearanceValue extends Prefs {
  themes: ThemeInfo[]
  tileHue: number
  setTheme: (t: ThemeId) => void
  setDensity: (d: Density) => void
  setMotion: (m: Motion) => void
}

const AppearanceContext = createContext<AppearanceValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [prefs, setPrefs] = useState<Prefs>(load)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = prefs.theme
    root.dataset.density = prefs.density
    root.dataset.motion = prefs.motion
    save(prefs)
    const info = THEMES.find((t) => t.id === prefs.theme) ?? THEMES[0]
    void api.setTitleBarColors(info.titlebar, info.symbol).catch(() => undefined)
  }, [prefs])

  const setTheme = useCallback((theme: ThemeId) => setPrefs((p) => ({ ...p, theme })), [])
  const setDensity = useCallback((density: Density) => setPrefs((p) => ({ ...p, density })), [])
  const setMotion = useCallback((motion: Motion) => setPrefs((p) => ({ ...p, motion })), [])

  const value = useMemo<AppearanceValue>(
    () => ({
      ...prefs,
      themes: THEMES,
      tileHue: (THEMES.find((t) => t.id === prefs.theme) ?? THEMES[0]).tileHue,
      setTheme,
      setDensity,
      setMotion
    }),
    [prefs, setTheme, setDensity, setMotion]
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance must be used inside AppearanceProvider')
  return ctx
}
