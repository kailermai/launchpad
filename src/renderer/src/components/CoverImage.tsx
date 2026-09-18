import { useState, type ReactNode } from 'react'
import type { Application } from '@shared/types'
import { assetUrl } from '@/api'
import { useAppearance } from '@/store/AppearanceContext'
import { gradientFor, initials } from '@/utils/format'
import { IconStarFilled } from './Icons'

interface Props {
  app: Application
  showFavorite?: boolean
  /** Extra controls rendered inside the cover (e.g. quick Play / favourite). */
  actions?: ReactNode
  className?: string
}

/** Cover art if chosen, otherwise a theme-tinted tile with the app's Windows icon. */
export function CoverImage({ app, showFavorite = true, actions, className }: Props): JSX.Element {
  const { tileHue } = useAppearance()
  const cover = assetUrl(app.coverPath)
  const icon = assetUrl(app.iconPath)
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`cover ${className ?? ''}`} style={cover ? undefined : { background: gradientFor(app.name, tileHue) }}>
      {cover ? (
        <img className={`art ${loaded ? 'loaded' : ''}`} src={cover} alt="" draggable={false} onLoad={() => setLoaded(true)} />
      ) : (
        <div className="fallback">
          {icon ? (
            <img className="icon-art" src={icon} alt="" draggable={false} />
          ) : (
            <div className="initials">{initials(app.name)}</div>
          )}
          <div className="label">{app.name}</div>
        </div>
      )}
      {showFavorite && app.favorite && (
        <span className="fav" title="Favourite">
          <IconStarFilled />
        </span>
      )}
      {actions && (
        <>
          <div className="scrim" />
          <div className="card-actions">{actions}</div>
        </>
      )}
    </div>
  )
}

/** Small square thumbnail used in list rows and the picker. */
export function Thumb({ app, size = 'md' }: { app: Application; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const { tileHue } = useAppearance()
  const cover = assetUrl(app.coverPath)
  const icon = assetUrl(app.iconPath)
  return (
    <div className={`thumb ${size}`} style={cover ? undefined : { background: gradientFor(app.name, tileHue) }}>
      {cover ? <img src={cover} alt="" /> : icon ? <img className="icon-art" src={icon} alt="" /> : <span>{initials(app.name)}</span>}
    </div>
  )
}
