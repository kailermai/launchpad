import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { IconGear, IconRocket, IconSearch } from './Icons'

export const SEARCH_INPUT_ID = 'global-search'

/**
 * The window's title bar. The whole strip is a drag region (Windows keeps its
 * native minimise / maximise / close buttons on the right); the search box and
 * the settings button opt out of dragging.
 */
export function TopBar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const urlQuery = location.pathname === '/library' ? (params.get('q') ?? '') : ''
  const [value, setValue] = useState(urlQuery)
  const inSettings = location.pathname.startsWith('/settings')

  useEffect(() => setValue(urlQuery), [urlQuery])

  const onChange = (q: string): void => {
    setValue(q)
    const next = new URLSearchParams(location.pathname === '/library' ? params : undefined)
    if (q) next.set('q', q)
    else next.delete('q')
    navigate({ pathname: '/library', search: next.toString() }, { replace: location.pathname === '/library' })
  }

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <span className="mark">
          <IconRocket size={13} />
        </span>
        Launchpad
      </div>

      <div className="titlebar-search">
        <span className="search-icon">
          <IconSearch />
        </span>
        <input
          id={SEARCH_INPUT_ID}
          type="search"
          placeholder="Search your library…"
          aria-label="Search your library"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onChange('')
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        {!value && (
          <span className="kbd-hint">
            <span className="kbd">Ctrl K</span>
          </span>
        )}
      </div>

      <div className="titlebar-actions">
        <button
          className={`btn icon-btn sm ${inSettings ? 'active' : ''}`}
          title="Settings"
          aria-label="Settings"
          onClick={() => navigate(inSettings ? '/' : '/settings')}
        >
          <IconGear size={17} />
        </button>
      </div>
    </header>
  )
}
