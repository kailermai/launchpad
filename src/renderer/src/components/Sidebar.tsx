import { NavLink, useSearchParams } from 'react-router-dom'
import { useLibrary } from '@/store/LibraryContext'

export function Sidebar(): JSX.Element {
  const { apps, platforms, openAdd } = useLibrary()
  const [params] = useSearchParams()
  const activePlatform = params.get('platform')

  const countFor = (platformId: string): number => apps.filter((a) => a.platformId === platformId).length

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot" />
        My Launcher
      </div>

      <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        Home
      </NavLink>
      <NavLink
        to="/library"
        className={({ isActive }) => `nav-link ${isActive && !activePlatform ? 'active' : ''}`}
      >
        Library <span className="count">{apps.length}</span>
      </NavLink>
      <NavLink to="/random" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        Random Picker
      </NavLink>

      {platforms.length > 0 && (
        <>
          <div className="nav-section">Platforms</div>
          {platforms.map((p) => (
            <NavLink
              key={p.id}
              to={`/library?platform=${p.id}`}
              className={() => `nav-link ${activePlatform === p.id ? 'active' : ''}`}
            >
              {p.name}
              <span className="count">{countFor(p.id) || ''}</span>
            </NavLink>
          ))}
        </>
      )}

      <div className="sidebar-footer">
        <button className="btn primary block" onClick={() => openAdd()}>
          + Add Application
        </button>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          ⚙ Settings
        </NavLink>
      </div>
    </aside>
  )
}
