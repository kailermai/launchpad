import { useLibrary } from '@/store/LibraryContext'
import { IconPlus } from './Icons'

interface Props {
  title: string
  text?: string
  showAdd?: boolean
  /** Show the drop illustration and breathing border (first-run empty state). */
  art?: boolean
}

function DropArt(): JSX.Element {
  return (
    <svg className="empty-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="18" y="30" width="60" height="50" rx="10" strokeDasharray="5 5" opacity="0.6" />
      <rect x="34" y="14" width="28" height="40" rx="6" fill="var(--bg)" />
      <path d="M48 24v16M41 33l7 7 7-7" />
      <circle cx="26" cy="72" r="2" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="70" cy="72" r="2" fill="currentColor" stroke="none" opacity="0.7" />
    </svg>
  )
}

export function EmptyState({ title, text, showAdd = true, art = false }: Props): JSX.Element {
  const { openAdd } = useLibrary()
  return (
    <div className={`empty ${art ? 'breathe' : ''}`}>
      {art && <DropArt />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {showAdd && (
        <div className="actions">
          <button className="btn primary" onClick={() => openAdd()}>
            <IconPlus /> Add Application
          </button>
        </div>
      )}
    </div>
  )
}
