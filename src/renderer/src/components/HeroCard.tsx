import { useNavigate } from 'react-router-dom'
import type { Application } from '@shared/types'
import { assetUrl } from '@/api'
import { useAppearance } from '@/store/AppearanceContext'
import { useLibrary } from '@/store/LibraryContext'
import { gradientFor, relativeTime } from '@/utils/format'
import { CoverImage } from './CoverImage'
import { IconChevronRight, IconPlay } from './Icons'

/** "Jump back in" banner on Home: the last thing you launched, ready to go. */
export function HeroCard({ app }: { app: Application }): JSX.Element {
  const navigate = useNavigate()
  const { launch, platformName } = useLibrary()
  const { tileHue } = useAppearance()
  // Only real cover art is blurred into the backdrop; icons would smear into a muddy wash.
  const image = assetUrl(app.coverPath)
  const platform = platformName(app.platformId)

  const eyebrow = app.lastLaunchedAt ? 'Jump back in' : app.favorite ? 'From your favourites' : 'New on your shelf'

  return (
    <section className="hero" aria-label={eyebrow}>
      <div
        className="hero-backdrop"
        style={image ? { backgroundImage: `url("${image}")` } : { background: gradientFor(app.name, tileHue), filter: 'none', opacity: 0.55 }}
      />
      <div className="hero-shade" />
      <div className="hero-poster">
        <CoverImage app={app} showFavorite={false} />
      </div>
      <div className="hero-body">
        <div className="hero-eyebrow">{eyebrow}</div>
        <h2 className="hero-title" title={app.name}>
          {app.name}
        </h2>
        <div className="hero-meta">
          {platform && <span className="badge accent">{platform}</span>}
          {app.lastLaunchedAt ? (
            <span>
              Played {relativeTime(app.lastLaunchedAt).toLowerCase()}
              {app.launchCount > 1 && ` · ${app.launchCount} times from here`}
            </span>
          ) : (
            <span>Never launched from here yet</span>
          )}
        </div>
        <div className="hero-actions">
          <button className="btn play lg" onClick={() => void launch(app)}>
            <IconPlay /> Play
          </button>
          <button className="btn lg" onClick={() => void navigate(`/library/${app.id}`)}>
            Details <IconChevronRight />
          </button>
        </div>
      </div>
    </section>
  )
}
