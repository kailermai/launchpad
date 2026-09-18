import { useEffect, type ReactNode } from 'react'
import { IconX } from './Icons'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export function Modal({ title, onClose, children, width }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost icon-btn sm" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <IconX size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

interface ConfirmProps {
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ title, children, confirmLabel, danger, onConfirm, onCancel }: ConfirmProps): JSX.Element {
  return (
    <Modal title={title} onClose={onCancel}>
      {children}
      <div className="modal-actions">
        <button className="btn" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
