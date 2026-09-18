import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Application, SortMode } from '@shared/types'
import { AppGrid } from '@/components/AppCard'
import { EmptyState } from '@/components/EmptyState'
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
  const { apps, platforms, categories, loaded, platformName, categoryName } = useLibrary()
  const [params, setParams] = useSearchParams()

  const q = (params.get('q') ?? '').trim().toLowerCase()
  const platform = params.get('platform') ?? ''
  const category = params.get('category') ?? ''
  const favoritesOnly = params.get('favorites') === '1'
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
      if (q) {
        const hay = [a.name, platformName(a.platformId) ?? '', categoryName(a.categoryId) ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    return sortApps(list, sort)
  }, [apps, platform, category, favoritesOnly, q, sort, platformName, categoryName])

  if (!loaded) return <div />

  const title = platform ? (platformName(platform) ?? 'Library') : 'Library'
  const anyFilter = q || platform || category || favoritesOnly

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <div className="sub">Everything you have added, in one place.</div>
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
        <span className="result-count">
          {filtered.length} of {apps.length}
        </span>
      </div>

      {apps.length === 0 ? (
        <EmptyState title="Nothing here yet" text="Drop a .exe or .lnk into this window, or add one manually." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" text="Try a different search or clear the filters." showAdd={false} />
      ) : (
        <AppGrid apps={filtered} />
      )}
    </>
  )
}
