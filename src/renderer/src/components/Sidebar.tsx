import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useLibrary } from '@/store/LibraryContext'
import { IconDice, IconGear, IconGrid, IconHome, IconPlus } from './Icons'

export function Sidebar(): JSX.Element {
  const { apps, platforms, openAdd } = useLibrary()
  const [params] = useSearchParams()
  const location = useLocation()
  const activePlatform = location.pathname === '/library' ? params.get('platform') : null

  const countFor = (platformId: string): number => apps.filter((a) => a.platformId === platformId).length

  return (
    <aside className="sidebar">
      <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <IconHome />
        Home
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => `nav-link ${isActive && !activePlatform ? 'active' : ''}`}>
        <IconGrid />
        Library <span className="count">{apps.length}</span>
      </NavLink>
      <NavLink to="/random" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <IconDice />
        Random Picker
      </NavLink>

      {platforms.length > 0 && (
        <>
          <div className="nav-section">Platforms</div>
          {platforms.map((p) => (
            <NavLink
              key={p.id}
              to={`/library?platform=${p.id}`}
              className={() => `nav-link platform ${activePlatform === p.id ? 'active' : ''}`}
            >
              <span className="dot" />
              {p.name}
              <span className="count">{countFor(p.id) || ''}</span>
            </NavLink>
          ))}
        </>
      )}

      <div className="sidebar-footer">
        <button className="btn primary block" onClick={() => openAdd()}>
          <IconPlus />
          Add Application
        </button>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <IconGear />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
