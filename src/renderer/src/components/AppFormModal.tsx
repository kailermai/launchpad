import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application, ApplicationInput, DroppedFileMeta, LaunchType } from '@shared/types'
import { api, assetUrl } from '@/api'
import { useLibrary } from '@/store/LibraryContext'
import { Modal } from './Modal'

interface Props {
  app?: Application
  prefill?: DroppedFileMeta
  onClose: () => void
}

/** Add / Edit Application. Same form for both; the main process validates everything again. */
export function AppFormModal({ app, prefill, onClose }: Props): JSX.Element {
  const { platforms, categories, refresh, toast, setModal } = useLibrary()
  const navigate = useNavigate()

  const [name, setName] = useState(app?.name ?? prefill?.suggestedName ?? '')
  const [launchType, setLaunchType] = useState<LaunchType>(app?.launchType ?? prefill?.launchType ?? 'executable')
  const [target, setTarget] = useState(app?.launchTarget ?? prefill?.launchTarget ?? '')
  const [iconPath, setIconPath] = useState<string | null>(prefill?.iconPath ?? null)
  const [platformId, setPlatformId] = useState(app?.platformId ?? '')
  const [categoryId, setCategoryId] = useState(app?.categoryId ?? '')
  const [coverPath, setCoverPath] = useState<string | null>(app?.coverPath ?? null)
  const [favorite, setFavorite] = useState(app?.favorite ?? false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isFile = launchType !== 'uri'

  const browse = async (): Promise<void> => {
    const meta = await api.chooseApplicationFile()
    if (!meta) return
    setTarget(meta.launchTarget)
    setLaunchType(meta.launchType)
    setIconPath(meta.iconPath)
    if (!name.trim()) setName(meta.suggestedName)
  }

  const chooseCover = async (): Promise<void> => {
    const file = await api.chooseCoverImage()
    if (file) setCoverPath(file)
    else toast('That file is not a PNG, JPG or WEBP image.', 'error')
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const input: ApplicationInput = {
      name,
      launchType,
      launchTarget: target,
      coverPath,
      iconPath,
      platformId: platformId || null,
      categoryId: categoryId || null,
      favorite
    }
    try {
      const result = app ? await api.updateApplication(app.id, input) : await api.addApplication(input)
      if (result.ok) {
        await refresh()
        toast(app ? 'Changes saved.' : `${result.application.name} added to your library.`, 'success')
        onClose()
        if (!app) navigate(`/library/${result.application.id}`)
      } else if (result.reason === 'duplicate') {
        setModal({ type: 'duplicate', existing: result.existing })
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={app ? 'Edit Application' : 'Add Application'} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="app-name">Name</label>
          <input id="app-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={200} />
        </div>

        <div className="field">
          <label>Launch type</label>
          <div className="segmented" role="radiogroup">
            {(['executable', 'shortcut', 'uri'] as LaunchType[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={launchType === t}
                className={launchType === t ? 'active' : ''}
                onClick={() => setLaunchType(t)}
              >
                {t === 'executable' ? 'Executable (.exe)' : t === 'shortcut' ? 'Shortcut (.lnk)' : 'Link'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="app-target">{isFile ? 'Launch target' : 'Link'}</label>
          <div className="input-row">
            <input
              id="app-target"
              className="input mono"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={isFile ? 'C:\\Games\\Game\\Game.exe' : 'steam://rungameid/1145360'}
              spellCheck={false}
            />
            <button type="button" className="btn" onClick={() => void browse()}>
              Browse…
            </button>
          </div>
          <div className="hint">
            {isFile
              ? 'Only .exe and .lnk files can be launched. The file itself is never modified.'
              : 'Only steam:// and https:// links are supported. You can also browse to a Steam desktop shortcut (.url).'}
          </div>
        </div>

        <div className="input-row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="app-platform">Platform</label>
            <select id="app-platform" className="input" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
              <option value="">None</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="app-category">Category</label>
            <select id="app-category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Cover</label>
          <div className="cover-picker">
            <div className="preview">{coverPath ? <img src={assetUrl(coverPath) ?? ''} alt="" /> : 'No cover'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={() => void chooseCover()}>
                Choose Image…
              </button>
              {coverPath && (
                <button type="button" className="btn ghost" onClick={() => setCoverPath(null)}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="hint">PNG, JPG or WEBP. A copy is kept in the launcher's own folder; the original is untouched.</div>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          Favorite
        </label>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {app ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
