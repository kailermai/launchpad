import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Application } from '@shared/types'
import { api } from '@/api'
import { CoverImage, Thumb } from '@/components/CoverImage'
import { EmptyState } from '@/components/EmptyState'
import { IconDice, IconPlay, IconRefresh } from '@/components/Icons'
import { QuickShuffle } from '@/components/picker/QuickShuffle'
import { RouletteWheel } from '@/components/picker/RouletteWheel'
import { SlotMachine } from '@/components/picker/SlotMachine'
import { useAppearance } from '@/store/AppearanceContext'
import { useLibrary } from '@/store/LibraryContext'
import { randomIndex } from '@/utils/random'

type PickerMode = 'quick' | 'slots' | 'wheel'
const MODES: { id: PickerMode; label: string; hint: string }[] = [
  { id: 'quick', label: 'Quick', hint: 'Fast shuffle, about a second' },
  { id: 'slots', label: 'Slots', hint: 'Three reels, stop one by one' },
  { id: 'wheel', label: 'Wheel', hint: 'Spin the wheel, wait for the pointer' }
]
const MODE_KEY = 'launcher.pickerMode'

function loadMode(): PickerMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'quick' || v === 'slots' || v === 'wheel') return v
  } catch {
    // ignore
  }
  return 'quick'
}

interface Spin {
  key: number
  pool: Application[]
  winner: Application
}

export function RandomPickerPage(): JSX.Element {
  const { apps, presets, loaded, launch, refresh, toast } = useLibrary()
  const { motion } = useAppearance()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [presetName, setPresetName] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [mode, setModeState] = useState<PickerMode>(loadMode)
  const [spin, setSpin] = useState<Spin | null>(null)
  const [result, setResult] = useState<Application | null>(null)
  const revealTimer = useRef<number | null>(null)

  const appById = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps])
  const candidates = useMemo(() => apps.filter((a) => selected.has(a.id)), [apps, selected])
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps
  }, [apps, filter])

  const setMode = (m: PickerMode): void => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // ignore
    }
  }

  const loadPreset = (id: string | null): void => {
    const preset = id ? presets.find((p) => p.id === id) : undefined
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

  const pick = (pool: Application[], exclude?: string): void => {
    const usable = pool.filter((c) => pool.length < 3 || c.id !== exclude)
    if (usable.length === 0 || pool.length < 2) return
    const winner = usable[randomIndex(usable.length)]
    setResult(null)
    if (motion === 'reduced') {
      setResult(winner)
      return
    }
    setSpin({ key: Date.now(), pool: usable, winner })
  }

  // Deep links: /random?preset=<id> loads a preset; /random?spin=1 selects everything and spins.
  useEffect(() => {
    if (!loaded) return
    const presetId = params.get('preset')
    const autoSpin = params.get('spin') === '1'
    const forcedMode = params.get('mode')
    if (!presetId && !autoSpin && !forcedMode) return
    if (forcedMode === 'quick' || forcedMode === 'slots' || forcedMode === 'wheel') setMode(forcedMode)
    if (presetId) loadPreset(presetId)
    if (autoSpin) {
      setSelected(new Set(apps.map((a) => a.id)))
      pick(apps)
    }
    const next = new URLSearchParams(params)
    next.delete('preset')
    next.delete('spin')
    next.delete('mode')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, loaded])

  useEffect(
    () => () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current)
    },
    []
  )

  const onSpinDone = (): void => {
    if (!spin) return
    const { winner } = spin
    // Leave the machine on the winner for a beat before the reveal card.
    revealTimer.current = window.setTimeout(() => {
      setResult(winner)
      setSpin(null)
    }, 700)
  }

  const toggle = (id: string): void => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  const busy = spin !== null
  const modeInfo = MODES.find((m) => m.id === mode) ?? MODES[0]

  return (
    <>
      <div className="page-header">
        <div>
          <h1>What should I play?</h1>
          <div className="sub">Tick the candidates, then let chance decide.</div>
        </div>
        <Link className="btn" to="/random/presets">
          Manage presets ({presets.length})
        </Link>
      </div>

      <div className="picker">
        <div>
          {presets.length > 0 && (
            <div className="chip-row" style={{ marginBottom: 14 }}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  className={`chip sm ${editingPresetId === p.id ? 'active' : ''}`}
                  onClick={() => loadPreset(editingPresetId === p.id ? null : p.id)}
                >
                  {p.name} <span className="faint">{p.applicationIds.length}</span>
                </button>
              ))}
            </div>
          )}

          <div className="filters">
            <input className="input" style={{ maxWidth: 240 }} placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="btn sm" onClick={() => setSelected(new Set(apps.map((a) => a.id)))}>
              Select All
            </button>
            <button className="btn sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <span className="result-count">{selected.size} selected</span>
          </div>

          <div className="candidates">
            {visible.map((app) => (
              <label key={app.id} className={`candidate ${selected.has(app.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggle(app.id)} />
                <Thumb app={app} size="sm" />
                <span>{app.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="picker-panel">
          <div className="picker-mode">
            <div className="segmented" role="radiogroup" aria-label="Picker style">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  className={mode === m.id ? 'active' : ''}
                  title={m.hint}
                  disabled={busy}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {spin ? (
            <div className="result">
              <div className="eyebrow">Choosing…</div>
              {mode === 'slots' ? (
                <SlotMachine key={spin.key} candidates={spin.pool} winner={spin.winner} onDone={onSpinDone} />
              ) : mode === 'wheel' ? (
                <RouletteWheel key={spin.key} candidates={spin.pool} winner={spin.winner} onDone={onSpinDone} />
              ) : (
                <QuickShuffle key={spin.key} candidates={spin.pool} winner={spin.winner} onDone={onSpinDone} />
              )}
            </div>
          ) : result ? (
            <div className="result reveal">
              <div className="eyebrow">Tonight you should play</div>
              <CoverImage app={result} showFavorite={false} />
              <div className="name">{result.name}</div>
              <div className="buttons">
                <button className="btn play lg" onClick={() => void launch(result)}>
                  <IconPlay /> PLAY
                </button>
                <button className="btn lg" onClick={() => pick(candidates, result.id)}>
                  <IconRefresh /> Reroll
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3>Ready?</h3>
              <button className="btn primary lg block" disabled={candidates.length < 2} onClick={() => pick(candidates)}>
                <IconDice /> {mode === 'wheel' ? 'SPIN THE WHEEL' : mode === 'slots' ? 'PULL THE LEVER' : 'PICK FOR ME'}
              </button>
              <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
                {candidates.length < 2
                  ? 'Select at least two candidates.'
                  : `${modeInfo.hint} · choosing from ${candidates.length} candidates.`}
                {motion === 'reduced' && candidates.length >= 2 && ' Reduce motion is on, so the result appears instantly.'}
              </div>
            </>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <h3 style={{ marginBottom: 10 }}>{editingPresetId ? 'Update preset' : 'Save as preset'}</h3>
            <div className="input-row">
              <input
                className="input"
                placeholder="Preset name (e.g. Chill)"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                maxLength={60}
              />
              <button className="btn" disabled={selected.size === 0} onClick={() => void savePreset()}>
                {editingPresetId ? 'Update' : 'Save'}
              </button>
            </div>
            {editingPresetId && (
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => loadPreset(null)}>
                Save as a new preset instead
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
