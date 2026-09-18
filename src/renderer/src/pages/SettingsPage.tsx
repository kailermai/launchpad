import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import type { AppInfo, BackupSummary, MissingTarget, Platform, RestoreMode } from '@shared/types'
import { api } from '@/api'
import { ConfirmModal } from '@/components/Modal'
import { useLibrary } from '@/store/LibraryContext'
import { useAppearance, type ThemeInfo } from '@/store/AppearanceContext'
import { useNavigate } from 'react-router-dom'

export function SettingsPage(): JSX.Element {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings">
        <nav className="settings-nav">
          <NavLink to="/settings" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            General
          </NavLink>
          <NavLink to="/settings/appearance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Appearance
          </NavLink>
          <NavLink to="/settings/platforms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Platforms
          </NavLink>
          <NavLink to="/settings/categories" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Categories
          </NavLink>
          <NavLink to="/settings/backup" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Backup &amp; Restore
          </NavLink>
          <NavLink to="/settings/health" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Library Health
          </NavLink>
        </nav>
        <div className="settings-panel">
          <Routes>
            <Route index element={<GeneralSettings />} />
            <Route path="appearance" element={<AppearanceSettings />} />
            <Route path="platforms" element={<LabelManager kind="platforms" />} />
            <Route path="categories" element={<LabelManager kind="categories" />} />
            <Route path="backup" element={<BackupSettings />} />
            <Route path="health" element={<HealthSettings />} />
          </Routes>
        </div>
      </div>
    </>
  )
}

// ---- General ----------------------------------------------------------------

function GeneralSettings(): JSX.Element {
  const { refresh, toast } = useLibrary()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    void api.getAppInfo().then(setInfo)
  }, [])

  const refreshIcons = async (): Promise<void> => {
    setRefreshing(true)
    try {
      const n = await api.refreshIcons()
      await refresh()
      toast(`Icons refreshed for ${n} ${n === 1 ? 'entry' : 'entries'}.`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <h2>General</h2>
      <p className="lead">Launchpad {info?.version ?? ''} — a shelf for everything you choose to launch.</p>

      <div className="callout" style={{ marginBottom: 20 }}>
        <div>
          <strong>Launcher data folder</strong>
        </div>
        <div className="mono selectable" style={{ margin: '6px 0 10px', fontSize: 12 }}>
          {info?.dataDir ?? '…'}
        </div>
        <button className="btn sm" onClick={() => void api.openDataFolder()}>
          Open Folder
        </button>
        <div style={{ marginTop: 8, fontSize: 12 }}>This is the only place the launcher ever writes: its database, copies of cover images, and restore snapshots.</div>
      </div>

      <div className="callout" style={{ marginBottom: 20 }}>
        <div>
          <strong>Icons</strong>
        </div>
        <div style={{ margin: '6px 0 10px', fontSize: 12 }}>
          Re-read the icon of every .exe / .lnk / .url entry (picks the largest one the file ships, up to 256px). Read-only.
        </div>
        <button className="btn sm" disabled={refreshing} onClick={() => void refreshIcons()}>
          {refreshing ? 'Refreshing…' : 'Refresh All Icons'}
        </button>
      </div>

      <h2 style={{ fontSize: 16 }}>What this launcher can and cannot do</h2>
      <div className="rules">
        <div className="rule">
          <span className="ok">✓</span>
          <span>Open the .exe, .lnk, steam:// or https:// targets you explicitly add — exactly like double-clicking them.</span>
        </div>
        <div className="rule">
          <span className="ok">✓</span>
          <span>Read the name and icon of a file you drop or pick, and keep a copy of cover images you choose.</span>
        </div>
        <div className="rule">
          <span className="no">✕</span>
          <span>Scan your drives or discover installed programs on its own.</span>
        </div>
        <div className="rule">
          <span className="no">✕</span>
          <span>Delete, move, rename or modify any file outside its own data folder. "Remove from Library" only removes the entry.</span>
        </div>
        <div className="rule">
          <span className="no">✕</span>
          <span>Run shell commands, touch the registry, uninstall software, or connect to the internet.</span>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 26 }}>Keyboard shortcuts</h2>
      <div className="list">
        {[
          ['Ctrl K', 'Focus search'],
          ['Ctrl N', 'Add application'],
          ['Ctrl R', 'Open random picker'],
          ['Esc', 'Close dialog / clear search'],
          ['Enter', 'Activate focused item']
        ].map(([k, d]) => (
          <div key={k} className="list-row" style={{ padding: '8px 14px' }}>
            <span className="kbd">{k}</span>
            <span className="muted">{d}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ---- Appearance ---------------------------------------------------------------------

function ThemeSwatch({ info, active, onPick }: { info: ThemeInfo; active: boolean; onPick: () => void }): JSX.Element {
  // The swatch carries its own data-theme, so it previews in that palette.
  return (
    <button type="button" className={`theme-swatch ${active ? 'active' : ''}`} data-theme={info.id} onClick={onPick} aria-pressed={active}>
      <div className="swatch-preview">
        <div className="swatch-side">
          <i className="on" />
          <i />
          <i />
          <i />
        </div>
        <div className="swatch-main">
          <span className="swatch-tile" />
          <span className="swatch-tile alt" />
          <span className="swatch-accent">+ ADD</span>
          <span className="swatch-play">▶ PLAY</span>
        </div>
      </div>
      <div className="swatch-name">{info.name}</div>
      <div className="swatch-desc">{info.description}</div>
      <div className="swatch-dots" aria-hidden="true">
        {info.dots.map((c, i) => (
          <i key={i} style={{ background: c }} />
        ))}
      </div>
    </button>
  )
}

function AppearanceSettings(): JSX.Element {
  const { theme, density, motion, themes, setTheme, setDensity, setMotion } = useAppearance()
  return (
    <>
      <h2>Appearance</h2>
      <p className="lead">Pick a palette. Changes apply instantly and are remembered on this PC.</p>

      <div className="theme-grid">
        {themes.map((t) => (
          <ThemeSwatch key={t.id} info={t} active={theme === t.id} onPick={() => setTheme(t.id)} />
        ))}
      </div>

      <h2 className="sub">Layout</h2>
      <div className="setting-group">
        <div className="switch" role="group" aria-label="Grid density">
          <div>
            <div className="title">Grid density</div>
            <div className="desc">Comfortable shows larger covers; compact fits more on screen.</div>
          </div>
          <div className="segmented">
            <button type="button" className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>
              Comfortable
            </button>
            <button type="button" className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')}>
              Compact
            </button>
          </div>
        </div>

        <label className="switch">
          <div>
            <div className="title">Reduce motion</div>
            <div className="desc">Turns off hover lifts, slide-ins and the picker roulette.</div>
          </div>
          <input type="checkbox" checked={motion === 'reduced'} onChange={(e) => setMotion(e.target.checked ? 'reduced' : 'full')} />
        </label>
      </div>
    </>
  )
}

// ---- Platforms / Categories -----------------------------------------------------

function LabelManager({ kind }: { kind: 'platforms' | 'categories' }): JSX.Element {
  const { platforms, categories, apps, refresh, toast } = useLibrary()
  const items = kind === 'platforms' ? platforms : categories
  const singular = kind === 'platforms' ? 'platform' : 'category'
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState<Platform | null>(null)

  const save = kind === 'platforms' ? api.savePlatform : api.saveCategory
  const remove = kind === 'platforms' ? api.removePlatform : api.removeCategory
  const reorder = kind === 'platforms' ? api.reorderPlatforms : api.reorderCategories
  const usage = (id: string): number =>
    apps.filter((a) => (kind === 'platforms' ? a.platformId : a.categoryId) === id).length

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  const move = (index: number, delta: number): void => {
    const ids = items.map((i) => i.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void run(() => reorder(ids))
  }

  return (
    <>
      <h2>{kind === 'platforms' ? 'Platforms' : 'Categories'}</h2>
      <p className="lead">
        Removing a {singular} never removes applications — they simply lose the label.
      </p>

      <form
        className="label-editor"
        onSubmit={(e) => {
          e.preventDefault()
          if (!newName.trim()) return
          void run(() => save({ name: newName })).then(() => setNewName(''))
        }}
      >
        <input className="input" placeholder={`New ${singular} name`} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
        <button className="btn primary" type="submit" disabled={!newName.trim()}>
          Add
        </button>
      </form>

      <div className="list">
        {items.map((item, index) => (
          <div key={item.id} className="list-row">
            {editing?.id === item.id ? (
              <form
                className="grow"
                style={{ display: 'flex', gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(() => save({ id: item.id, name: editing.name })).then(() => setEditing(null))
                }}
              >
                <input
                  className="inline-edit"
                  value={editing.name}
                  onChange={(e) => setEditing({ id: item.id, name: e.target.value })}
                  autoFocus
                  maxLength={60}
                  onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                />
                <button className="btn sm primary" type="submit">
                  Save
                </button>
                <button className="btn sm" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <div className="grow">
                <div className="title">{item.name}</div>
                <div className="detail">
                  {usage(item.id)} {usage(item.id) === 1 ? 'application' : 'applications'}
                </div>
              </div>
            )}
            <div className="actions">
              <button className="btn icon sm" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button className="btn icon sm" title="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                ↓
              </button>
              <button className="btn sm" onClick={() => setEditing({ id: item.id, name: item.name })}>
                Rename
              </button>
              <button className="btn sm danger" onClick={() => setRemoving(item)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {removing && (
        <ConfirmModal
          title={`Remove ${singular} "${removing.name}"?`}
          confirmLabel={`Remove ${singular}`}
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            void run(() => remove(removing.id)).then(() => setRemoving(null))
          }}
        >
          <p>
            {usage(removing.id)} {usage(removing.id) === 1 ? 'application uses' : 'applications use'} this {singular}. They will stay in your
            library without a {singular}.
          </p>
        </ConfirmModal>
      )}
    </>
  )
}

// ---- Library Health ---------------------------------------------------------------

function HealthSettings(): JSX.Element {
  const { apps, refresh, toast, setModal } = useLibrary()
  const navigate = useNavigate()
  const [missing, setMissing] = useState<MissingTarget[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<MissingTarget | null>(null)

  const check = async (): Promise<void> => {
    setBusy(true)
    try {
      setMissing(await api.checkAllTargets())
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const fileEntries = apps.filter((a) => a.launchType !== 'uri').length

  return (
    <>
      <h2>Library Health</h2>
      <p className="lead">
        Checks whether each entry's file still exists — for example games you have since uninstalled. This only looks; it never searches
        your PC for moved files or changes anything.
      </p>

      <button className="btn primary" disabled={busy || fileEntries === 0} onClick={() => void check()}>
        {busy ? 'Checking…' : `Check All Targets (${fileEntries})`}
      </button>

      {missing && missing.length === 0 && (
        <div className="callout" style={{ marginTop: 16 }}>
          <strong>All good.</strong> Every entry still points at an existing file.
        </div>
      )}

      {missing && missing.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="callout warn" style={{ marginBottom: 12 }}>
            <strong>
              {missing.length} {missing.length === 1 ? 'entry' : 'entries'} can't be found.
            </strong>{' '}
            Choose a new location yourself, or remove the launcher entry (the app's own files are never touched).
          </div>
          <div className="list">
            {missing.map((m) => {
              const app = apps.find((a) => a.id === m.id)
              return (
                <div key={m.id} className="list-row">
                  <div className="grow">
                    <div className="title">{m.name}</div>
                    <div className="detail mono selectable">{m.launchTarget}</div>
                  </div>
                  <div className="actions">
                    <button className="btn sm" onClick={() => navigate(`/library/${m.id}`)}>
                      Open
                    </button>
                    {app && (
                      <button className="btn sm" onClick={() => setModal({ type: 'missing', app, message: m.message })}>
                        Choose New Target…
                      </button>
                    )}
                    <button className="btn sm danger" onClick={() => setRemoving(m)}>
                      Remove from Library
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {removing && (
        <ConfirmModal
          title={`Remove ${removing.name} from your launcher?`}
          confirmLabel="Remove from Library"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            void (async () => {
              await api.removeApplication(removing.id)
              await refresh()
              setMissing((list) => (list ? list.filter((m) => m.id !== removing.id) : list))
              setRemoving(null)
              toast(`${removing.name} removed from your library.`)
            })()
          }}
        >
          <p>
            This only removes the launcher entry. <strong>Nothing on disk is modified.</strong>
          </p>
        </ConfirmModal>
      )}
    </>
  )
}

// ---- Backup ----------------------------------------------------------------------

function BackupSettings(): JSX.Element {
  const { apps, platforms, categories, presets, refresh, toast } = useLibrary()
  const [summary, setSummary] = useState<BackupSummary | null>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [busy, setBusy] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const exportBackup = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await api.exportBackup()
      toast(r.message, r.ok ? 'success' : 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const choose = async (): Promise<void> => {
    try {
      const s = await api.inspectBackup()
      setSummary(s)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  const restore = async (): Promise<void> => {
    if (!summary) return
    setBusy(true)
    try {
      const r = await api.importBackup(summary.token, mode)
      await refresh()
      toast(r.message, 'success')
      setSummary(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
      setConfirmReplace(false)
    }
  }

  return (
    <>
      <h2>Backup &amp; Restore</h2>
      <p className="lead">
        A backup is a small JSON file with your launcher entries, labels and presets. It never includes or touches any game or application
        files.
      </p>

      <div className="callout" style={{ marginBottom: 22 }}>
        <div className="stats">
          <div className="stat">
            <div className="n">{apps.length}</div>
            <div className="l">Apps</div>
          </div>
          <div className="stat">
            <div className="n">{platforms.length}</div>
            <div className="l">Platforms</div>
          </div>
          <div className="stat">
            <div className="n">{categories.length}</div>
            <div className="l">Categories</div>
          </div>
          <div className="stat">
            <div className="n">{presets.length}</div>
            <div className="l">Presets</div>
          </div>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => void exportBackup()}>
          Export Library Backup…
        </button>
        <div style={{ marginTop: 8, fontSize: 12 }}>Cover images are not included in the file; they stay in the launcher's own folder.</div>
      </div>

      <h2 style={{ fontSize: 16 }}>Restore</h2>
      {!summary ? (
        <button className="btn" onClick={() => void choose()}>
          Choose Backup File…
        </button>
      ) : (
        <div className="callout">
          <div>
            <strong>{summary.fileName}</strong> contains:
          </div>
          <div className="stats">
            <div className="stat">
              <div className="n">{summary.applications}</div>
              <div className="l">Apps</div>
            </div>
            <div className="stat">
              <div className="n">{summary.platforms}</div>
              <div className="l">Platforms</div>
            </div>
            <div className="stat">
              <div className="n">{summary.categories}</div>
              <div className="l">Categories</div>
            </div>
            <div className="stat">
              <div className="n">{summary.presets}</div>
              <div className="l">Presets</div>
            </div>
          </div>
          <div className="radio-group">
            <label className={`radio ${mode === 'merge' ? 'active' : ''}`}>
              <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              <div>
                <div className="title">Merge with current library</div>
                <div className="desc">Adds anything missing. Entries you already have are kept as they are.</div>
              </div>
            </label>
            <label className={`radio ${mode === 'replace' ? 'active' : ''}`}>
              <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              <div>
                <div className="title">Replace current launcher configuration</div>
                <div className="desc">Clears the launcher's own database first. A snapshot of it is saved in the data folder before anything changes.</div>
              </div>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" disabled={busy} onClick={() => (mode === 'replace' ? setConfirmReplace(true) : void restore())}>
              Restore
            </button>
            <button className="btn" disabled={busy} onClick={() => setSummary(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmReplace && (
        <ConfirmModal
          title="Replace your current launcher configuration?"
          confirmLabel="Replace"
          danger
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => void restore()}
        >
          <p>
            Your current entries, labels and presets will be replaced by the backup. A snapshot of the current database is saved to the
            launcher's <span className="mono">snapshots</span> folder first. No game or application files are affected.
          </p>
        </ConfirmModal>
      )}
    </>
  )
}
