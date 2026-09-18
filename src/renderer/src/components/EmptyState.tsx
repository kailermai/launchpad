import { useLibrary } from '@/store/LibraryContext'

interface Props {
  title: string
  text?: string
  showAdd?: boolean
}

export function EmptyState({ title, text, showAdd = true }: Props): JSX.Element {
  const { openAdd } = useLibrary()
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {showAdd && (
        <div className="actions">
          <button className="btn primary" onClick={() => openAdd()}>
            + Add Application
          </button>
        </div>
      )}
    </div>
  )
}
