import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useLibrary } from '@/store/LibraryContext'
import { AppFormModal } from './AppFormModal'
import { ConfirmModal, Modal } from './Modal'

/** Renders whichever modal the library context currently wants open. */
export function ModalHost(): JSX.Element | null {
  const { modal, setModal, refresh, toast, launch } = useLibrary()
  const navigate = useNavigate()
  const close = (): void => setModal(null)

  if (!modal) return null

  if (modal.type === 'form') {
    return <AppFormModal app={modal.app} prefill={modal.prefill} onClose={close} />
  }

  if (modal.type === 'remove') {
    const { app } = modal
    return (
      <ConfirmModal
        title={`Remove ${app.name} from your launcher?`}
        confirmLabel="Remove from Library"
        danger
        onCancel={close}
        onConfirm={() => {
          void (async () => {
            await api.removeApplication(app.id)
            await refresh()
            close()
            toast(`${app.name} removed from your library.`)
            navigate('/library')
          })()
        }}
      >
        <p>
          This only removes the launcher entry. <strong>The application and its files will not be modified.</strong>
        </p>
      </ConfirmModal>
    )
  }

  if (modal.type === 'missing') {
    const { app, message } = modal
    return (
      <Modal title="Launch target could not be found" onClose={close}>
        <p>{message}</p>
        <div className="path">{app.launchTarget}</div>
        <p style={{ marginTop: 14 }}>
          The launcher never searches your PC for it. You can pick the new location yourself.
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              void (async () => {
                const meta = await api.chooseApplicationFile()
                if (!meta) return
                const result = await api.updateApplication(app.id, {
                  name: app.name,
                  launchType: meta.launchType,
                  launchTarget: meta.path,
                  coverPath: app.coverPath,
                  platformId: app.platformId,
                  categoryId: app.categoryId,
                  favorite: app.favorite
                })
                if (result.ok) {
                  await refresh()
                  close()
                  toast('Launch target updated.', 'success')
                  void launch(result.application)
                } else if (result.reason === 'duplicate') {
                  setModal({ type: 'duplicate', existing: result.existing })
                } else {
                  toast(result.message, 'error')
                }
              })()
            }}
          >
            Choose New Target…
          </button>
        </div>
      </Modal>
    )
  }

  if (modal.type === 'duplicate') {
    const { existing } = modal
    return (
      <Modal title="Already in your library" onClose={close}>
        <p>
          This launch target is already in your library as <strong style={{ color: 'var(--text)' }}>{existing.name}</strong>.
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              close()
              navigate(`/library/${existing.id}`)
            }}
          >
            Open Existing Entry
          </button>
        </div>
      </Modal>
    )
  }

  return null
}
