import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { TargetStatus } from '@shared/types'
import { api, assetUrl } from '@/api'
import { CoverImage } from '@/components/CoverImage'
import { IconArrowLeft, IconEdit, IconPlay, IconStar, IconStarFilled, IconTrash } from '@/components/Icons'
import { useAppearance } from '@/store/AppearanceContext'
import { useLibrary } from '@/store/LibraryContext'
import { gradientFor, LAUNCH_TYPE_LABEL, relativeTime } from '@/utils/format'

export function AppDetailPage(): JSX.Element {
  const { id } = useParams()
  const { apps, loaded, platformName, categoryName, launch, toggleFavorite, openEdit, openRemove, setModal } = useLibrary()
  const { tileHue } = useAppearance()
  const app = apps.find((a) => a.id === id)
  const [status, setStatus] = useState<TargetStatus | null>(null)

  useEffect(() => {
    if (!app) return
    let cancelled = false
    setStatus(null)
    void api.checkApplicationTarget(app.id).then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [app?.id, app?.launchTarget])

  // Ctrl+Enter plays from anywhere on the page.
  useEffect(() => {
    if (!app) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void launch(app)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [app, launch])

  if (!loaded) return <div />
  if (!app) {
    return (
      <div className="empty">
        <h3>This entry no longer exists.</h3>
        <Link className="btn" to="/library">
          Back to Library
        </Link>
      </div>
    )
  }

  const platform = platformName(app.platformId)
  const category = categoryName(app.categoryId)
  const image = assetUrl(app.coverPath) // icons are not blurred into the backdrop (they smear)

  return (
    <div className="detail-wrap">
      <div
        className="detail-backdrop"
        style={image ? { backgroundImage: `url("${image}")` } : { background: gradientFor(app.name, tileHue), filter: 'none', opacity: 0.4 }}
      />
      <Link to="/library" className="back-link">
        <IconArrowLeft /> Library
      </Link>
      <div className="detail">
        <CoverImage app={app} showFavorite={false} />
        <div>
          <h1>{app.name}</h1>
          <div className="badges">
            {platform && <span className="badge accent">{platform}</span>}
            {category && <span className="badge">{category}</span>}
            <span className="badge">{LAUNCH_TYPE_LABEL[app.launchType]}</span>
            {app.favorite && (
              <span className="badge" style={{ color: 'var(--star)' }}>
                <IconStarFilled /> Favourite
              </span>
            )}
          </div>

          {status && !status.exists && (
            <div className="callout warn" style={{ marginBottom: 20 }}>
              <strong>⚠ Launch target could not be found.</strong>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{status.message}</div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn sm"
                  onClick={() => setModal({ type: 'missing', app, message: status.message ?? 'Launch target could not be found.' })}
                >
                  Choose New Target…
                </button>
              </div>
            </div>
          )}

          <div className="actions">
            <button className="btn play lg" onClick={() => void launch(app)}>
              <IconPlay /> PLAY <span className="kbd">Ctrl ↵</span>
            </button>
            <button className="btn lg" onClick={() => void toggleFavorite(app)}>
              {app.favorite ? <IconStarFilled style={{ color: 'var(--star)' }} /> : <IconStar />}
              {app.favorite ? 'Favourited' : 'Favourite'}
            </button>
            <button className="btn lg" onClick={() => openEdit(app)}>
              <IconEdit /> Edit
            </button>
          </div>

          <dl className="facts">
            <dt>Last launched</dt>
            <dd>{relativeTime(app.lastLaunchedAt)}</dd>
            <dt>Launched</dt>
            <dd>{app.launchCount === 0 ? 'Never from here' : `${app.launchCount} ${app.launchCount === 1 ? 'time' : 'times'} from here`}</dd>
            <dt>Launch target</dt>
            <dd className="mono">{app.launchTarget}</dd>
            <dt>Added</dt>
            <dd>{new Date(app.createdAt).toLocaleDateString()}</dd>
          </dl>

          <div className="danger-zone">
            <button className="btn danger" onClick={() => openRemove(app)}>
              <IconTrash /> Remove from Library
            </button>
            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              Only the launcher entry is removed. The application's own files are never touched.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
