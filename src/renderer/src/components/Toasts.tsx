import type { CSSProperties } from 'react'
import { useLibrary } from '@/store/LibraryContext'
import { IconAlert, IconCheck, IconInfo } from './Icons'

export function Toasts(): JSX.Element {
  const { toasts } = useLibrary()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} style={{ '--toast-ms': `${t.ms}ms` } as CSSProperties}>
          <span className="toast-icon">{t.kind === 'success' ? <IconCheck /> : t.kind === 'error' ? <IconAlert /> : <IconInfo />}</span>
          <span className="toast-body">{t.message}</span>
          {t.action && (
            <button type="button" className="btn sm toast-action" onClick={t.action.run}>
              {t.action.label}
            </button>
          )}
          <span className="toast-bar" />
        </div>
      ))}
    </div>
  )
}
