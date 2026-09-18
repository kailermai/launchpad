import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

export const SEARCH_INPUT_ID = 'global-search'

export function TopBar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const urlQuery = location.pathname === '/library' ? (params.get('q') ?? '') : ''
  const [value, setValue] = useState(urlQuery)

  useEffect(() => setValue(urlQuery), [urlQuery])

  const onChange = (q: string): void => {
    setValue(q)
    const next = new URLSearchParams(location.pathname === '/library' ? params : undefined)
    if (q) next.set('q', q)
    else next.delete('q')
    navigate({ pathname: '/library', search: next.toString() }, { replace: location.pathname === '/library' })
  }

  return (
    <header className="topbar">
      <div className="search">
        <span className="icon">⌕</span>
        <input
          id={SEARCH_INPUT_ID}
          type="search"
          placeholder="Search your library…"
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
      <div className="spacer" />
    </header>
  )
}
