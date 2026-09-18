import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PickerPreset } from '@shared/types'
import { api } from '@/api'
import { ConfirmModal } from '@/components/Modal'
import { useLibrary } from '@/store/LibraryContext'

export function PresetsPage(): JSX.Element {
  const { presets, apps, refresh, toast } = useLibrary()
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<PickerPreset | null>(null)

  const nameOf = (id: string): string | null => apps.find((a) => a.id === id)?.name ?? null

  const rename = async (): Promise<void> => {
    if (!renaming) return
    const preset = presets.find((p) => p.id === renaming.id)
    if (!preset) return
    try {
      await api.savePreset({ id: preset.id, name: renaming.name, applicationIds: preset.applicationIds })
      await refresh()
      setRenaming(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Saved Presets</h1>
          <div className="sub">Candidate groups for the random picker. Deleting a preset never touches your library.</div>
        </div>
        <Link className="btn primary" to="/random">
          + New Preset
        </Link>
      </div>

      {presets.length === 0 ? (
        <div className="empty">
          <h3>No presets yet</h3>
          <p>Pick some candidates in the Random Picker and save them as a preset.</p>
          <div className="actions">
            <Link className="btn primary" to="/random">
              Open Random Picker
            </Link>
          </div>
        </div>
      ) : (
        <div className="list">
          {presets.map((preset) => {
            const members = preset.applicationIds.map(nameOf).filter((n): n is string => !!n)
            return (
              <div key={preset.id} className="list-row">
                <div className="grow">
                  {renaming?.id === preset.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void rename()
                      }}
                      style={{ display: 'flex', gap: 8 }}
                    >
                      <input
                        className="inline-edit"
                        value={renaming.name}
                        onChange={(e) => setRenaming({ id: preset.id, name: e.target.value })}
                        autoFocus
                        maxLength={60}
                        onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                      />
                      <button className="btn sm primary" type="submit">
                        Save
                      </button>
                      <button className="btn sm" type="button" onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="title">{preset.name}</div>
                      <div className="detail">
                        {members.length} {members.length === 1 ? 'game' : 'games'}
                        {members.length > 0 && ` · ${members.slice(0, 5).join(', ')}${members.length > 5 ? '…' : ''}`}
                      </div>
                    </>
                  )}
                </div>
                <div className="actions">
                  <button className="btn play sm" onClick={() => navigate(`/random?preset=${preset.id}`)}>
                    🎲 Pick
                  </button>
                  <button className="btn sm" onClick={() => navigate(`/random?preset=${preset.id}`)}>
                    Edit
                  </button>
                  <button className="btn sm" onClick={() => setRenaming({ id: preset.id, name: preset.name })}>
                    Rename
                  </button>
                  <button className="btn sm danger" onClick={() => setDeleting(preset)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete preset "${deleting.name}"?`}
          confirmLabel="Delete Preset"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void (async () => {
              await api.deletePreset(deleting.id)
              await refresh()
              setDeleting(null)
              toast('Preset deleted.')
            })()
          }}
        >
          <p>Only the preset is deleted. The games in it stay in your library.</p>
        </ConfirmModal>
      )}
    </>
  )
}
