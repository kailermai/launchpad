import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Application, Category, DroppedFileMeta, PickerPreset, Platform } from '@shared/types'
import { api } from '@/api'
import { usePrefs } from './PrefsContext'

export type ModalState =
  | { type: 'form'; app?: Application; prefill?: DroppedFileMeta }
  | { type: 'remove'; app: Application }
  | { type: 'bulkRemove'; apps: Application[] }
  | { type: 'missing'; app: Application; message: string }
  | { type: 'duplicate'; existing: { id: string; name: string } }
  | null

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error' | 'success'
  /** Auto-dismiss time, also drives the progress line. */
  ms: number
  action?: ToastAction
}

interface ToastOptions {
  ms?: number
  action?: ToastAction
}

interface LibraryValue {
  apps: Application[]
  platforms: Platform[]
  categories: Category[]
  presets: PickerPreset[]
  loaded: boolean
  /** Entries whose launch target could not be found (empty when the preference is off). */
  missingIds: Set<string>
  refresh: () => Promise<void>
  platformName: (id: string | null) => string | null
  categoryName: (id: string | null) => string | null
  launch: (app: Application) => Promise<void>
  toggleFavorite: (app: Application) => Promise<void>
  /** Removes entries and offers an Undo toast for a short while. */
  removeWithUndo: (apps: Application[]) => Promise<void>
  modal: ModalState
  setModal: (m: ModalState) => void
  openAdd: (prefill?: DroppedFileMeta) => void
  openEdit: (app: Application) => void
  openRemove: (app: Application) => void
  toasts: Toast[]
  toast: (message: string, kind?: Toast['kind'], options?: ToastOptions) => void
  dismissToast: (id: number) => void
  /** The entry whose detail page is open (drop / paste an image sets its cover). */
  detailApp: Application | null
  setDetailApp: (app: Application | null) => void
  /** A cover image that arrived by drop / paste while the Add/Edit form is open. */
  incomingCover: { nonce: number; fileName: string } | null
  offerCover: (fileName: string) => void
  clearIncomingCover: () => void
}

const LibraryContext = createContext<LibraryValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }): JSX.Element {
  const { prefs } = usePrefs()
  const [apps, setApps] = useState<Application[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [presets, setPresets] = useState<PickerPreset[]>([])
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [incomingCover, setIncomingCover] = useState<{ nonce: number; fileName: string } | null>(null)
  const toastId = useRef(0)

  const refresh = useCallback(async () => {
    const [a, p, c, s] = await Promise.all([
      api.listApplications(),
      api.listPlatforms(),
      api.listCategories(),
      api.listPresets()
    ])
    setApps(a)
    setPlatforms(p)
    setCategories(c)
    setPresets(s)
    setLoaded(true)
    // Read-only existence check of every file-based entry (a stat per entry).
    if (prefs.flagMissing) {
      const missing = await api.checkAllTargets()
      setMissingIds(new Set(missing.map((m) => m.id)))
    } else {
      setMissingIds(new Set())
    }
  }, [prefs.flagMissing])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message: string, kind: Toast['kind'] = 'info', options: ToastOptions = {}) => {
      const id = ++toastId.current
      const ms = options.ms ?? (kind === 'error' ? 6000 : 3200)
      const action = options.action
        ? {
            label: options.action.label,
            run: () => {
              dismissToast(id)
              options.action!.run()
            }
          }
        : undefined
      setToasts((t) => [...t.slice(-2), { id, message, kind, ms, action }]) // at most three on screen
      window.setTimeout(() => dismissToast(id), ms)
    },
    [dismissToast]
  )

  const platformName = useCallback(
    (id: string | null) => (id ? (platforms.find((p) => p.id === id)?.name ?? null) : null),
    [platforms]
  )
  const categoryName = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? null) : null),
    [categories]
  )

  const launch = useCallback(
    async (app: Application) => {
      const result = await api.launchApplication(app.id)
      if (result.ok) {
        toast(`Launching ${app.name}`, 'success')
        if (prefs.minimizeAfterLaunch) void api.minimizeWindow()
        await refresh()
      } else if (result.code === 'missing') {
        setModal({ type: 'missing', app, message: result.message })
      } else {
        toast(result.message, 'error')
      }
    },
    [refresh, toast, prefs.minimizeAfterLaunch]
  )

  const toggleFavorite = useCallback(
    async (app: Application) => {
      await api.setFavorite(app.id, !app.favorite)
      await refresh()
    },
    [refresh]
  )

  const removeWithUndo = useCallback(
    async (targets: Application[]) => {
      if (targets.length === 0) return
      const ids = targets.map((a) => a.id)
      const removed = await api.removeApplications(ids)
      await refresh()
      if (removed === 0) return
      const label = targets.length === 1 ? `${targets[0].name} removed from your library.` : `${removed} entries removed from your library.`
      toast(label, 'info', {
        ms: 9000,
        action: {
          label: 'Undo',
          run: () => {
            void (async () => {
              const back = await api.restoreApplications(ids)
              await refresh()
              toast(back.length === ids.length ? 'Restored.' : back.length ? `Restored ${back.length} of ${ids.length}.` : 'Too late to undo.', back.length ? 'success' : 'error')
            })()
          }
        }
      })
    },
    [refresh, toast]
  )

  const offerCover = useCallback((fileName: string) => setIncomingCover({ nonce: Date.now(), fileName }), [])
  const clearIncomingCover = useCallback(() => setIncomingCover(null), [])

  const value = useMemo<LibraryValue>(
    () => ({
      apps,
      platforms,
      categories,
      presets,
      loaded,
      missingIds,
      refresh,
      platformName,
      categoryName,
      launch,
      toggleFavorite,
      removeWithUndo,
      modal,
      setModal,
      openAdd: (prefill) => setModal({ type: 'form', prefill }),
      openEdit: (app) => setModal({ type: 'form', app }),
      openRemove: (app) => setModal({ type: 'remove', app }),
      toasts,
      toast,
      dismissToast,
      detailApp,
      setDetailApp,
      incomingCover,
      offerCover,
      clearIncomingCover
    }),
    [
      apps,
      platforms,
      categories,
      presets,
      loaded,
      missingIds,
      refresh,
      platformName,
      categoryName,
      launch,
      toggleFavorite,
      removeWithUndo,
      modal,
      toasts,
      toast,
      dismissToast,
      detailApp,
      incomingCover,
      offerCover,
      clearIncomingCover
    ]
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}
