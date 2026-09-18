import { useNavigate } from 'react-router-dom'
import type { Application } from '@shared/types'
import { useLibrary } from '@/store/LibraryContext'
import { CoverImage } from './CoverImage'

export function AppCard({ app }: { app: Application }): JSX.Element {
  const navigate = useNavigate()
  const { platformName, categoryName, launch } = useLibrary()
  const platform = platformName(app.platformId)
  const category = categoryName(app.categoryId)

  return (
    <div
      className="card"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/library/${app.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/library/${app.id}`)
      }}
    >
      <CoverImage app={app} onQuickPlay={() => void launch(app)} />
      <div className="meta">
        <div className="name" title={app.name}>
          {app.name}
        </div>
        {(platform || category) && (
          <div className="badges">
            {platform && <span className="badge accent">{platform}</span>}
            {category && <span className="badge">{category}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export function AppGrid({ apps, compact }: { apps: Application[]; compact?: boolean }): JSX.Element {
  return (
    <div className={`grid ${compact ? 'compact' : ''}`}>
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  )
}
