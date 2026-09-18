import { useEffect, useMemo, useRef, useState } from 'react'
import { Thumb } from '@/components/CoverImage'
import type { SpinProps } from './QuickShuffle'

export const SLOT_ITEM = 72
const REEL_DURATIONS = [1500, 2100, 2700]

/**
 * Three reels spin and stop left to right, all on the winner. The strip is
 * the candidate list repeated; a CSS transform transition does the motion.
 */
export function SlotMachine({ candidates, winner, onDone }: SpinProps): JSX.Element {
  const n = candidates.length
  const winnerIndex = Math.max(
    0,
    candidates.findIndex((c) => c.id === winner.id)
  )
  const reps = Math.max(4, Math.ceil(28 / Math.max(1, n)))
  const strip = useMemo(() => Array.from({ length: reps }, () => candidates).flat(), [candidates, reps])
  const finalIndex = (reps - 1) * n + winnerIndex
  const [go, setGo] = useState(false)
  const finished = useRef(0)

  useEffect(() => {
    // Two frames so the resting transform is committed before the transition starts.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setGo(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="slot" role="img" aria-label="Slot machine spinning">
      {REEL_DURATIONS.map((duration, reel) => {
        const startIndex = (reel * 2) % Math.max(1, n)
        const y = SLOT_ITEM - (go ? finalIndex : startIndex) * SLOT_ITEM
        return (
          <div className="slot-reel" key={reel}>
            <div
              className="slot-strip"
              style={{
                transform: `translateY(${y}px)`,
                transition: go ? `transform ${duration}ms cubic-bezier(0.1, 0.9, 0.2, 1)` : 'none'
              }}
              onTransitionEnd={(e) => {
                if (e.target !== e.currentTarget) return
                finished.current++
                if (finished.current === REEL_DURATIONS.length) onDone()
              }}
            >
              {strip.map((app, i) => (
                <div className="slot-item" key={i}>
                  <Thumb app={app} size="sm" />
                  <span>{app.name}</span>
                </div>
              ))}
            </div>
            <div className="slot-window" />
          </div>
        )
      })}
    </div>
  )
}
