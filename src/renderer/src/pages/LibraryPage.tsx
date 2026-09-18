import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Application, BulkPatch, SortMode } from '@shared/types'
import { api } from '@/api'
import { AppGrid, type SelectMods } from '@/components/AppCard'
import { EmptyState } from '@/components/EmptyState'
import { IconStar, IconStarFilled, IconTrash, IconX } from '@/components/Icons'
import { useLibrary } from '@/store/LibraryContext'

const SORT_LABELS: Record<SortMode, string> = {
  name: 'Name',
  recent: 'Recently launched',
  most: 'Most launched',
  added: 'Recently added'
}

export function sortApps(apps: Application[], mode: SortMode): Application[] {
  const byName = (a: Application, b: Application): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  const sorted = [...apps]
  switch (mode) {
    case 'recent':
      return sorted.sort((a, b) => (b.lastLaunchedAt ?? '').localeCompare(a.lastLaunchedAt ?? '') || byName(a, b))
    case 'most':
      return sorted.sort((a, b) => b.launchCount - a.launchCount || byName(a, b))
    case 'added':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b))
    default:
      return sorted.sort(byName)
  }
}

export function LibraryPage(): JSX.Element {
  const { apps, platforms, categories, loaded, platformName, categoryName, missingIds, setModal, refresh, toast } = useLibrary()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const anchor = useRef<string | null>(null)

  const q = (params.get('q') ?? '').trim().toLowerCase()
  const platform = params.get('platform') ?? ''
  const category = params.get('category') ?? ''
  const favoritesOnly = params.get('favorites') === '1'
  const missingOnly = params.get('missing') === '1'
  const sortParam = params.get('sort')
  const sort: SortMode = sortParam && sortParam in SORT_LABELS ? (sortParam as SortMode) : 'name'

  const update = (key: string, value: string | null): void => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const list = apps.filter((a) => {
      if (platform && a.platformId !== platform) return false
      if (category && a.categoryId !== category) return false
      if (favoritesOnly && !a.favorite) return false
      if (missingOnly && !missingIds.has(a.id)) return false
      if (q) {
        const hay = [a.name, platformName(a.platformId) ?? '', categoryName(a.categoryId) ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    return sortApps(list, sort)
  }, [apps, platform, category, favoritesOnly, missingOnly, missingIds, q, sort, platformName, categoryName])

  // `?select=all` selects everything currently shown (deep link; also used for screenshots).
  useEffect(() => {
    if (!loaded || params.get('select') !== 'all') return
    setSelected(new Set(filtered.map((a) => a.id)))
    const next = new URLSearchParams(params)
    next.delete('select')
    setParams(next, { replace: true })
  }, [loaded, params, filtered, setParams])

  // Selection only ever refers to entries that still exist.
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(apps.map((a) => a.id))
      const next = new Set([...s].filter((id) => ids.has(id)))
      return next.size === s.size ? s : next
    })
  }, [apps])

  const onSelect = useCallback(
    (app: Application, mods: SelectMods) => {
      setSelected((s) => {
        const next = new Set(s)
        if (mods.range && anchor.current) {
          const ids = filtered.map((a) => a.id)
          const from = ids.indexOf(anchor.current)
          const to = ids.indexOf(app.id)
          if (from >= 0 && to >= 0) {
            for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(ids[i])
            return next
          }
        }
        if (next.has(app.id)) next.delete(app.id)
        else next.add(app.id)
        anchor.current = app.id
        return next
      })
    },
    [filtered]
  )

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    anchor.current = null
  }, [])

  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected.size, clearSelection])

  const selectedApps = useMemo(() => apps.filter((a) => selected.has(a.id)), [apps, selected])

  const bulk = async (patch: BulkPatch, label: string): Promise<void> => {
    const n = await api.bulkUpdateApplications([...selected], patch)
    await refresh()
    toast(`${label} for ${n} ${n === 1 ? 'entry' : 'entries'}.`, 'success')
  }

  if (!loaded) return <div />

  const title = platform ? (platformName(platform) ?? 'Library') : 'Library'
  const anyFilter = q || platform || category || favoritesOnly || missingOnly
  const missingCount = apps.filter((a) => missingIds.has(a.id)).length

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <div className="sub">Everything you have added, in one place. Ctrl-click or Shift-click cards to select several.</div>
        </div>
      </div>

      <div className="filters">
        <select className="input" value={platform} onChange={(e) => update('platform', e.target.value || null)} aria-label="Platform">
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="input" value={category} onChange={(e) => update('category', e.target.value || null)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className={`chip ${favoritesOnly ? 'active' : ''}`} onClick={() => update('favorites', favoritesOnly ? null : '1')}>
          ★ Favorites only
        </button>
        {missingCount > 0 && (
          <button className={`chip ${missingOnly ? 'active' : ''}`} onClick={() => update('missing', missingOnly ? null : '1')}>
            ⚠ Missing ({missingCount})
          </button>
        )}
        <select className="input" value={sort} onChange={(e) => update('sort', e.target.value === 'name' ? null : e.target.value)} aria-label="Sort">
          {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
            <option key={m} value={m}>
              Sort: {SORT_LABELS[m]}
            </option>
          ))}
        </select>
        {anyFilter && (
          <button className="btn ghost sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear
          </button>
        )}
        {filtered.length > 0 && (
          <button
            className="btn ghost sm"
            onClick={() => {
              setSelected(new Set(filtered.map((a) => a.id)))
              anchor.current = null
            }}
          >
            Select all
          </button>
        )}
        <span className="result-count">
          {filtered.length} of {apps.length}
        </span>
      </div>

      {apps.length === 0 ? (
        <EmptyState title="Nothing here yet" text="Drop a .exe, .lnk or Steam .url into this window, or add one manually." art />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" text="Try a different search or clear the filters." showAdd={false} />
      ) : (
        <AppGrid apps={filtered} label="Library" selectedIds={selected} onSelect={onSelect} />
      )}

      {selectedApps.length > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="Selected entries">
          <div className="bulk-bar-inner">
            <span className="count">{selectedApps.length} selected</span>
            <button className="btn sm" onClick={() => void bulk({ favorite: true }, 'Favourited')}>
              <IconStarFilled /> Favourite
            </button>
            <button className="btn sm" onClick={() => void bulk({ favorite: false }, 'Unfavourited')}>
              <IconStar /> Unfavourite
            </button>
            <select
              className="input"
              value=""
              aria-label="Set platform"
              onChange={(e) => {
                const v = e.target.value
                if (v === '') return
                void bulk({ platformId: v === '__none' ? null : v }, 'Platform set')
              }}
            >
              <option value="">Set platform…</option>
              <option value="__none">None</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value=""
              aria-label="Set category"
              onChange={(e) => {
                const v = e.target.value
                if (v === '') return
                void bulk({ categoryId: v === '__none' ? null : v }, 'Category set')
              }}
            >
              <option value="">Set category…</option>
              <option value="__none">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn sm danger" onClick={() => setModal({ type: 'bulkRemove', apps: selectedApps })}>
              <IconTrash /> Remove
            </button>
            <button className="btn ghost icon-btn sm" title="Clear selection (Esc)" aria-label="Clear selection" onClick={clearSelection}>
              <IconX size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
