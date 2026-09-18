import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Application, Category, DroppedFileMeta, PickerPreset, Platform } from '@shared/types'
import { api } from '@/api'

export type ModalState =
  | { type: 'form'; app?: Application; prefill?: DroppedFileMeta }
  | { type: 'remove'; app: Application }
  | { type: 'missing'; app: Application; message: string }
  | { type: 'duplicate'; existing: { id: string; name: string } }
  | null

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error' | 'success'
  /** Auto-dismiss time, also drives the progress line. */
  ms: number
}

interface LibraryValue {
  apps: Application[]
  platforms: Platform[]
  categories: Category[]
  presets: PickerPreset[]
  loaded: boolean
  refresh: () => Promise<void>
  platformName: (id: string | null) => string | null
  categoryName: (id: string | null) => string | null
  launch: (app: Application) => Promise<void>
  toggleFavorite: (app: Application) => Promise<void>
  modal: ModalState
  setModal: (m: ModalState) => void
  openAdd: (prefill?: DroppedFileMeta) => void
  openEdit: (app: Application) => void
  openRemove: (app: Application) => void
  toasts: Toast[]
  toast: (message: string, kind?: Toast['kind']) => void
}

const LibraryContext = createContext<LibraryValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [apps, setApps] = useState<Application[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [presets, setPresets] = useState<PickerPreset[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current
    const ms = kind === 'error' ? 6000 : 3200
    setToasts((t) => [...t.slice(-2), { id, message, kind, ms }]) // at most three on screen
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms)
  }, [])

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
        await refresh()
      } else if (result.code === 'missing') {
        setModal({ type: 'missing', app, message: result.message })
      } else {
        toast(result.message, 'error')
      }
    },
    [refresh, toast]
  )

  const toggleFavorite = useCallback(
    async (app: Application) => {
      await api.setFavorite(app.id, !app.favorite)
      await refresh()
    },
    [refresh]
  )

  const value = useMemo<LibraryValue>(
    () => ({
      apps,
      platforms,
      categories,
      presets,
      loaded,
      refresh,
      platformName,
      categoryName,
      launch,
      toggleFavorite,
      modal,
      setModal,
      openAdd: (prefill) => setModal({ type: 'form', prefill }),
      openEdit: (app) => setModal({ type: 'form', app }),
      openRemove: (app) => setModal({ type: 'remove', app }),
      toasts,
      toast
    }),
    [apps, platforms, categories, presets, loaded, refresh, platformName, categoryName, launch, toggleFavorite, modal, toasts, toast]
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}
