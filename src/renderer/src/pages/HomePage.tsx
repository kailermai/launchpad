import { Link, useNavigate } from 'react-router-dom'
import { AppCard, AppGrid } from '@/components/AppCard'
import { Thumb } from '@/components/CoverImage'
import { EmptyState } from '@/components/EmptyState'
import { useLibrary } from '@/store/LibraryContext'
import { relativeTime } from '@/utils/format'

export function HomePage(): JSX.Element {
  const { apps, loaded, launch, openAdd } = useLibrary()
  const navigate = useNavigate()

  if (!loaded) return <div />

  const favorites = apps.filter((a) => a.favorite)
  const recent = apps
    .filter((a) => a.lastLaunchedAt)
    .sort((a, b) => (b.lastLaunchedAt ?? '').localeCompare(a.lastLaunchedAt ?? ''))
    .slice(0, 6)
  const mostPlayed = apps
    .filter((a) => a.launchCount > 0)
    .sort((a, b) => b.launchCount - a.launchCount || a.name.localeCompare(b.name))
    .slice(0, 6)
  const preview = apps.slice(0, 12)

  if (apps.length === 0) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Welcome</h1>
            <div className="sub">Your shelf is empty. Add the first thing you want to launch.</div>
          </div>
        </div>
        <EmptyState
          title="Drop a .exe or .lnk anywhere in this window"
          text="Or add one manually. The launcher only ever knows about what you explicitly add — it never scans your PC."
        />
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Home</h1>
          <div className="sub">
            {apps.length} {apps.length === 1 ? 'entry' : 'entries'} on your shelf
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => navigate('/random')}>
            🎲 Pick something for me
          </button>
          <button className="btn primary" onClick={() => openAdd()}>
            + Add Application
          </button>
        </div>
      </div>

      {favorites.length > 0 && (
        <section className="section">
          <div className="section-title">
            <h2>Favorites</h2>
            <Link to="/library?favorites=1">View all</Link>
          </div>
          <div className="row-scroll">
            {favorites.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-title">
            <h2>Recently launched</h2>
          </div>
          <div className="list">
            {recent.map((app) => (
              <div key={app.id} className="list-row">
                <Thumb app={app} />
                <div className="grow">
                  <Link to={`/library/${app.id}`} className="title">
                    {app.name}
                  </Link>
                  <div className="detail">{relativeTime(app.lastLaunchedAt)}</div>
                </div>
                <div className="actions">
                  <button className="btn play sm" onClick={() => void launch(app)}>
                    ▶ Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {mostPlayed.length > 1 && (
        <section className="section">
          <div className="section-title">
            <h2>Most played</h2>
            <Link to="/library?sort=most">View all</Link>
          </div>
          <div className="row-scroll">
            {mostPlayed.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-title">
          <h2>Library</h2>
          <Link to="/library">View all {apps.length}</Link>
        </div>
        <AppGrid apps={preview} />
      </section>
    </>
  )
}
