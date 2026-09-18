import { useEffect, useMemo, useState } from 'react'
import { IconDice } from '@/components/Icons'
import { useAppearance } from '@/store/AppearanceContext'
import type { SpinProps } from './QuickShuffle'

const TURNS = 5
const DURATION = 4200

/**
 * A wheel with one segment per candidate spins clockwise and decelerates so
 * the winner's segment ends under the pointer at the top.
 */
export function RouletteWheel({ candidates, winner, onDone }: SpinProps): JSX.Element {
  const { tileHue } = useAppearance()
  const n = Math.max(1, candidates.length)
  const seg = 360 / n
  const winnerIndex = Math.max(
    0,
    candidates.findIndex((c) => c.id === winner.id)
  )
  const [angle, setAngle] = useState(0)

  // Where to stop: bring the winner's segment centre to 0° (top), plus a little
  // jitter inside the segment so it doesn't always land dead-centre.
  const target = useMemo(() => {
    const jitter = (Math.random() - 0.5) * seg * 0.6
    return 360 * TURNS + 360 - ((winnerIndex + 0.5) * seg + jitter)
  }, [winnerIndex, seg])

  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setAngle(target))
    })
    return () => cancelAnimationFrame(raf)
  }, [target])

  const gradient = useMemo(() => {
    const stops = candidates.map((_, i) => {
      const hue = (tileHue + ((i * 37) % 50) - 25 + 360) % 360
      const light = [38, 27, 33][i % 3]
      return `hsl(${hue} 48% ${light}%) ${i * seg}deg ${(i + 1) * seg}deg`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [candidates, seg, tileHue])

  const labelSize = n > 20 ? 9 : n > 12 ? 10 : n > 6 ? 11 : 13

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true" />
      <div
        className="wheel"
        role="img"
        aria-label="Roulette wheel spinning"
        style={{
          background: gradient,
          transform: `rotate(${angle}deg)`,
          transition: angle ? `transform ${DURATION}ms cubic-bezier(0.12, 0.8, 0.12, 1)` : 'none'
        }}
        onTransitionEnd={(e) => e.target === e.currentTarget && onDone()}
      >
        {n <= 28 &&
          candidates.map((c, i) => (
            <div className="wheel-label" key={c.id} style={{ transform: `rotate(${(i + 0.5) * seg}deg)` }}>
              <span style={{ fontSize: labelSize }}>{c.name}</span>
            </div>
          ))}
      </div>
      <div className="wheel-hub" aria-hidden="true">
        <IconDice />
      </div>
    </div>
  )
}
