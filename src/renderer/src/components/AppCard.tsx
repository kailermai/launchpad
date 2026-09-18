import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application } from '@shared/types'
import { useGridNavigation } from '@/hooks/useGridNavigation'
import { useLibrary } from '@/store/LibraryContext'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { CoverImage } from './CoverImage'
import { IconEdit, IconPlay, IconStar, IconStarFilled, IconTrash } from './Icons'

export function AppCard({ app }: { app: Application }): JSX.Element {
  const navigate = useNavigate()
  const { platformName, categoryName, launch, toggleFavorite, openEdit, openRemove } = useLibrary()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const platform = platformName(app.platformId)
  const category = categoryName(app.categoryId)

  const open = (): void => {
    void navigate(`/library/${app.id}`)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void launch(app)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      open()
    } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void toggleFavorite(app)
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      setMenu({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
  }

  const onContextMenu = (e: MouseEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const menuItems: MenuItem[] = [
    { label: 'Play', icon: <IconPlay />, onSelect: () => void launch(app), kbd: 'Ctrl ↵' },
    {
      label: app.favorite ? 'Remove from favourites' : 'Add to favourites',
      icon: app.favorite ? <IconStarFilled /> : <IconStar />,
      onSelect: () => void toggleFavorite(app),
      kbd: 'F'
    },
    { label: 'Edit…', icon: <IconEdit />, onSelect: () => openEdit(app), separatorBefore: true },
    { label: 'Remove from Library…', icon: <IconTrash />, onSelect: () => openRemove(app), danger: true }
  ]

  return (
    <div
      className={`card ${menu ? 'menu-open' : ''}`}
      role="link"
      tabIndex={-1}
      data-nav-item
      data-app-id={app.id}
      aria-label={app.name}
      onClick={open}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
    >
      <CoverImage
        app={app}
        actions={
          <>
            <button
              type="button"
              className={`qa star ${app.favorite ? 'active' : ''}`}
              title={app.favorite ? 'Remove from favourites' : 'Add to favourites'}
              aria-label={app.favorite ? 'Remove from favourites' : 'Add to favourites'}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                void toggleFavorite(app)
              }}
            >
              {app.favorite ? <IconStarFilled /> : <IconStar />}
            </button>
            <button
              type="button"
              className="qa play"
              title={`Play ${app.name}`}
              aria-label={`Play ${app.name}`}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                void launch(app)
              }}
            >
              <IconPlay />
            </button>
          </>
        }
      />
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
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
    </div>
  )
}

interface GridProps {
  apps: Application[]
  /** `row` renders a horizontally scrolling strip instead of a wrapping grid. */
  variant?: 'grid' | 'row'
  label?: string
}

export function AppGrid({ apps, variant = 'grid', label }: GridProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useGridNavigation(ref)
  return (
    <div ref={ref} className={variant === 'row' ? 'row-scroll' : 'grid'} role="list" aria-label={label}>
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  )
}
