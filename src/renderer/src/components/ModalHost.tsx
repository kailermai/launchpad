import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useLibrary } from '@/store/LibraryContext'
import { AppFormModal } from './AppFormModal'
import { ConfirmModal, Modal } from './Modal'

/** Renders whichever modal the library context currently wants open. */
export function ModalHost(): JSX.Element | null {
  const { modal, setModal, refresh, toast, launch, removeWithUndo } = useLibrary()
  const navigate = useNavigate()
  const location = useLocation()
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
            close()
            if (location.pathname === `/library/${app.id}`) navigate('/library')
            await removeWithUndo([app])
          })()
        }}
      >
        <p>
          This only removes the launcher entry — you can undo it for a few seconds afterwards.{' '}
          <strong>The application and its files will not be modified.</strong>
        </p>
      </ConfirmModal>
    )
  }

  if (modal.type === 'bulkRemove') {
    const { apps } = modal
    return (
      <ConfirmModal
        title={`Remove ${apps.length} entries from your launcher?`}
        confirmLabel={`Remove ${apps.length} from Library`}
        danger
        onCancel={close}
        onConfirm={() => {
          void (async () => {
            close()
            await removeWithUndo(apps)
          })()
        }}
      >
        <p>
          {apps
            .slice(0, 6)
            .map((a) => a.name)
            .join(', ')}
          {apps.length > 6 ? ` and ${apps.length - 6} more` : ''}
        </p>
        <p>
          Only launcher entries are removed (undo is offered afterwards). <strong>No files on disk are touched.</strong>
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
