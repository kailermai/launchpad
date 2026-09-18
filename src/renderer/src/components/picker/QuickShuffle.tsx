import { useEffect, useState } from 'react'
import type { Application } from '@shared/types'
import { Thumb } from '@/components/CoverImage'
import { randomIndex } from '@/utils/random'

export interface SpinProps {
  candidates: Application[]
  /** Chosen before the animation starts; every mode lands on this. */
  winner: Application
  onDone: () => void
}

/** Fast mode: names flick past and slow down onto the winner (~1.5 s). */
export function QuickShuffle({ candidates, winner, onDone }: SpinProps): JSX.Element {
  const [current, setCurrent] = useState<Application>(candidates[0] ?? winner)

  useEffect(() => {
    const start = performance.now()
    const duration = 1500
    let timer = 0
    const step = (): void => {
      const elapsed = performance.now() - start
      if (elapsed < duration) {
        setCurrent(candidates[randomIndex(candidates.length)])
        const t = elapsed / duration
        timer = window.setTimeout(step, 55 + t * t * 300) // ease out
      } else {
        setCurrent(winner)
        onDone()
      }
    }
    step()
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="roll" aria-live="off">
      <Thumb app={current} size="lg" />
      <div className="name rolling">{current.name}</div>
    </div>
  )
}
