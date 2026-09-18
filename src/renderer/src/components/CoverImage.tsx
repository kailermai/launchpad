import type { Application } from '@shared/types'
import { assetUrl } from '@/api'
import { gradientFor, initials } from '@/utils/format'

interface Props {
  app: Application
  showFavorite?: boolean
  onQuickPlay?: () => void
  className?: string
}

/** Cover art if chosen, otherwise a coloured tile with the app's Windows icon. */
export function CoverImage({ app, showFavorite = true, onQuickPlay, className }: Props): JSX.Element {
  const cover = assetUrl(app.coverPath)
  const icon = assetUrl(app.iconPath)
  return (
    <div className={`cover ${className ?? ''}`} style={cover ? undefined : { background: gradientFor(app.name) }}>
      {cover ? (
        <img className="art" src={cover} alt="" draggable={false} />
      ) : (
        <div className="fallback">
          {icon ? <img className="icon" src={icon} alt="" draggable={false} /> : <div className="initials">{initials(app.name)}</div>}
          <div className="label">{app.name}</div>
        </div>
      )}
      {showFavorite && app.favorite && <span className="fav">★</span>}
      {onQuickPlay && (
        <button
          className="quick-play"
          title={`Play ${app.name}`}
          aria-label={`Play ${app.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onQuickPlay()
          }}
        >
          ▶
        </button>
      )}
    </div>
  )
}

/** Small square thumbnail used in list rows. */
export function Thumb({ app }: { app: Application }): JSX.Element {
  const cover = assetUrl(app.coverPath)
  const icon = assetUrl(app.iconPath)
  return (
    <div className="thumb" style={cover ? undefined : { background: gradientFor(app.name) }}>
      {cover ? <img src={cover} alt="" /> : icon ? <img className="icon" src={icon} alt="" /> : <span>{initials(app.name)}</span>}
    </div>
  )
}
