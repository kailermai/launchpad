import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { TargetStatus } from '@shared/types'
import { api } from '@/api'
import { CoverImage } from '@/components/CoverImage'
import { useLibrary } from '@/store/LibraryContext'
import { LAUNCH_TYPE_LABEL, relativeTime } from '@/utils/format'

export function AppDetailPage(): JSX.Element {
  const { id } = useParams()
  const { apps, loaded, platformName, categoryName, launch, toggleFavorite, openEdit, openRemove, setModal } = useLibrary()
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

  return (
    <div className="detail">
      <CoverImage app={app} showFavorite={false} />
      <div>
        <h1>{app.name}</h1>
        <div className="badges">
          {platform && <span className="badge accent">{platform}</span>}
          {category && <span className="badge">{category}</span>}
          <span className="badge">{LAUNCH_TYPE_LABEL[app.launchType]}</span>
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
            ▶ PLAY
          </button>
          <button className="btn lg" onClick={() => void toggleFavorite(app)}>
            {app.favorite ? '★ Favorited' : '☆ Favorite'}
          </button>
          <button className="btn lg" onClick={() => openEdit(app)}>
            Edit
          </button>
        </div>

        <dl className="facts">
          <dt>Last launched</dt>
          <dd>{relativeTime(app.lastLaunchedAt)}</dd>
          <dt>Launch target</dt>
          <dd className="mono">{app.launchTarget}</dd>
          <dt>Added</dt>
          <dd>{new Date(app.createdAt).toLocaleDateString()}</dd>
        </dl>

        <div className="danger-zone">
          <button className="btn danger" onClick={() => openRemove(app)}>
            Remove from Library
          </button>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Only the launcher entry is removed. The application's own files are never touched.
          </div>
        </div>
      </div>
    </div>
  )
}
