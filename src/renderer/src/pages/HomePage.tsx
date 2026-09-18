import { Link, useNavigate } from 'react-router-dom'
import { AppGrid } from '@/components/AppCard'
import { Thumb } from '@/components/CoverImage'
import { EmptyState } from '@/components/EmptyState'
import { HeroCard } from '@/components/HeroCard'
import { IconDice, IconPlay, IconPlus } from '@/components/Icons'
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
  const mostPlayed = apps
    .filter((a) => a.launchCount > 0)
    .sort((a, b) => b.launchCount - a.launchCount || a.name.localeCompare(b.name))
    .slice(0, 8)
  const newest = [...apps].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const hero = recent[0] ?? favorites[0] ?? newest[0]
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
          title="Drop a game or app anywhere in this window"
          text=".exe, .lnk or a Steam desktop shortcut. The launcher only ever knows about what you explicitly add — it never scans your PC."
          art
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
        <div className="actions">
          <button className="btn" onClick={() => void navigate('/random')}>
            <IconDice /> Pick something for me
          </button>
          <button className="btn primary" onClick={() => openAdd()}>
            <IconPlus /> Add Application
          </button>
        </div>
      </div>

      {hero && <HeroCard app={hero} />}

      {favorites.length > 0 && (
        <section className="section">
          <div className="section-title">
            <h2>Favourites</h2>
            <Link to="/library?favorites=1">View all</Link>
          </div>
          <AppGrid apps={favorites} variant="row" label="Favourites" />
        </section>
      )}

      {recent.length > 1 && (
        <section className="section">
          <div className="section-title">
            <h2>Recently launched</h2>
            <Link to="/library?sort=recent">View all</Link>
          </div>
          <div className="list">
            {recent.slice(0, 5).map((app) => (
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
                    <IconPlay /> Play
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
          <AppGrid apps={mostPlayed} variant="row" label="Most played" />
        </section>
      )}

      <section className="section">
        <div className="section-title">
          <h2>Library</h2>
          <Link to="/library">View all {apps.length}</Link>
        </div>
        <AppGrid apps={preview} label="Library" />
      </section>
    </>
  )
}
