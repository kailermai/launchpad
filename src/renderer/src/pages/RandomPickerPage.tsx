import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Application } from '@shared/types'
import { api } from '@/api'
import { CoverImage, Thumb } from '@/components/CoverImage'
import { EmptyState } from '@/components/EmptyState'
import { useLibrary } from '@/store/LibraryContext'

/** Cryptographically random index — no bias, no "it always picks the same one". */
function randomIndex(n: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}

export function RandomPickerPage(): JSX.Element {
  const { apps, presets, loaded, launch, refresh, toast } = useLibrary()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [presetName, setPresetName] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [rollingName, setRollingName] = useState('')
  const [result, setResult] = useState<Application | null>(null)
  const timer = useRef<number | null>(null)

  const appById = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps])
  const candidates = useMemo(() => apps.filter((a) => selected.has(a.id)), [apps, selected])
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps
  }, [apps, filter])

  // Load a preset when arriving via /random?preset=<id>
  useEffect(() => {
    const presetId = params.get('preset')
    if (!presetId || !loaded) return
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      setSelected(new Set(preset.applicationIds.filter((id) => appById.has(id))))
      setPresetName(preset.name)
      setEditingPresetId(preset.id)
      setResult(null)
    }
    const next = new URLSearchParams(params)
    next.delete('preset')
    setParams(next, { replace: true })
  }, [params, presets, loaded, appById, setParams])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const toggle = (id: string): void => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pick = (exclude?: string): void => {
    const pool = candidates.filter((c) => candidates.length < 3 || c.id !== exclude)
    if (pool.length < 2 && candidates.length < 2) return
    setRolling(true)
    setResult(null)
    const start = performance.now()
    const duration = 1500
    const step = (): void => {
      const elapsed = performance.now() - start
      setRollingName(pool[randomIndex(pool.length)].name)
      if (elapsed < duration) {
        // Ease out: ticks get slower as we approach the reveal.
        const t = elapsed / duration
        timer.current = window.setTimeout(step, 50 + t * t * 260)
      } else {
        setRolling(false)
        setResult(pool[randomIndex(pool.length)])
      }
    }
    step()
  }

  const savePreset = async (): Promise<void> => {
    const name = presetName.trim()
    if (!name) {
      toast('Give the preset a name first.', 'error')
      return
    }
    try {
      const saved = await api.savePreset({ id: editingPresetId ?? undefined, name, applicationIds: [...selected] })
      setEditingPresetId(saved.id)
      await refresh()
      toast(`Preset "${saved.name}" saved.`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  const loadPreset = (id: string): void => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) {
      setEditingPresetId(null)
      setPresetName('')
      return
    }
    setSelected(new Set(preset.applicationIds.filter((x) => appById.has(x))))
    setPresetName(preset.name)
    setEditingPresetId(preset.id)
    setResult(null)
  }

  if (!loaded) return <div />
  if (apps.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1>What should I play?</h1>
        </div>
        <EmptyState title="Add a few games first" text="The picker only chooses from things you have added to the launcher." />
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>What should I play?</h1>
          <div className="sub">Tick the candidates, then let chance decide.</div>
        </div>
        <Link className="btn" to="/random/presets">
          Saved presets ({presets.length})
        </Link>
      </div>

      <div className="picker">
        <div>
          <div className="filters">
            <input className="input" style={{ maxWidth: 260 }} placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="btn sm" onClick={() => setSelected(new Set(apps.map((a) => a.id)))}>
              Select All
            </button>
            <button className="btn sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <select
              className="input"
              value={editingPresetId ?? ''}
              onChange={(e) => loadPreset(e.target.value)}
              aria-label="Load preset"
            >
              <option value="">Load preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.applicationIds.length})
                </option>
              ))}
            </select>
            <span className="result-count">{selected.size} selected</span>
          </div>

          <div className="candidates">
            {visible.map((app) => (
              <label key={app.id} className="candidate">
                <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggle(app.id)} />
                <Thumb app={app} />
                <span>{app.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="picker-panel">
          {result || rolling ? (
            <div className={`result ${result ? 'reveal' : ''}`}>
              <div className="eyebrow">{rolling ? 'Choosing…' : 'Tonight you should play'}</div>
              {result && <CoverImage app={result} showFavorite={false} />}
              <div className={`name ${rolling ? 'rolling' : ''}`}>{rolling ? rollingName : result?.name}</div>
              <div className="buttons">
                <button className="btn play lg" disabled={rolling} onClick={() => result && void launch(result)}>
                  ▶ PLAY
                </button>
                <button className="btn lg" disabled={rolling} onClick={() => pick(result?.id)}>
                  Reroll
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3>Ready?</h3>
              <button className="btn primary lg block" disabled={candidates.length < 2} onClick={() => pick()}>
                🎲 PICK FOR ME
              </button>
              <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
                {candidates.length < 2 ? 'Select at least two candidates.' : `Choosing from ${candidates.length} candidates.`}
              </div>
            </>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <h3 style={{ marginBottom: 10 }}>{editingPresetId ? 'Update preset' : 'Save as preset'}</h3>
            <div className="input-row">
              <input className="input" placeholder="Preset name (e.g. Chill)" value={presetName} onChange={(e) => setPresetName(e.target.value)} maxLength={60} />
              <button className="btn" disabled={selected.size === 0} onClick={() => void savePreset()}>
                {editingPresetId ? 'Update' : 'Save'}
              </button>
            </div>
            {editingPresetId && (
              <button
                className="btn ghost sm"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setEditingPresetId(null)
                  setPresetName('')
                }}
              >
                Save as a new preset instead
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
