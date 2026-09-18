import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** Behaviour preferences (per PC, stored in localStorage inside the launcher's data folder). */
export interface Prefs {
  /** Minimise the launcher window right after a successful launch. */
  minimizeAfterLaunch: boolean
  /** Check every file-based entry on load and badge the ones whose file is gone. */
  flagMissing: boolean
}

const DEFAULTS: Prefs = { minimizeAfterLaunch: false, flagMissing: true }
const KEY = 'launcher.prefs'

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      minimizeAfterLaunch: typeof parsed.minimizeAfterLaunch === 'boolean' ? parsed.minimizeAfterLaunch : DEFAULTS.minimizeAfterLaunch,
      flagMissing: typeof parsed.flagMissing === 'boolean' ? parsed.flagMissing : DEFAULTS.flagMissing
    }
  } catch {
    return { ...DEFAULTS }
  }
}

interface PrefsValue {
  prefs: Prefs
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
}

const PrefsContext = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [prefs, setPrefs] = useState<Prefs>(load)
  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // session-only if storage is unavailable
      }
      return next
    })
  }, [])
  const value = useMemo(() => ({ prefs, setPref }), [prefs, setPref])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider')
  return ctx
}
