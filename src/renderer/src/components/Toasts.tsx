import { useLibrary } from '@/store/LibraryContext'

export function Toasts(): JSX.Element {
  const { toasts } = useLibrary()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
